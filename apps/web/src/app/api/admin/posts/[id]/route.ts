import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/admin-auth";
import { deletePost, getPosts, savePost } from "@/lib/cms-store";
import { pingIndexNow } from "@/lib/seo";
import type { Post } from "@/lib/cms-types";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const existing = (await getPosts()).find((p) => p.id === id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = (await request.json().catch(() => null)) as Partial<Post> | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const merged: Post = {
    ...existing,
    title: body.title ?? existing.title,
    excerpt: body.excerpt ?? existing.excerpt,
    cover: body.cover ?? existing.cover,
    body: body.body ?? existing.body,
    date: body.date ?? existing.date,
    author: body.author ?? existing.author,
    slug: body.slug ?? existing.slug,
    status: body.status === "published" ? "published" : "draft",
  };
  await savePost(merged);
  if (merged.status === "published") await pingIndexNow(`blog/${merged.slug}`);
  return NextResponse.json({ post: merged });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  return NextResponse.json({ ok: await deletePost(id) });
}
