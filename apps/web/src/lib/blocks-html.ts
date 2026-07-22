/**
 * blocks → HTML serializer (pure, client-safe — used by the page editor).
 * Driven by the BLOCKS schema, so every block type — current and future —
 * converts generically: localized text fields become headings/paragraphs,
 * richtext passes through, images become <img>, xxxLabel+xxxHref pairs become
 * links, and lists become <ul><li>. The output is clean semantic content HTML
 * (the WordPress "code editor" analog) — the site theme styles it on render.
 */
import { BLOCKS, tx, type Block } from "./cms-types";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

type FieldDef = { key: string; type: string; localized?: boolean; itemFields?: FieldDef[] };

function renderFields(fields: FieldDef[], data: Record<string, unknown>, locale: string, opts: { headline: string; inline?: boolean }): string[] {
  const out: string[] = [];
  for (const f of fields) {
    const v = data?.[f.key];
    if (v == null) continue;

    if (f.type === "toggle" || f.type === "select" || f.type === "url") continue; // urls render with their Label

    if (f.type === "richtext") {
      const html = tx(v, locale);
      if (html.trim()) out.push(html);
      continue;
    }

    if (f.type === "image") {
      if (typeof v === "string" && v.trim()) out.push(`<img src="${esc(v)}" alt="" />`);
      continue;
    }

    if (f.type === "list" && Array.isArray(v)) {
      if (v.length === 0) continue;
      const items = v
        .map((item) => {
          const inner = renderFields(f.itemFields ?? [], item as Record<string, unknown>, locale, { headline: "strong", inline: true });
          return inner.length ? `    <li>${inner.join(" ")}</li>` : "";
        })
        .filter(Boolean);
      if (items.length) out.push(`  <ul data-list="${esc(f.key)}">\n${items.join("\n")}\n  </ul>`);
      continue;
    }

    // text / textarea
    const s = tx(v, locale);
    if (!s.trim()) continue;
    if (/Label$/.test(f.key)) {
      const href = data[f.key.replace(/Label$/, "Href")];
      const url = typeof href === "string" && href.trim() ? href : "#";
      out.push(opts.inline ? `<a href="${esc(url)}">${esc(s)}</a>` : `  <p><a href="${esc(url)}">${esc(s)}</a></p>`);
      continue;
    }
    const tag =
      f.key === "title" ? opts.headline
      : /^(q|question|step)$/.test(f.key) ? (opts.inline ? "strong" : "h3")
      : opts.inline ? "span" : "p";
    out.push(opts.inline ? `<${tag}>${esc(s)}</${tag}>` : `  <${tag}>${esc(s)}</${tag}>`);
  }
  return out;
}

/** Convert a page's blocks to editable semantic HTML. */
export function blocksToHtml(blocks: Block[], locale: string): string {
  const sections = blocks.map((b, i) => {
    const def = BLOCKS[b.type];
    if (!def) return "";
    const inner = renderFields(def.fields as FieldDef[], b.data ?? {}, locale, { headline: i === 0 ? "h1" : "h2" });
    if (inner.length === 0) return `<section data-block="${esc(b.type)}"></section>`;
    return `<section data-block="${esc(b.type)}">\n${inner.join("\n")}\n</section>`;
  });
  return sections.filter(Boolean).join("\n\n");
}
