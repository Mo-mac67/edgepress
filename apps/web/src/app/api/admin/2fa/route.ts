import { NextResponse } from "next/server";
import { confirmTotpForCurrent, disableTotpForCurrent, getRole, getTotpStatusForCurrent, isAuthed, startTotpForCurrent } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";

/** 2FA for whoever is signed in: the owner (config) or a team member (their own
 *  user record). Any authenticated admin can manage their OWN second factor. */
export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await getTotpStatusForCurrent());
}

export async function POST(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = await getRole();
  const body = await request.json().catch(() => ({}));

  if (body.action === "start") {
    const setup = await startTotpForCurrent();
    if (!setup) return NextResponse.json({ error: "Could not start setup" }, { status: 400 });
    return NextResponse.json(setup);
  }
  if (body.action === "confirm") {
    const ok = await confirmTotpForCurrent(String(body.code ?? ""));
    if (ok) await logAudit({ action: "2fa_enabled", role });
    return NextResponse.json({ ok }, { status: ok ? 200 : 422 });
  }
  if (body.action === "disable") {
    await disableTotpForCurrent();
    await logAudit({ action: "2fa_disabled", role });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
