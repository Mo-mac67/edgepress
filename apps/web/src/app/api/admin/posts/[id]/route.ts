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
    // Partial updates (e.g. restore, schedule) must not flip publish state.
    status: body.status === "published" ? "published" : body.status === "draft" ? "draft" : existing.status,
    publishAt: body.publishAt === null ? undefined : typeof body.publishAt === "string" && body.publishAt ? body.publishAt : existing.publishAt,
  };
  // Taxonomy: lowercase slugs, deduped, capped.
  const tax = (v: unknown, cur?: string[]) =>
    Array.isArray(v)
      ? [...new Set(v.map((s) => String(s).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")).filter(Boolean))].slice(0, 10)
      : cur;
  merged.categories = tax(body.categories, existing.categories);
  merged.tags = tax(body.tags, existing.tags);
  // Restore from Trash via trashed:false.
  if ((body as { trashed?: boolean }).trashed === false) {
    merged.trashed = undefined;
    merged.trashedAt = undefined;
  }
  await savePost(merged);
  if (merged.status === "published") await pingIndexNow(`blog/${merged.slug}`);
  return NextResponse.json({ post: merged });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const force = new URL(req.url).searchParams.get("force") === "1";
  return NextResponse.json({ ok: await deletePost(id, force) });
}
