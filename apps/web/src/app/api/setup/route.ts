import { NextResponse } from "next/server";
import { completeSetup, isSetupDone, signIn } from "@/lib/admin-auth";
import { getSettings, saveSettings } from "@/lib/cms-store";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function GET() {
  return NextResponse.json({ done: await isSetupDone() });
}

/** First-run setup: set the admin password + site name, then sign in. Refuses
 *  once setup is already done (so it can't be used to reset the password). */
export async function POST(request: Request) {
  if (!rateLimit(`setup:${clientIp(request)}`, 5, 60_000)) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }
  if (await isSetupDone()) return NextResponse.json({ error: "Setup already completed" }, { status: 409 });

  const body = await request.json().catch(() => ({}));
  const password = String(body.password ?? "");
  const siteName = String(body.siteName ?? "").trim();
  if (password.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 422 });

  const ok = await completeSetup(password);
  if (!ok) return NextResponse.json({ error: "Could not save setup" }, { status: 500 });

  if (siteName) {
    const settings = await getSettings();
    await saveSettings({ ...settings, brandName: siteName });
  }

  await signIn(password); // sets the auth cookie so they land in the panel
  return NextResponse.json({ ok: true });
}
