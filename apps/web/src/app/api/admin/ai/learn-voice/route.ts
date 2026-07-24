import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/admin-auth";
import { aiComplete, aiReady } from "@/lib/ai/engine";
import { getPages, getPosts } from "@/lib/cms-store";
import { isLive, tx } from "@/lib/cms-types";
import { pageText } from "@/lib/seo";

/** Learn the brand voice from the site's own published content. Returns a
 *  suggested voice description — the admin reviews and saves it. */
export async function POST(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await aiReady())) return NextResponse.json({ error: "AI isn't available yet. On Cloudflare, activate Workers AI once in your dashboard (Workers & Pages → AI) — it's free — then redeploy, or add your own AI key in the AI tab." }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  const locale = String(body.locale ?? "en");

  const [pages, posts] = await Promise.all([getPages(), getPosts()]);
  const sample = [
    ...pages.filter((p) => isLive(p)).map((p) => pageText(p, locale)),
    ...posts.filter((p) => isLive(p)).map((p) => `${tx(p.title, locale)}\n${tx(p.body, locale).replace(/<[^>]+>/g, " ")}`),
  ]
    .join("\n\n")
    .replace(/\s+/g, " ")
    .slice(0, 6000);

  if (sample.trim().length < 200) {
    return NextResponse.json({ error: "Not enough published content to learn from yet" }, { status: 422 });
  }

  try {
    const system = `You are a brand strategist. From the writing samples, describe the brand's voice in 2–3 sentences a copywriter could follow: tone, vocabulary level, sentence rhythm, what it avoids. Write the description in English. Return ONLY the description, no preamble.`;
    const { text } = await aiComplete("rewrite", { system, prompt: sample, maxTokens: 300 });
    return NextResponse.json({ voice: text.trim().replace(/^["']|["']$/g, "").slice(0, 600) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
