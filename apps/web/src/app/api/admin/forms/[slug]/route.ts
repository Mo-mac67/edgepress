import { NextResponse } from "next/server";
import { getRole, isAuthed } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { deleteForm, updateForm } from "@/lib/forms-store";

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug } = await params;
  const body = await request.json().catch(() => ({}));
  const form = await updateForm(slug, { name: body.name, fields: body.fields, submitLabel: body.submitLabel, successMessage: body.successMessage });
  if (!form) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await logAudit({ action: "form_update", role: await getRole(), detail: slug });
  return NextResponse.json({ form });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug } = await params;
  const ok = await deleteForm(slug);
  if (ok) await logAudit({ action: "form_delete", role: await getRole(), detail: slug });
  return NextResponse.json({ ok });
}
