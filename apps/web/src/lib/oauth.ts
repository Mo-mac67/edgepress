import "server-only";
import { createHmac } from "node:crypto";

/**
 * "Sign in with Google" for the admin — BYOK OAuth (the owner creates their
 * own Google OAuth client; nothing ships pre-wired). Enabled only when all
 * three env vars are set:
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
 *   OAUTH_ALLOWED_EMAILS  (comma-separated owner emails — the allowlist)
 * SSO signs in as the owner (super); Google account security replaces
 * password+TOTP for this path.
 */

export function oauthGoogleEnabled(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.OAUTH_ALLOWED_EMAILS);
}

export function allowedEmails(): string[] {
  return (process.env.OAUTH_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

// ─── CSRF state (signed, stateless — survives multi-isolate Workers) ────
const secret = () => process.env.ADMIN_SECRET ?? "dev-secret-change-me";

export function makeState(nowMs = Date.now()): string {
  const ts = String(nowMs);
  const sig = createHmac("sha256", secret()).update(`oauth:${ts}`).digest("hex").slice(0, 24);
  return `${ts}.${sig}`;
}

export function isValidState(state: string | null, nowMs = Date.now(), maxAgeMs = 10 * 60_000): boolean {
  if (!state) return false;
  const [ts, sig] = state.split(".");
  if (!ts || !sig) return false;
  const expected = createHmac("sha256", secret()).update(`oauth:${ts}`).digest("hex").slice(0, 24);
  if (sig !== expected) return false;
  const age = nowMs - Number(ts);
  return Number.isFinite(age) && age >= 0 && age <= maxAgeMs;
}

// ─── Google endpoints (plain fetch, no SDK) ─────────────
export function googleAuthUrl(redirectUri: string, state: string): string {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email",
    state,
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

/** Exchanges the auth code and returns the verified account email, or null. */
export async function googleEmailFromCode(code: string, redirectUri: string): Promise<string | null> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });
  const token = await tokenRes.json().catch(() => null);
  if (!tokenRes.ok || !token?.access_token) return null;
  // userinfo over TLS with the token we just obtained = verified email.
  const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const info = await infoRes.json().catch(() => null);
  if (!infoRes.ok || !info?.email || info.email_verified === false) return null;
  return String(info.email).toLowerCase();
}
