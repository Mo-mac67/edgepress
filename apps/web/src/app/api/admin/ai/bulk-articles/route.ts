import { NextResponse } from "next/server";
import { getRole, isAuthed } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { aiReady } from "@/lib/ai/engine";
import { writeArticle } from "@/lib/ai/features";
import { blankPost, getPosts, savePost } from "@/lib/cms-store";
import { slugify } from "@/lib/content-store";

// Cap per request — each article is a heavy AI call; more than this risks the
// Workers request-duration limit. Run again for the next batch.
const MAX = 3;

/** Bulk-generate draft articles from a list of topics (one per line / CSV). */
export async function POST(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await aiReady())) return NextResponse.json({ error: "AI is not configured" }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  const locale = String(body.locale ?? "en");
  const topics = String(body.csv ?? "")
    .split(/[\r\n]+/)
    .map((line) => line.replace(/^["']|["']$/g, "").split(",")[0].trim())
    .filter(Boolean)
    .slice(0, MAX);
  if (topics.length === 0) return NextResponse.json({ error: "No topics found" }, { status: 422 });

  const posts = await getPosts();
  const used = new Set(posts.map((p) => p.slug));
  const created: string[] = [];
  for (const topic of topics) {
    try {
      const art = await writeArticle(topic, locale);
      let slug = slugify(art.title) || slugify(topic) || "article";
      while (used.has(slug)) slug = `${slug}-${Date.now().toString(36).slice(-3)}`;
      used.add(slug);
      const post = blankPost(slug, art.title);
      post.status = "draft";
      post.title = { ...post.title, [locale]: art.title };
      post.excerpt = { ...post.excerpt, [locale]: art.excerpt };
      post.body = { ...post.body, [locale]: art.body };
      await savePost(post);
      created.push(art.title);
    } catch {
      /* skip this topic, keep going */
    }
  }

  await logAudit({ action: "ai_bulk_articles", role: await getRole(), detail: `${created.length} drafts` });
  return NextResponse.json({ ok: true, created: created.length, titles: created, capped: topics.length === MAX });
}
