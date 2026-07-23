import { NextResponse } from "next/server";
import { getRole, isAuthed } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { duplicatePost } from "@/lib/cms-store";

/** Copy a post as a new draft with a "-copy" slug. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const post = await duplicatePost(id);
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  await logAudit({ action: "post_duplicate", role: await getRole(), detail: post.slug });
  return NextResponse.json({ post }, { status: 201 });
}
