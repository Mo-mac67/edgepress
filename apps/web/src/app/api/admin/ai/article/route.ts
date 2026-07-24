import { NextResponse } from "next/server";
import { getRole, isAuthed } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { aiReady } from "@/lib/ai/engine";
import { writeArticle } from "@/lib/ai/features";
import { blankPost, getPosts, savePost } from "@/lib/cms-store";
import { slugify } from "@/lib/content-store";

/** Generate a full blog article from a topic and save it as a draft post. */
export async function POST(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await aiReady())) return NextResponse.json({ error: "AI isn't available yet. On Cloudflare, activate Workers AI once in your dashboard (Workers & Pages → AI) — it's free — then redeploy, or add your own AI key in the AI tab." }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  const topic = String(body.topic ?? "").trim();
  if (!topic) return NextResponse.json({ error: "Enter a topic" }, { status: 422 });
  const locale = String(body.locale ?? "en");

  try {
    const article = await writeArticle(topic, locale);
    const posts = await getPosts();
    let slug = slugify(article.title) || "article";
    if (posts.some((p) => p.slug === slug)) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

    const post = blankPost(slug, article.title);
    post.status = "draft";
    post.title = { ...post.title, [locale]: article.title };
    post.excerpt = { ...post.excerpt, [locale]: article.excerpt };
    post.body = { ...post.body, [locale]: article.body };
    await savePost(post);
    await logAudit({ action: "ai_article_write", role: await getRole(), detail: topic.slice(0, 60) });
    return NextResponse.json({ post, keywords: article.keywords }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Article generation failed" }, { status: 500 });
  }
}
