import { NextResponse } from "next/server";
import { getRole, isAuthed } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { deleteForumItem, getAllReplies, getAllThreads, moderateForumItem } from "@/lib/forum-store";

export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [threads, replies] = await Promise.all([getAllThreads(), getAllReplies()]);
  return NextResponse.json({ threads, replies });
}

/** Moderate: { kind: "thread"|"reply", id, status: "approved"|"pending" }. */
export async function PATCH(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const kind = body.kind === "reply" ? "reply" : "thread";
  const status = body.status === "approved" ? "approved" : "pending";
  const ok = await moderateForumItem(kind, String(body.id ?? ""), status);
  if (ok) await logAudit({ action: "forum_moderate", role: await getRole(), detail: `${kind} ${body.id} → ${status}` });
  return NextResponse.json({ ok });
}

export async function DELETE(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") === "reply" ? "reply" : "thread";
  const id = url.searchParams.get("id") ?? "";
  const ok = await deleteForumItem(kind, id);
  if (ok) await logAudit({ action: "forum_delete", role: await getRole(), detail: `${kind} ${id}` });
  return NextResponse.json({ ok });
}
