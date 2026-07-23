import { BlockRenderer } from "./BlockRenderer";
import { AbTrack } from "@/components/AbTrack";
import { getSettings } from "@/lib/cms-store";
import { getSnippets, hasSnippetTokens, renderSnippets } from "@/lib/snippets-store";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Block, Page } from "@/lib/cms-types";

/** Expands `[snippet name]` tokens in rawHtml + html/richtext blocks. Loads
 *  the snippet list only when a token actually appears (zero-cost otherwise). */
async function expandSnippets(page: Page): Promise<Page> {
  const richtextHas = (b: Block) => b.type === "richtext" && Object.values((b.data.html as Record<string, string>) ?? {}).some((v) => typeof v === "string" && hasSnippetTokens(v));
  const htmlHas = (b: Block) => b.type === "html" && typeof b.data.code === "string" && hasSnippetTokens(b.data.code);
  const rawHas = page.mode === "html" && hasSnippetTokens(page.rawHtml ?? "");
  if (!rawHas && !page.blocks.some((b) => richtextHas(b) || htmlHas(b))) return page;
  const snippets = await getSnippets();
  return {
    ...page,
    rawHtml: rawHas ? renderSnippets(page.rawHtml ?? "", snippets) : page.rawHtml,
    blocks: page.blocks.map((b) => {
      if (htmlHas(b)) return { ...b, data: { ...b.data, code: renderSnippets(b.data.code as string, snippets) } };
      if (richtextHas(b)) {
        const html = Object.fromEntries(Object.entries((b.data.html as Record<string, string>) ?? {}).map(([k, v]) => [k, typeof v === "string" ? renderSnippets(v, snippets) : v]));
        return { ...b, data: { ...b.data, html } };
      }
      return b;
    }),
  };
}

/**
 * Renders a CMS page in either mode:
 * - "blocks": the block list, in the site design system.
 * - "html": raw imported HTML. Full documents render in an iframe (their own
 *   CSS/JS stay isolated); fragments are injected inline. With hideChrome the
 *   site header/footer are hidden so the import is standalone.
 */
export async function PageView({ page: rawPage, locale, dict }: { page: Page; locale: Locale; dict: Dictionary }) {
  const page = await expandSnippets(rawPage);
  if (page.mode === "html") {
    const raw = page.rawHtml ?? "";
    const isDocument = /<html[\s>]|<!doctype/i.test(raw);
    return (
      <>
        {page.hideChrome && (
          <style dangerouslySetInnerHTML={{ __html: "header,footer{display:none!important} main{margin:0!important}" }} />
        )}
        {isDocument ? (
          <iframe
            srcDoc={raw}
            title={page.title[locale] || page.slug}
            className={page.hideChrome ? "block h-screen w-full border-0" : "block h-[calc(100vh-4.75rem)] w-full border-0"}
          />
        ) : (
          <div dangerouslySetInnerHTML={{ __html: raw }} />
        )}
      </>
    );
  }
  const settings = await getSettings();

  // A/B headline test: pick a variant, override the first hero/header title.
  let blocks = page.blocks;
  let ab: { variant: number } | null = null;
  const headlines = page.ab?.headlines?.filter((h) => h.trim());
  if (headlines && headlines.length >= 2) {
    const variant = Math.floor(Math.random() * headlines.length);
    ab = { variant };
    let done = false;
    blocks = page.blocks.map((b: Block) => {
      if (done || (b.type !== "hero" && b.type !== "header")) return b;
      done = true;
      const title = { ...(b.data.title as Record<string, string> | undefined), [locale]: headlines[variant] };
      return { ...b, data: { ...b.data, title } };
    });
  }

  return (
    <>
      {ab && <AbTrack slug={page.slug} variant={ab.variant} />}
      <BlockRenderer blocks={blocks} locale={locale} dict={dict} settings={settings} first pageDate={page.updatedAt} pageId={page.id} />
    </>
  );
}
