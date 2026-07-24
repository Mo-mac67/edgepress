import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/admin-auth";
import { aiReady } from "@/lib/ai/engine";
import { diagnoseSeo } from "@/lib/ai/features";
import { getPages } from "@/lib/cms-store";
import { tx } from "@/lib/cms-types";
import { pageText } from "@/lib/seo";

/** AI SEO diagnosis for one page — "why won't this rank, and how to fix it." */
export async function POST(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await aiReady())) return NextResponse.json({ error: "AI isn't available yet. On Cloudflare, activate Workers AI once in your dashboard (Workers & Pages → AI) — it's free — then redeploy, or add your own AI key in the AI tab." }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  const locale = String(body.locale ?? "en");
  const page = (await getPages()).find((p) => p.id === body.pageId);
  if (!page) return NextResponse.json({ error: "Page not found" }, { status: 404 });

  try {
    const result = await diagnoseSeo({
      title: tx(page.title, locale) || page.slug || "Home",
      description: tx(page.description, locale),
      keywords: page.seo?.keywords ?? "",
      slug: page.slug,
      text: pageText(page, locale),
      locale,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Diagnosis failed" }, { status: 500 });
  }
}
