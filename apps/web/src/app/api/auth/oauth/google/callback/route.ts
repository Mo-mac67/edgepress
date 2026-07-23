import { NextResponse } from "next/server";
import { signInAsOwnerSso } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { allowedEmails, googleEmailFromCode, isValidState, oauthGoogleEnabled } from "@/lib/oauth";

export const dynamic = "force-dynamic";

/** Completes Google sign-in: verify state, exchange the code, check the email
 *  allowlist, then start an owner session. Failures land back on /en/admin. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = process.env.SITE_URL ?? url.origin;
  const fail = (reason: string) => NextResponse.redirect(`${origin}/en/admin?sso=${reason}`);

  if (!oauthGoogleEnabled()) return fail("off");
  if (!isValidState(url.searchParams.get("state"))) return fail("state");
  const code = url.searchParams.get("code");
  if (!code) return fail("denied");

  const email = await googleEmailFromCode(code, `${origin}/api/auth/oauth/google/callback`);
  if (!email) return fail("google");
  if (!allowedEmails().includes(email)) {
    await logAudit({ action: "sso_rejected", role: null, detail: email });
    return fail("email");
  }
  if (!(await signInAsOwnerSso())) return fail("setup");
  await logAudit({ action: "sso_login", role: "super", detail: email });
  return NextResponse.redirect(`${origin}/en/admin`);
}
