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

/** SEO keyword & content-gap ideas for a topic. */
export async function keywordIdeas(topic: string): Promise<{ keywords: string[]; gaps: string[] }> {
  const system = `You are an SEO strategist. For the given topic, return JSON {"keywords":[...10 realistic search keywords...],"gaps":[...5 content ideas/pages the site is likely missing...]}. Return ONLY JSON.`;
  const { text } = await aiComplete("seoKeywords", { system, prompt: topic, json: true, maxTokens: 800 });
  const out = extractJson<{ keywords: string[]; gaps: string[] }>(text);
  return { keywords: (out.keywords ?? []).slice(0, 12), gaps: (out.gaps ?? []).slice(0, 8) };
}
