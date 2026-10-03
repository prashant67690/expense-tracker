import { clearGmailToken } from "@/lib/gmail";

export async function POST() {
  await clearGmailToken();
  return Response.json({ ok: true });
}
