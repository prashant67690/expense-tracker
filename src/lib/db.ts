import { neon } from "@neondatabase/serverless";

export function sql() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL is not set.");
  return neon(url);
}

let ready: Promise<void> | null = null;

export function readyDb(): Promise<void> {
  ready ??= (async () => {
    const db = sql();
    await db`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
    await db`CREATE TABLE IF NOT EXISTS gmail_tokens (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      refresh_token TEXT NOT NULL,
      access_token TEXT NOT NULL,
      expires_at BIGINT NOT NULL
    )`;
  })();
  return ready;
}

export type TokenRow = {
  refresh_token: string;
  access_token: string;
  expires_at: string | number;
  email: string;
};
