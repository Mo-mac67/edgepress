import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/admin-auth";
import { removeMedia } from "@/lib/cms-store";
import { deleteMediaBlob } from "@/lib/media-r2";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const item = await removeMedia(id);
  if (item) await deleteMediaBlob(item.key);
  return NextResponse.json({ ok: !!item });
}
