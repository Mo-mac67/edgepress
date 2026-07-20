import { NextResponse } from "next/server";
import { getRole, isAuthed } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { createForm, getForms } from "@/lib/forms-store";

export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ forms: await getForms() });
}

export async function POST(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const result = await createForm({ name: body.name, slug: body.slug, fields: body.fields, submitLabel: body.submitLabel, successMessage: body.successMessage });
  if ("error" in result) return NextResponse.json(result, { status: 422 });
  await logAudit({ action: "form_create", role: await getRole(), detail: result.slug });
  return NextResponse.json({ form: result }, { status: 201 });
}
