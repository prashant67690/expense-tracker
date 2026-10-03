import { NextResponse, type NextRequest } from "next/server";
import { gmailStatus } from "@/lib/gmail";
import { openSession, sessionCookieName } from "@/lib/session";

export async function GET(request: NextRequest) {
  const userId = await openSession(request.cookies.get(sessionCookieName())?.value);
  return NextResponse.json(await gmailStatus(userId));
}
