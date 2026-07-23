import { NextResponse } from "next/server";
import { getRole, isAuthed } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { deleteRedirect, getRedirects, saveRedirect } from "@/lib/redirects-store";

export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ redirects: await getRedirects() });
}

export async function POST(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const result = await saveRedirect({ from: body.from, to: body.to, code: body.code });
  if ("error" in result) return NextResponse.json(result, { status: 422 });
  await logAudit({ action: "redirect_create", role: await getRole(), detail: `${result.from} → ${result.to}` });
  return NextResponse.json({ redirect: result }, { status: 201 });
}

export async function DELETE(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const ok = await deleteRedirect(id);
  if (ok) await logAudit({ action: "redirect_delete", role: await getRole(), detail: id });
  return NextResponse.json({ ok });
}
