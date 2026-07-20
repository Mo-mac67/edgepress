import { NextResponse } from "next/server";
import { getRole, isAuthed } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { deleteEntry, getEntry, updateEntry } from "@/lib/content-store";
import { dispatchWebhook } from "@/lib/webhooks";

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug, id } = await params;
  const before = await getEntry(slug, id);
  const body = await request.json().catch(() => ({}));
  const entry = await updateEntry(slug, id, { slug: body.slug, status: body.status, data: body.data });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await logAudit({ action: "entry_update", role: await getRole(), detail: `${slug}/${entry.slug}` });
  await dispatchWebhook("entry.updated", entry);
  if (entry.status === "published" && before?.status !== "published") await dispatchWebhook("entry.published", entry);
  return NextResponse.json({ entry });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug, id } = await params;
  const ok = await deleteEntry(slug, id);
  if (ok) {
    await logAudit({ action: "entry_delete", role: await getRole(), detail: `${slug}/${id}` });
    await dispatchWebhook("entry.deleted", { type: slug, id });
  }
  return NextResponse.json({ ok });
}
