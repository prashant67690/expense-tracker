import { readyDb, sql, type TokenRow } from "./db";
import { bankMailQuery, messageText, type MailHeader, type MailPart } from "./mail-text";
import type { GmailAlert, GmailStatus } from "./gmail-types";

const SCOPE = "openid email https://www.googleapis.com/auth/gmail.readonly";

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
  return Boolean(
    clientId() &&
      clientSecret() &&
      process.env.DATABASE_URL?.trim() &&
      (process.env.SESSION_SECRET?.trim().length ?? 0) >= 16,
  );
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

async function readToken(userId: string): Promise<StoredToken | null> {
  await readyDb();
  const rows = await sql()`
    SELECT gmail_tokens.refresh_token, gmail_tokens.access_token, gmail_tokens.expires_at, users.email
    FROM gmail_tokens
    JOIN users ON users.id = gmail_tokens.user_id
    WHERE gmail_tokens.user_id = ${userId}
  `;
  const row = rows[0] as TokenRow | undefined;
  if (!row?.refresh_token || !row.access_token) return null;
  return {
    refreshToken: row.refresh_token,
    accessToken: row.access_token,
    expiresAt: Number(row.expires_at),
    email: row.email ?? "",
  };
}

async function writeToken(userId: string, email: string, token: StoredToken) {
  await readyDb();
  const db = sql();
  await db`INSERT INTO users (id, email) VALUES (${userId}, ${email})
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email`;
  await db`INSERT INTO gmail_tokens (user_id, refresh_token, access_token, expires_at)
    VALUES (${userId}, ${token.refreshToken}, ${token.accessToken}, ${token.expiresAt})
    ON CONFLICT (user_id) DO UPDATE SET
      refresh_token = EXCLUDED.refresh_token,
      access_token = EXCLUDED.access_token,
      expires_at = EXCLUDED.expires_at`;
}

export async function clearGmailToken(userId: string) {
  await readyDb();
  const stored = await readToken(userId);
  if (stored) {
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: stored.refreshToken }),
    }).catch(() => undefined);
  }
  await sql()`DELETE FROM gmail_tokens WHERE user_id = ${userId}`;
}

async function postToken(body: URLSearchParams): Promise<GoogleToken> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  return (await response.json()) as GoogleToken;
}

export async function exchangeCode(origin: string, code: string): Promise<{ userId: string; email: string }> {
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
  const account = await fetchAccount(token.access_token);
  const stored: StoredToken = {
    refreshToken: token.refresh_token,
    accessToken: token.access_token,
    expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000,
    email: account.email,
  };
  await writeToken(account.userId, account.email, stored);
  return { userId: account.userId, email: account.email };
}

async function fetchAccount(accessToken: string): Promise<{ userId: string; email: string }> {
  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("Google did not return the signed-in account.");
  const profile = (await response.json()) as { sub?: string; email?: string };
  if (!profile.sub) throw new Error("Google did not return an account id.");
  return { userId: profile.sub, email: profile.email ?? "" };
}

async function accessToken(userId: string): Promise<string> {
  const stored = await readToken(userId);
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
    await clearGmailToken(userId);
    throw new Error("Gmail access expired. Connect again.");
  }
  const next: StoredToken = {
    ...stored,
    accessToken: token.access_token,
    expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000,
  };
  await writeToken(userId, stored.email, next);
  return next.accessToken;
}

export async function gmailStatus(userId: string | null): Promise<GmailStatus> {
  if (!gmailConfigured()) return { configured: false, connected: false, email: null };
  if (!userId) return { configured: true, connected: false, email: null };
  const stored = await readToken(userId);
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

export async function syncBankMail(userId: string): Promise<GmailAlert[]> {
  const token = await accessToken(userId);
  const ids = await listBankMessageIds(token);
  const alerts: GmailAlert[] = [];
  for (const id of ids) {
    const alert = await readAlert(token, id);
    if (alert) alerts.push(alert);
  }
  return alerts;
}
