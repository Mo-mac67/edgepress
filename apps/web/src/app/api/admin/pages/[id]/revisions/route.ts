import { NextResponse } from "next/server";
import { getRole, isAuthed } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { getRevisions, restoreRevision } from "@/lib/cms-store";

/** List the saved version history for a page. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  return NextResponse.json({ revisions: await getRevisions(id) });
}

/** Restore a specific revision (the current state is snapshotted first). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const page = await restoreRevision(id, String(body.revisionId ?? ""));
  if (!page) return NextResponse.json({ error: "Revision not found" }, { status: 404 });
  await logAudit({ action: "page_restore", role: await getRole(), detail: page.slug || "home" });
  return NextResponse.json({ page });
}
