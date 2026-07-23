import type { Metadata } from "next";
import { Fraunces, Inter, Lora, Manrope, Playfair_Display, Plus_Jakarta_Sans, Poppins, Space_Grotesk } from "next/font/google";
import { notFound } from "next/navigation";
import { redirectOrNotFound } from "@/lib/redirect-guard";
import "../globals.css";
import { Analytics } from "@/components/Analytics";
import { FloatingQuote } from "@/components/FloatingQuote";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ScrollFx } from "@/components/ScrollFx";
import { dir, isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { SeoTags } from "@/components/SeoTags";
import { AssistantWidget } from "@/components/AssistantWidget";
import { getActiveLocales, getNav, getSeo, getSettings, getTheme } from "@/lib/cms-store";
import { getAIConfig } from "@/lib/ai/engine";
import { getSnippets, hasSnippetTokens, renderSnippets } from "@/lib/snippets-store";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700", "800"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700", "800"],
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin", "latin-ext"],
});

const grotesk = Space_Grotesk({
  variable: "--font-grotesk",
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "latin-ext"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
});

// Distinctive editorial display serif — the "special" typeface for headings,
// the hero slogan and the wordmark. Optical sizing looks superb at large sizes.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const TITLE = "EdgePress — the AI-native CMS that runs free on the edge";
const DESCRIPTION =
  "A block-based site builder, CRM, automated SEO and a full AI suite in one self-hostable app. This is the default EdgePress site — edit everything in the admin panel.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { languages: { en: "/en", fr: "/fr" } },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export async function generateStaticParams() {
  return (await getActiveLocales()).map((lang) => ({ lang }));
}

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  // Format-invalid first segments (e.g. /old-page.html or /legacy/deep/post
  // from a migrated site): only the PAGE below knows the full path, so it —
  // not this layout — consults the redirect rules. A redirect thrown here
  // would see just the first segment and lose a wildcard rule's tail.
  if (!isLocale(lang)) {
    return (
      <html lang="en">
        <body>{children}</body>
      </html>
    );
  }
  // Well-formed but inactive locales (e.g. /de) 404 — after a redirect check.
  if (!(await getActiveLocales()).includes(lang)) await redirectOrNotFound(`/${lang}`);

  const dict = getDictionary(lang);
  const [nav, rawSettings, seo, aiCfg, theme] = await Promise.all([getNav(), getSettings(), getSeo(), getAIConfig(), getTheme()]);
  // Reusable snippets also work inside the custom header/footer overrides
  // (loaded only when a token is actually present).
  let settings = rawSettings;
  if (hasSnippetTokens(rawSettings.customHeaderHtml ?? "") || hasSnippetTokens(rawSettings.customFooterHtml ?? "")) {
    const snippets = await getSnippets();
    settings = {
      ...rawSettings,
      customHeaderHtml: rawSettings.customHeaderHtml ? renderSnippets(rawSettings.customHeaderHtml, snippets) : rawSettings.customHeaderHtml,
      customFooterHtml: rawSettings.customFooterHtml ? renderSnippets(rawSettings.customFooterHtml, snippets) : rawSettings.customFooterHtml,
    };
  }
  const fonts = `${inter.variable} ${jakarta.variable} ${playfair.variable} ${lora.variable} ${grotesk.variable} ${manrope.variable} ${poppins.variable} ${fraunces.variable}`;

  return (
    <html lang={lang} dir={dir(lang)} className={`${fonts} h-full`}>
      <body className="flex min-h-full flex-col">
        {/* Live theme from the CMS Appearance panel — served by the dynamic
            /theme.css route so accent/fonts/radius edits apply without a
            redeploy. Falls back to the on-brand @theme defaults in globals. */}
        <link rel="stylesheet" href="/theme.css" />
        <SeoTags seo={seo} settings={settings} />
        <Analytics />
        <ScrollFx />
        {/* Advanced override (Site info → Custom header/footer): raw HTML fully
            replaces the built-in components. Rendered as <header>/<footer> so
            admin/hide-chrome selectors keep working. */}
        {settings.customHeaderHtml?.trim() ? (
          <header dangerouslySetInnerHTML={{ __html: settings.customHeaderHtml }} />
        ) : (
          <Header locale={lang} dict={dict} nav={nav} settings={settings} />
        )}
        <main className="flex-1">{children}</main>
        {settings.customFooterHtml?.trim() ? (
          <footer dangerouslySetInnerHTML={{ __html: settings.customFooterHtml }} />
        ) : (
          <Footer locale={lang} dict={dict} nav={nav} settings={settings} />
        )}
        <FloatingQuote
          locale={lang}
          phone={settings.phone}
          quoteLabel={dict.nav.quote}
          callLabel={lang === "fr" ? "Appeler" : "Call"}
        />
        {aiCfg.enabled && aiCfg.assistantEnabled && <AssistantWidget locale={lang} brandName={settings.brandName} />}
        {/* Site-wide custom code (Appearance → Custom code). Server-rendered
            into the document, so <script> tags execute normally on load. */}
        {theme.customBodyHtml?.trim() && <div id="ep-custom-code" dangerouslySetInnerHTML={{ __html: theme.customBodyHtml }} />}
      </body>
    </html>
  );
}
