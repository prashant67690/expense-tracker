import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { bankMailQuery, messageText, type MailHeader, type MailPart } from "./mail-text";
import type { GmailAlert, GmailStatus } from "./gmail-types";

const TOKEN_PATH = path.join(process.cwd(), ".data", "gmail-token.json");
const SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

type StoredToken = {
  refreshToken: string;
  accessToken: string;
  expiresAt: number;
  email: string;
};

type GoogleToken = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

function clientId(): string {
  return process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
}

function clientSecret(): string {
  return process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "";
}

export function gmailConfigured(): boolean {
  return Boolean(clientId() && clientSecret());
}

export function redirectUri(origin: string): string {
  return `${origin}/api/gmail/callback`;
}

export function googleAuthUrl(origin: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function readToken(): Promise<StoredToken | null> {
  try {
    const parsed = JSON.parse(await readFile(TOKEN_PATH, "utf8")) as Partial<StoredToken>;
    if (!parsed.refreshToken || !parsed.accessToken || !parsed.expiresAt) return null;
    return {
      refreshToken: parsed.refreshToken,
      accessToken: parsed.accessToken,
      expiresAt: parsed.expiresAt,
      email: parsed.email ?? "",
    };
  } catch {
    return null;
  }
}

async function writeToken(token: StoredToken) {
  await mkdir(path.dirname(TOKEN_PATH), { recursive: true });
  await writeFile(TOKEN_PATH, JSON.stringify(token), { mode: 0o600 });
}

export async function clearGmailToken() {
  await rm(TOKEN_PATH, { force: true });
}

async function postToken(body: URLSearchParams): Promise<GoogleToken> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  return (await response.json()) as GoogleToken;
}

export async function exchangeCode(origin: string, code: string): Promise<StoredToken> {
  const token = await postToken(
    new URLSearchParams({
      code,
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: redirectUri(origin),
      grant_type: "authorization_code",
    }),
  );
  if (!token.access_token) {
    throw new Error(token.error_description || "Google did not return an access token.");
  }
  if (!token.refresh_token) {
    throw new Error("Google did not return a refresh token. Remove Khaata from your Google account access and connect again.");
  }
  const email = await fetchEmail(token.access_token);
  const stored: StoredToken = {
    refreshToken: token.refresh_token,
    accessToken: token.access_token,
    expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000,
    email,
  };
  await writeToken(stored);
  return stored;
}

async function fetchEmail(accessToken: string): Promise<string> {
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return "";
  const profile = (await response.json()) as { emailAddress?: string };
  return profile.emailAddress ?? "";
}

async function accessToken(): Promise<string> {
  const stored = await readToken();
  if (!stored) throw new Error("Gmail is not connected.");
  if (stored.expiresAt > Date.now() + 60_000) return stored.accessToken;

  const token = await postToken(
    new URLSearchParams({
      client_id: clientId(),
      client_secret: clientSecret(),
      refresh_token: stored.refreshToken,
      grant_type: "refresh_token",
    }),
  );
  if (!token.access_token) {
    await clearGmailToken();
    throw new Error("Gmail access expired. Connect again.");
  }
  const next: StoredToken = {
    ...stored,
    accessToken: token.access_token,
    expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000,
  };
  await writeToken(next);
  return next.accessToken;
}

export async function gmailStatus(): Promise<GmailStatus> {
  if (!gmailConfigured()) return { configured: false, connected: false, email: null };
  const stored = await readToken();
  if (!stored) return { configured: true, connected: false, email: null };
  return { configured: true, connected: true, email: stored.email || null };
}

type GmailList = {
  messages?: { id: string }[];
  nextPageToken?: string;
  error?: { message?: string };
};

type GmailMessage = {
  id?: string;
  payload?: MailPart & { headers?: MailHeader[] };
  error?: { message?: string };
};

async function listBankMessageIds(token: string): Promise<string[]> {
  const ids: string[] = [];
  let pageToken = "";
  do {
    const listUrl = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
    listUrl.searchParams.set("q", bankMailQuery());
    listUrl.searchParams.set("maxResults", "500");
    if (pageToken) listUrl.searchParams.set("pageToken", pageToken);
    const listed = await fetch(listUrl, { headers: { Authorization: `Bearer ${token}` } });
    const list = (await listed.json()) as GmailList;
    if (!listed.ok) throw new Error(list.error?.message || "Gmail could not list bank mail.");
    for (const item of list.messages ?? []) ids.push(item.id);
    pageToken = list.nextPageToken ?? "";
  } while (pageToken);
  return ids;
}

async function readAlert(token: string, id: string): Promise<GmailAlert | null> {
  const messageUrl = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`);
  messageUrl.searchParams.set("format", "full");
  const response = await fetch(messageUrl, { headers: { Authorization: `Bearer ${token}` } });
  const message = (await response.json()) as GmailMessage;
  if (!response.ok || !message.payload || !message.id) return null;
  const headers = message.payload.headers ?? [];
  const text = messageText(message.payload, headers);
  if (!text) return null;
  const from = headers.find((header) => header.name?.toLowerCase() === "from")?.value ?? "";
  const subject = headers.find((header) => header.name?.toLowerCase() === "subject")?.value ?? "";
  return { id: message.id, text, from, subject };
}

export async function syncBankMail(): Promise<GmailAlert[]> {
  const token = await accessToken();
  const ids = await listBankMessageIds(token);
  const alerts: GmailAlert[] = [];
  for (const id of ids) {
    const alert = await readAlert(token, id);
    if (alert) alerts.push(alert);
  }
  return alerts;
}
