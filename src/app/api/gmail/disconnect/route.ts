import type { NextRequest } from "next/server";
import { clearGmailToken } from "@/lib/gmail";
import { openSession, sessionCookieName } from "@/lib/session";

export async function POST(request: NextRequest) {
  const userId = await openSession(request.cookies.get(sessionCookieName())?.value);
  if (userId) await clearGmailToken(userId);
  return Response.json({ ok: true });
}
