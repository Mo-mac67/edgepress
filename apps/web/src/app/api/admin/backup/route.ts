import { NextResponse } from "next/server";
import { getRole } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { exportAll, importAll } from "@/lib/backup";

export const dynamic = "force-dynamic";

async function ownerOnly() {
  return (await getRole()) === "super";
}

/** Download a full JSON backup of every stored document. */
export async function GET() {
  if (!(await ownerOnly())) return NextResponse.json({ error: "Owner only" }, { status: 403 });
  const backup = await exportAll();
  await logAudit({ action: "backup_export", role: "super", detail: `${Object.keys(backup.docs).length} docs` });
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="edgepress-backup-${stamp}.json"`,
    },
  });
}

/** Restore from an uploaded backup (overwrites matching documents). */
export async function POST(request: Request) {
  if (!(await ownerOnly())) return NextResponse.json({ error: "Owner only" }, { status: 403 });
  const body = await request.json().catch(() => null);
  try {
    const { restored } = await importAll(body);
    await logAudit({ action: "backup_restore", role: "super", detail: `${restored} docs` });
    return NextResponse.json({ ok: true, restored });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Restore failed" }, { status: 422 });
  }
}
