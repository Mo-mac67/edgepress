import "server-only";
import { aiComplete, extractJson, getAIConfig } from "./engine";
import { newBlock, BLOCKS, type Block, type BlockType, type Localized, type Page } from "@/lib/cms-types";

type LocalizedObj = Record<string, string>;
function isLocalized(v: unknown): v is LocalizedObj {
  return !!v && typeof v === "object" && !Array.isArray(v) && "en" in (v as object) && "fr" in (v as object);
}
/** Collect every Localized leaf in a page (title, description, block data). */
function localizedLeaves(page: Page): LocalizedObj[] {
  const leaves: LocalizedObj[] = [];
  const visit = (obj: unknown) => {
    if (Array.isArray(obj)) return obj.forEach(visit);
    if (obj && typeof obj === "object") {
      if (isLocalized(obj)) return void leaves.push(obj as LocalizedObj);
      for (const v of Object.values(obj as Record<string, unknown>)) visit(v);
    }
  };
  visit(page.title);
  visit(page.description);
  page.blocks.forEach((b) => visit(b.data));
  return leaves;
}

/** Translate a whole page's fields from one locale to another, in place on a
 *  clone. Only fills the target locale; leaves the source untouched. */
export async function translatePage(page: Page, from: string, to: string): Promise<Page> {
  const clone: Page = structuredClone(page);
  const leaves = localizedLeaves(clone).filter((l) => (l[from] ?? "").trim());
  const sources = leaves.map((l) => l[from]);
  const translated = await translateBatch(sources, from, to);
  leaves.forEach((l, i) => {
    l[to] = translated[i] ?? l[to] ?? "";
  });
  return clone;
}

// Block types the generator is allowed to emit, with a terse field guide.
const GEN_BLOCKS: { type: BlockType; fields: string }[] = [
  { type: "hero", fields: "eyebrow, title, subtitle, primaryLabel, primaryHref, secondaryLabel, secondaryHref, stars(bool)" },
  { type: "header", fields: "eyebrow, title, subtitle, align('center'|'left')" },
  { type: "richtext", fields: "html (simple HTML: <p>, <h2>, <ul><li>)" },
  { type: "cards", fields: "title, subtitle, items:[{icon(one of: check,star,shield,hammer,clock,award,chart,mail,refresh,edit,building,phone), title, text}]" },
  { type: "steps", fields: "title, subtitle, items:[{step('01'..), title, text}]" },
  { type: "gallery", fields: "title, subtitle, items:[{image(''), title, caption}]" },
  { type: "faq", fields: "title, items:[{q, a}]" },
  { type: "cta", fields: "eyebrow, title, subtitle, buttonLabel, buttonHref" },
  { type: "contactForm", fields: "title, subtitle" },
];

function brandVoiceLine(voice: string): string {
  return voice ? `\nBrand voice to match: ${voice}\n` : "";
}

/** Wrap plain generated strings into Localized values under the given locale. */
function wrapLocalized(data: Record<string, unknown>, locale: string): Record<string, unknown> {
  const def = BLOCKS[data.type as BlockType]?.defaults?.() ?? {};
  const out: Record<string, unknown> = { ...def };
  const src = (data.data ?? {}) as Record<string, unknown>;
  for (const [k, v] of Object.entries(src)) {
    const defVal = (def as Record<string, unknown>)[k];
    if (defVal && typeof defVal === "object" && !Array.isArray(defVal) && "en" in (defVal as object)) {
      out[k] = { en: "", fr: "", [locale]: typeof v === "string" ? v : "" } as Localized;
    } else if (Array.isArray(defVal) && Array.isArray(v)) {
      // list field: wrap each item's localized sub-fields
      out[k] = v.map((item) => {
        if (item && typeof item === "object") {
          const o: Record<string, unknown> = {};
          for (const [ik, iv] of Object.entries(item as Record<string, unknown>)) {
            o[ik] = typeof iv === "string" && ik !== "icon" && ik !== "image" && ik !== "step" && ik !== "value" && ik !== "primaryHref" && ik !== "href" ? { en: "", fr: "", [locale]: iv } : iv;
          }
          return o;
        }
        return item;
      });
    } else {
      out[k] = v;
    }
  }
  return out;
}

/** Content Studio: a natural-language prompt → a full list of page blocks. */
export async function generatePageBlocks(prompt: string, locale: string): Promise<Block[]> {
  const cfg = await getAIConfig();
  const schema = GEN_BLOCKS.map((b) => `- ${b.type}: ${b.fields}`).join("\n");
  const system = `You are EdgePress's page designer. Build a landing page as a JSON array of blocks.
Only use these block types:
${schema}
Rules:
- Output ONLY JSON: {"blocks":[{"type":"hero","data":{...}}, ...]}
- Localized text fields are plain strings written in ${locale === "fr" ? "French" : "English"} (no nested objects).
- Start with a hero. Use 4-7 blocks total. Include a cta near the end.
- Keep copy concise, concrete and compelling. Do not invent contact details or fake stats.${brandVoiceLine(cfg.brandVoice)}`;

  const { text } = await aiComplete("pageGenerate", { system, prompt, json: true, maxTokens: 2000 });
  const parsed = extractJson<{ blocks: { type: string; data: Record<string, unknown> }[] }>(text);
  const list = Array.isArray(parsed) ? (parsed as unknown as { type: string; data: Record<string, unknown> }[]) : parsed.blocks ?? [];

  const blocks: Block[] = [];
  for (const raw of list.slice(0, 12)) {
    const type = raw.type as BlockType;
    if (!BLOCKS[type]) continue;
    const b = newBlock(type);
    b.data = wrapLocalized({ type, data: raw.data }, locale);
    blocks.push(b);
  }
  return blocks;
}

export type WriteMode = "rewrite" | "expand" | "shorten" | "professional" | "friendly" | "fix";
const MODE_INSTRUCTION: Record<WriteMode, string> = {
  rewrite: "Rewrite this text to be clearer and more engaging, keeping the same meaning and length.",
  expand: "Expand this text with more useful detail, keeping the same tone.",
  shorten: "Make this text more concise while keeping the key message.",
  professional: "Rewrite this text in a polished, professional tone.",
  friendly: "Rewrite this text in a warm, friendly, approachable tone.",
  fix: "Fix any spelling and grammar mistakes. Return the corrected text only.",
};

/** Rewrite / tone / expand a single field's text. */
export async function writeText(mode: WriteMode, text: string, locale: string): Promise<string> {
  const cfg = await getAIConfig();
  const system = `You are an expert copywriter. ${MODE_INSTRUCTION[mode]} Write in ${locale === "fr" ? "French" : "English"}. Return ONLY the resulting text, with no preamble, quotes or explanation.${brandVoiceLine(cfg.brandVoice)}`;
  const { text: out } = await aiComplete("rewrite", { system, prompt: text, maxTokens: 900 });
  return out.trim().replace(/^["']|["']$/g, "");
}

/** Translate a batch of strings from one locale to another (one AI call). */
export async function translateBatch(strings: string[], from: string, to: string): Promise<string[]> {
  if (strings.length === 0) return [];
  const cfg = await getAIConfig();
  const system = `You are a professional website translator. Translate each string from ${from} to ${to}. Adapt naturally for the target culture — do not translate literally. Preserve any HTML tags and {placeholders}. Return ONLY a JSON array of translated strings in the same order and length as the input.${brandVoiceLine(cfg.brandVoice)}`;
  const { text } = await aiComplete("translate", { system, prompt: JSON.stringify(strings), json: true, maxTokens: 3000 });
  const arr = extractJson<string[]>(text);
  if (!Array.isArray(arr) || arr.length !== strings.length) return strings;
  return arr.map((s) => (typeof s === "string" ? s : ""));
}

// ─── AI Site Builder ────────────────────────────────────
export interface SitePlan {
  brandName: string;
  tagline: string;
  theme: { brand: string; brandDark: string; accent: string; fontPair: "modern" | "elegant" | "bold" | "minimal" | "editorial"; radius: "sharp" | "soft" | "round"; headerStyle: "light" | "dark" };
  nav: { label: string; slug: string }[];
  pages: { slug: string; title: string; intent: string }[];
}

/** Plan a whole site from a one-line business description. */
export async function generateSitePlan(description: string, locale: string): Promise<SitePlan> {
  const system = `You are EdgePress's site architect. From a business description, plan a small marketing website.
Return ONLY JSON:
{"brandName":"...","tagline":"short tagline in ${locale === "fr" ? "French" : "English"}","theme":{"brand":"#hex (deep primary)","brandDark":"#hex (darker)","accent":"#hex (vivid accent)","fontPair":"modern|elegant|bold|minimal|editorial","radius":"sharp|soft|round","headerStyle":"light|dark"},"nav":[{"label":"Home","slug":""},{"label":"...","slug":"..."}],"pages":[{"slug":"","title":"Home","intent":"what this page should contain"}, ...]}
Rules: 3-5 pages including a home (slug "") and a contact page. Choose colors that fit the brand's feel. Keep it realistic.`;
  const { text } = await aiComplete("siteBuilder", { system, prompt: description, json: true, maxTokens: 1200 });
  const plan = extractJson<SitePlan>(text);
  // Defensive defaults.
  plan.pages = (plan.pages ?? []).slice(0, 5);
  if (!plan.pages.some((p) => p.slug === "")) plan.pages.unshift({ slug: "", title: "Home", intent: `Home page for ${plan.brandName}` });
  plan.nav = (plan.nav ?? []).slice(0, 6);
  return plan;
}

/** A/B headline variants for a topic or an existing title. */
export async function titleIdeas(topic: string, locale: string): Promise<string[]> {
  const cfg = await getAIConfig();
  const system = `You are a conversion copywriter. Given a topic or existing headline, return JSON {"titles":[...6 distinct, compelling title options...]} in ${locale === "fr" ? "French" : "English"}. Vary the angle (benefit, curiosity, how-to, number, question). Keep each under 70 characters. Return ONLY JSON.${brandVoiceLine(cfg.brandVoice)}`;
  const { text } = await aiComplete("seoMeta", { system, prompt: topic, json: true, maxTokens: 500 });
  const out = extractJson<{ titles: string[] }>(text);
  return (out.titles ?? []).filter((t) => typeof t === "string" && t.trim()).slice(0, 8);
}

/** SEO keyword & content-gap ideas for a topic. */
export async function keywordIdeas(topic: string): Promise<{ keywords: string[]; gaps: string[] }> {
  const system = `You are an SEO strategist. For the given topic, return JSON {"keywords":[...10 realistic search keywords...],"gaps":[...5 content ideas/pages the site is likely missing...]}. Return ONLY JSON.`;
  const { text } = await aiComplete("seoKeywords", { system, prompt: topic, json: true, maxTokens: 800 });
  const out = extractJson<{ keywords: string[]; gaps: string[] }>(text);
  return { keywords: (out.keywords ?? []).slice(0, 12), gaps: (out.gaps ?? []).slice(0, 8) };
}

// ─── Cluster 5: CRM AI ──────────────────────────────────
type LeadLike = Record<string, unknown>;
function leadSummaryText(lead: LeadLike): string {
  return Object.entries(lead)
    .filter(([k, v]) => v && ["name", "email", "phone", "city", "projectType", "budget", "timeline", "message"].includes(k))
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}

/** Score a lead 0-100 with a one-line intent summary. */
export async function scoreLead(lead: LeadLike): Promise<{ score: number; summary: string; hot: boolean }> {
  const system = `You are a sales assistant. Assess this inbound lead. Return ONLY JSON {"score": 0-100 (buying intent & fit), "summary": "one concise sentence", "hot": true|false}.`;
  const { text } = await aiComplete("leadReply", { system, prompt: leadSummaryText(lead), json: true, maxTokens: 200 });
  const out = extractJson<{ score: number; summary: string; hot: boolean }>(text);
  const score = Math.max(0, Math.min(100, Math.round(Number(out.score) || 0)));
  return { score, summary: String(out.summary ?? ""), hot: !!out.hot || score >= 70 };
}

/** Draft a reply email to a lead in the brand voice. */
export async function draftLeadReply(lead: LeadLike, instruction: string, locale: string): Promise<{ subject: string; body: string }> {
  const cfg = await getAIConfig();
  const system = `You write reply emails to inbound leads for a business. Write in ${locale === "fr" ? "French" : "English"}, warm and helpful, concise. ${instruction ? `Follow this instruction: ${instruction}. ` : ""}Return ONLY JSON {"subject":"...","body":"the email body with a greeting and sign-off"}.${brandVoiceLine(cfg.brandVoice)}`;
  const { text } = await aiComplete("leadReply", { system, prompt: leadSummaryText(lead), json: true, maxTokens: 700 });
  const out = extractJson<{ subject: string; body: string }>(text);
  return { subject: String(out.subject ?? ""), body: String(out.body ?? "") };
}

// ─── Cluster 6: Visitor Assistant (RAG over site content) ──
/** Rank page snippets by keyword overlap with the question (lightweight RAG). */
export function rankContext(question: string, pages: { title: string; text: string; slug: string }[], max = 4): { title: string; text: string; slug: string }[] {
  const terms = question.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  return pages
    .map((p) => {
      const hay = (p.title + " " + p.text).toLowerCase();
      const score = terms.reduce((s, t) => s + (hay.includes(t) ? 1 : 0), 0);
      return { ...p, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, max);
}

/** Answer a visitor's question grounded in the site's own content. */
export async function assistantReply(
  message: string,
  context: { title: string; text: string; slug: string }[],
  history: { role: string; content: string }[],
  locale: string,
  siteName: string,
): Promise<string> {
  const ctx = context.map((c) => `# ${c.title} (/${c.slug})\n${c.text.slice(0, 1200)}`).join("\n\n");
  const system = `You are the friendly assistant for ${siteName}'s website. Answer the visitor's question using ONLY the site content below. If the answer isn't in the content, say you're not sure and suggest they use the contact form. Be concise and reply in ${locale === "fr" ? "French" : "English"}.

SITE CONTENT:
${ctx || "(no content available)"}`;
  const convo = history.slice(-4).map((h) => `${h.role === "user" ? "Visitor" : "Assistant"}: ${h.content}`).join("\n");
  const { text } = await aiComplete("assistant", { system, prompt: convo ? `${convo}\nVisitor: ${message}` : message, maxTokens: 500 });
  return text.trim();
}
