import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/admin-auth";
import { getPages } from "@/lib/cms-store";
import { previewToken } from "@/lib/preview";

/** A shareable signed URL that renders this page's draft without logging in. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const page = (await getPages()).find((p) => p.id === id);
  if (!page) return NextResponse.json({ error: "Page not found" }, { status: 404 });
  const token = previewToken(page.id);
  return NextResponse.json({ token, path: `/${page.slug}?preview=${token}` });
}
