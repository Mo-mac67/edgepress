import { NextResponse } from "next/server";
import { getRole, isAuthed } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { duplicatePage } from "@/lib/cms-store";

/** Copy a page as a new draft with a "-copy" slug. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const page = await duplicatePage(id);
  if (!page) return NextResponse.json({ error: "Page not found" }, { status: 404 });
  await logAudit({ action: "page_duplicate", role: await getRole(), detail: page.slug });
  return NextResponse.json({ page }, { status: 201 });
}
