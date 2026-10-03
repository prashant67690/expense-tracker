const COOKIE = "khaata_session";

export function sessionCookieName(): string {
  return COOKIE;
}

function sessionSecret(): string {
  return process.env.SESSION_SECRET?.trim() ?? "";
}

export function sessionConfigured(): boolean {
  return sessionSecret().length >= 16;
}

async function hmacKey() {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(sessionSecret()), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export async function sealSession(userId: string): Promise<string> {
  const payload = Buffer.from(
    JSON.stringify({ sub: userId, exp: Date.now() + 1000 * 60 * 60 * 24 * 30 }),
  ).toString("base64url");
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(), new TextEncoder().encode(payload));
  return `${payload}.${Buffer.from(signature).toString("base64url")}`;
}

export async function openSession(token: string | undefined): Promise<string | null> {
  if (!token || !sessionConfigured()) return null;
  const [payload, mac] = token.split(".");
  if (!payload || !mac) return null;
  const valid = await crypto.subtle.verify(
    "HMAC",
    await hmacKey(),
    Buffer.from(mac, "base64url"),
    new TextEncoder().encode(payload),
  );
  if (!valid) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { sub?: string; exp?: number };
    if (!data.sub || !data.exp || data.exp < Date.now()) return null;
    return data.sub;
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
}
