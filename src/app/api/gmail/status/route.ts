import { gmailStatus } from "@/lib/gmail";

export async function GET() {
  return Response.json(await gmailStatus());
}
