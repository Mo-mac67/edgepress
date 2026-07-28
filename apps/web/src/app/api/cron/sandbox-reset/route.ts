import { NextResponse } from "next/server";
import { isSandbox, resetSandbox, getSandboxState } from "@/lib/sandbox";

/**
 * Puts the sandbox back to its snapshot. Point a Cloudflare cron trigger (or
 * any pinger) at it:
 *   GET /api/cron/sandbox-reset?key=YOUR_CRON_SECRET
 *
 * Refuses unless EDGEPRESS_SANDBOX=1, so hitting this URL on a real site can
 * never roll someone's content back.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const key = new URL(request.url).searchParams.get("key");
  if (!secret || key !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSandbox()) {
    return NextResponse.json({ error: "Not a sandbox instance" }, { status: 400 });
  }

  const result = await resetSandbox();
  if (!result) {
    return NextResponse.json(
      { ok: false, error: "No snapshot yet — capture one from Settings → Sandbox first." },
      { status: 409 },
    );
  }
  const state = await getSandboxState();
  return NextResponse.json({ ok: true, restored: result.restored, resets: state.resets, at: state.lastResetAt });
}
