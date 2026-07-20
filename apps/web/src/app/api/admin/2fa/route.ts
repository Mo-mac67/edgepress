import { NextResponse } from "next/server";
import { confirmTotp, disableTotp, getRole, getTotpStatus, isAuthed, startTotpSetup } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";

async function ownerOnly(): Promise<boolean> {
  return (await isAuthed()) && (await getRole()) === "super";
}

export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await getTotpStatus());
}

export async function POST(request: Request) {
  if (!(await ownerOnly())) return NextResponse.json({ error: "Owner only" }, { status: 403 });
  const body = await request.json().catch(() => ({}));

  if (body.action === "start") {
    return NextResponse.json(await startTotpSetup("owner"));
  }
  if (body.action === "confirm") {
    const ok = await confirmTotp(String(body.code ?? ""));
    if (ok) await logAudit({ action: "2fa_enabled", role: "super" });
    return NextResponse.json({ ok }, { status: ok ? 200 : 422 });
  }
  if (body.action === "disable") {
    await disableTotp();
    await logAudit({ action: "2fa_disabled", role: "super" });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
