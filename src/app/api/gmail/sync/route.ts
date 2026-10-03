import { gmailConfigured, gmailStatus, syncBankMail } from "@/lib/gmail";

export async function POST() {
  if (!gmailConfigured()) {
    return Response.json({ error: "Gmail is not configured." }, { status: 400 });
  }
  const status = await gmailStatus();
  if (!status.connected) {
    return Response.json({ error: "Connect Gmail first." }, { status: 401 });
  }
  try {
    const messages = await syncBankMail();
    return Response.json({ messages });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Could not read bank mail.";
    const statusCode = /connect again/i.test(message) ? 401 : 502;
    return Response.json({ error: message }, { status: statusCode });
  }
}
