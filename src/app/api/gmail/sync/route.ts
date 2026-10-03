import type { NextRequest } from "next/server";
import { gmailConfigured, gmailStatus, syncBankMail } from "@/lib/gmail";
import { openSession, sessionCookieName } from "@/lib/session";

export async function POST(request: NextRequest) {
  if (!gmailConfigured()) {
    return Response.json({ error: "Gmail is not configured." }, { status: 400 });
  }
  const userId = await openSession(request.cookies.get(sessionCookieName())?.value);
  const status = await gmailStatus(userId);
  if (!userId || !status.connected) {
    return Response.json({ error: "Connect Gmail first." }, { status: 401 });
  }
  try {
    const messages = await syncBankMail(userId);
    return Response.json({ messages });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Could not read bank mail.";
    const statusCode = /connect again/i.test(message) ? 401 : 502;
    return Response.json({ error: message }, { status: statusCode });
  }
}
