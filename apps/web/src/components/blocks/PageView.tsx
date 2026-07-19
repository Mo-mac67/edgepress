import { BlockRenderer } from "./BlockRenderer";
import { getSettings } from "@/lib/cms-store";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Page } from "@/lib/cms-types";

/**
 * Renders a CMS page in either mode:
 * - "blocks": the block list, in the site design system.
 * - "html": raw imported HTML. Full documents render in an iframe (their own
 *   CSS/JS stay isolated); fragments are injected inline. With hideChrome the
 *   site header/footer are hidden so the import is standalone.
 */
export async function PageView({ page, locale, dict }: { page: Page; locale: Locale; dict: Dictionary }) {
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
  return <BlockRenderer blocks={page.blocks} locale={locale} dict={dict} settings={settings} first pageDate={page.updatedAt} />;
}
