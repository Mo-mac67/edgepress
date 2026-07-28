import { NextResponse } from "next/server";
import { getRole } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { exportAll, importAll } from "@/lib/backup";
import { putMedia } from "@/lib/media-r2";
import { sandboxBlocks, sandboxReason } from "@/lib/sandbox";

export const dynamic = "force-dynamic";

async function ownerOnly() {
  return (await getRole()) === "super";
}

/** A scheduler (cron) can call the backup headlessly with ?token=<BACKUP_TOKEN>.
 *  Constant-time-ish check; only enabled when the env token is set. */
function tokenOk(request: Request): boolean {
  const expected = process.env.EDGEPRESS_BACKUP_TOKEN;
  if (!expected) return false;
  const got = new URL(request.url).searchParams.get("token") ?? "";
  return got.length === expected.length && got === expected;
}

/**
 * Download a full JSON backup. Owner (cookie) or a scheduler with ?token=.
 * With ?archive=1 the backup is written off-site to R2 (backups/…json) instead
 * of downloaded — so one daily cron call keeps rolling off-site backups.
 */
export async function GET(request: Request) {
  const authed = (await ownerOnly()) || tokenOk(request);
  if (!authed) return NextResponse.json({ error: "Owner only" }, { status: 403 });

  const backup = await exportAll();
  const json = JSON.stringify(backup, null, 2);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

  if (new URL(request.url).searchParams.get("archive") === "1") {
    const key = `backups/edgepress-${stamp}.json`;
    try {
      await putMedia(key, new TextEncoder().encode(json), "application/json");
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Archive failed (no R2?)" }, { status: 500 });
    }
    await logAudit({ action: "backup_archive", role: "super", detail: key });
    return NextResponse.json({ ok: true, archivedTo: key, docs: Object.keys(backup.docs).length });
  }

  await logAudit({ action: "backup_export", role: "super", detail: `${Object.keys(backup.docs).length} docs` });
  return new NextResponse(json, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="edgepress-backup-${stamp.slice(0, 10)}.json"`,
    },
  });
}

/** Restore from an uploaded backup (overwrites matching documents). */
export async function POST(request: Request) {
  if (!(await ownerOnly())) return NextResponse.json({ error: "Owner only" }, { status: 403 });
  // Downloading a backup of the demo is fine; uploading one over it is not —
  // that's how a visitor would replace the sandbox with arbitrary content.
  if (sandboxBlocks("restore-backup")) {
    return NextResponse.json({ error: sandboxReason("restore-backup") }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  try {
    const { restored } = await importAll(body);
    await logAudit({ action: "backup_restore", role: "super", detail: `${restored} docs` });
    return NextResponse.json({ ok: true, restored });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Restore failed" }, { status: 422 });
  }
}
