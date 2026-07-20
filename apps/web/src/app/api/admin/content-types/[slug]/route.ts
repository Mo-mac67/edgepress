import { NextResponse } from "next/server";
import { getRole } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { deleteContentType, updateContentType } from "@/lib/content-store";

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if ((await getRole()) !== "super") return NextResponse.json({ error: "Owner only" }, { status: 403 });
  const { slug } = await params;
  const body = await request.json().catch(() => ({}));
  const type = await updateContentType(slug, { name: body.name, icon: body.icon, fields: body.fields });
  if (!type) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await logAudit({ action: "content_type_update", role: "super", detail: slug });
  return NextResponse.json({ type });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if ((await getRole()) !== "super") return NextResponse.json({ error: "Owner only" }, { status: 403 });
  const { slug } = await params;
  const ok = await deleteContentType(slug);
  if (ok) await logAudit({ action: "content_type_delete", role: "super", detail: slug });
  return NextResponse.json({ ok });
}
