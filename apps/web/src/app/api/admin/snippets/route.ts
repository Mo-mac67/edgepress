import { NextResponse } from "next/server";
import { getRole, isAuthed } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { deleteSnippet, getSnippets, saveSnippet } from "@/lib/snippets-store";

export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ snippets: await getSnippets() });
}

/** Create or update (same name = update). */
export async function POST(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const result = await saveSnippet({ name: body.name, html: body.html });
  if ("error" in result) return NextResponse.json(result, { status: 422 });
  await logAudit({ action: "snippet_save", role: await getRole(), detail: result.name });
  return NextResponse.json({ snippet: result }, { status: 201 });
}

export async function DELETE(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const ok = await deleteSnippet(id);
  if (ok) await logAudit({ action: "snippet_delete", role: await getRole(), detail: id });
  return NextResponse.json({ ok });
}
