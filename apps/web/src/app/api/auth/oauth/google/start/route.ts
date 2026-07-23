import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { googleAuthUrl, makeState, oauthGoogleEnabled } from "@/lib/oauth";

export const dynamic = "force-dynamic";

/** Kicks off the Google OAuth flow with a signed CSRF state. */
export async function GET(request: Request) {
  if (!oauthGoogleEnabled()) return NextResponse.json({ error: "SSO not configured" }, { status: 404 });
  if (!rateLimit(`oauth:${clientIp(request)}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }
  const origin = process.env.SITE_URL ?? new URL(request.url).origin;
  const redirectUri = `${origin}/api/auth/oauth/google/callback`;
  return NextResponse.redirect(googleAuthUrl(redirectUri, makeState()));
}
