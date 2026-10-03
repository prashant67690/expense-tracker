import { NextResponse, type NextRequest } from "next/server";
import { gmailConfigured, googleAuthUrl } from "@/lib/gmail";

export async function GET(request: NextRequest) {
  if (!gmailConfigured()) {
    return NextResponse.json(
      { error: "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.local, then restart the app." },
      { status: 400 },
    );
  }
  const state = crypto.randomUUID();
  const response = NextResponse.redirect(googleAuthUrl(request.nextUrl.origin, state));
  response.cookies.set("gmail_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return response;
}
