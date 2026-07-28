import { NextResponse } from "next/server";
import { getRole } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { captureSnapshot, getSandboxState, hasSnapshot, isSandbox, resetSandbox, sandboxResetMinutes } from "@/lib/sandbox";

export const dynamic = "force-dynamic";

async function ownerOnly() {
  return (await getRole()) === "super";
}

/** Sandbox status for the admin panel. */
export async function GET() {
  if (!(await ownerOnly())) return NextResponse.json({ error: "Owner only" }, { status: 403 });
  return NextResponse.json({
    enabled: isSandbox(),
    resetMinutes: sandboxResetMinutes(),
    hasSnapshot: await hasSnapshot(),
    ...(await getSandboxState()),
  });
}

/**
 * `snapshot` — freeze the current content as the state every reset returns to.
 * `reset`    — restore it now, without waiting for the cron.
 */
export async function POST(request: Request) {
  if (!(await ownerOnly())) return NextResponse.json({ error: "Owner only" }, { status: 403 });
  if (!isSandbox()) {
    return NextResponse.json({ error: "Set EDGEPRESS_SANDBOX=1 to use sandbox mode." }, { status: 400 });
  }
  const { action } = (await request.json().catch(() => ({}))) as { action?: string };

  if (action === "snapshot") {
    const { keys } = await captureSnapshot();
    await logAudit({ action: "sandbox_snapshot", role: "super", detail: `${keys} docs` });
    return NextResponse.json({ ok: true, keys });
  }
  if (action === "reset") {
    const result = await resetSandbox();
    if (!result) return NextResponse.json({ error: "No snapshot captured yet." }, { status: 409 });
    await logAudit({ action: "sandbox_reset", role: "super", detail: `${result.restored} docs` });
    return NextResponse.json({ ok: true, restored: result.restored });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
