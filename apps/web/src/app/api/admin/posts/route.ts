import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/admin-auth";
import { blankPost, getPosts, savePost } from "@/lib/cms-store";

export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ posts: await getPosts() });
}

export async function POST(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const slug = String(body.slug ?? "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "");
  const title = String(body.title ?? "Untitled").trim().slice(0, 140);
  if (!slug) return NextResponse.json({ error: "Slug required" }, { status: 422 });
  const posts = await getPosts();
  if (posts.some((p) => p.slug === slug)) return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
  const post = blankPost(slug, title);
  await savePost(post);
  return NextResponse.json({ post }, { status: 201 });
}
