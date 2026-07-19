import { NextResponse } from "next/server";
import { getPages, getSettings } from "@/lib/cms-store";
import { getAIConfig } from "@/lib/ai/engine";
import { assistantReply, rankContext } from "@/lib/ai/features";
import { pageText } from "@/lib/seo";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Public visitor-assistant endpoint: RAG chat grounded in the site's pages. */
export async function POST(request: Request) {
  const cfg = await getAIConfig();
  if (!cfg.enabled || !cfg.assistantEnabled) return NextResponse.json({ error: "Assistant is off" }, { status: 404 });

  if (!rateLimit(`assistant:${clientIp(request)}`, 15, 60_000)) {
    return NextResponse.json({ error: "Too many messages — please slow down." }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const message = String(body.message ?? "").slice(0, 800).trim();
  const locale = body.locale === "fr" ? "fr" : "en";
  const history = Array.isArray(body.history) ? body.history.slice(-6) : [];
  if (!message) return NextResponse.json({ error: "Empty message" }, { status: 422 });

  const [pages, settings] = await Promise.all([getPages(), getSettings()]);
  const corpus = pages
    .filter((p) => p.status === "published")
    .map((p) => ({ title: p.title[locale] || p.title.en, text: pageText(p, locale), slug: p.slug }))
    .filter((p) => p.text.length > 20);
  const context = rankContext(message, corpus);

  try {
    const reply = await assistantReply(message, context, history, locale, settings.brandName);
    return NextResponse.json({ reply, sources: context.map((c) => ({ title: c.title, slug: c.slug })) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Assistant failed" }, { status: 502 });
  }
}
