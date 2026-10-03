import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode, gmailConfigured } from "@/lib/gmail";

function back(origin: string, gmail: string, reason?: string) {
  const url = new URL("/", origin);
  url.searchParams.set("gmail", gmail);
  if (reason) url.searchParams.set("reason", reason);
  const response = NextResponse.redirect(url);
  response.cookies.delete("gmail_oauth_state");
  return response;
}

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  if (!gmailConfigured()) return back(origin, "error", "Gmail is not configured.");

  const error = request.nextUrl.searchParams.get("error");
  if (error) return back(origin, "error", "Google sign-in was cancelled.");

  const state = request.nextUrl.searchParams.get("state");
  const expected = request.cookies.get("gmail_oauth_state")?.value;
  if (!state || !expected || state !== expected) {
    return back(origin, "error", "The Gmail sign-in expired. Try connecting again.");
  }

  const code = request.nextUrl.searchParams.get("code");
  if (!code) return back(origin, "error", "Google did not return a sign-in code.");

  try {
    await exchangeCode(origin, code);
    return back(origin, "connected");
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Gmail connection failed.";
    return back(origin, "error", message);
  }
}
