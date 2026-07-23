import { NextResponse } from "next/server";
import { getPages, getSettings } from "@/lib/cms-store";
import { isLive } from "@/lib/cms-types";
import { getAIConfig } from "@/lib/ai/engine";
import { assistantReply, rankContext } from "@/lib/ai/features";
import { createLead } from "@/lib/leads-store";
import { notifyLead } from "@/lib/notify";
import { pageText } from "@/lib/seo";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { dispatchWebhook } from "@/lib/webhooks";

/** If the visitor shares contact details in chat, capture them as a CRM lead
 *  (best-effort — never blocks the reply). */
async function captureLeadFromChat(message: string, history: { role?: string; text?: string }[], locale: string): Promise<boolean> {
  const email = message.match(/[\w.+-]+@[\w-]+\.[\w.-]{2,}/)?.[0] ?? "";
  const phoneDigits = (message.match(/\+?[\d\s().-]{10,}/)?.[0] ?? "").replace(/\D/g, "");
  const phone = phoneDigits.length >= 10 ? phoneDigits.slice(-10) : "";
  if (!email && !phone) return false;
  // Name: a "my name is / I'm X" pattern, else generic.
  const name = message.match(/(?:my name is|i am|i'm|je m'appelle)\s+([A-Za-zÀ-ÿ' -]{2,40})/i)?.[1]?.trim() ?? "Website chat visitor";
  const transcript = [...history.slice(-4).map((h) => `${h.role ?? "user"}: ${h.text ?? ""}`), `visitor: ${message}`].join("\n").slice(0, 1500);
  try {
    const lead = await createLead({
      locale,
      name,
      email,
      phone,
      city: "",
      projectType: "other",
      message: `From the site assistant chat:\n${transcript}`,
      read: false,
    });
    await Promise.allSettled([notifyLead(lead), dispatchWebhook("lead.created", lead)]);
    return true;
  } catch {
    return false;
  }
}

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
    .filter((p) => isLive(p))
    .map((p) => ({ title: p.title[locale] || p.title.en, text: pageText(p, locale), slug: p.slug }))
    .filter((p) => p.text.length > 20);
  const context = rankContext(message, corpus);

  // Lead capture runs in parallel with the reply — contact details in the
  // message land in the CRM even if the model call fails.
  const leadPromise = captureLeadFromChat(message, history, locale);

  try {
    const reply = await assistantReply(message, context, history, locale, settings.brandName);
    const leadCaptured = await leadPromise;
    return NextResponse.json({ reply, leadCaptured, sources: context.map((c) => ({ title: c.title, slug: c.slug })) });
  } catch (e) {
    await leadPromise;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Assistant failed" }, { status: 502 });
  }
}
