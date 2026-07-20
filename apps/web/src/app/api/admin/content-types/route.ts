import { NextResponse } from "next/server";
import { getRole, isAuthed } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { getContentTypes, saveContentType } from "@/lib/content-store";

export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ types: await getContentTypes() });
}

export async function POST(request: Request) {
  // Defining a content type is structural — owner only.
  if ((await getRole()) !== "super") return NextResponse.json({ error: "Owner only" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const result = await saveContentType({ name: body.name, slug: body.slug, icon: body.icon, fields: body.fields });
  if ("error" in result) return NextResponse.json(result, { status: 422 });
  await logAudit({ action: "content_type_create", role: "super", detail: result.slug });
  return NextResponse.json({ type: result }, { status: 201 });
}
