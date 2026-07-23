import { NextResponse } from "next/server";
import { getRole, isAuthed } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { deleteComment, setCommentStatus } from "@/lib/comments-store";

/** Moderate: { status: "approved" | "pending" }. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const status = body.status === "approved" ? "approved" : "pending";
  const ok = await setCommentStatus(id, status);
  if (ok) await logAudit({ action: "comment_moderate", role: await getRole(), detail: `${id} → ${status}` });
  return NextResponse.json({ ok });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const ok = await deleteComment(id);
  if (ok) await logAudit({ action: "comment_delete", role: await getRole(), detail: id });
  return NextResponse.json({ ok });
}
