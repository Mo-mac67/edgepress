import type { Metadata } from "next";
import { Fraunces, Inter, Lora, Manrope, Playfair_Display, Plus_Jakarta_Sans, Poppins, Space_Grotesk } from "next/font/google";
import { notFound } from "next/navigation";
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
import { getActiveLocales, getNav, getSeo, getSettings } from "@/lib/cms-store";
import { getAIConfig } from "@/lib/ai/engine";

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
  if (!isLocale(lang) || !(await getActiveLocales()).includes(lang)) notFound();

  const dict = getDictionary(lang);
  const [nav, settings, seo, aiCfg] = await Promise.all([getNav(), getSettings(), getSeo(), getAIConfig()]);
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
        <Header locale={lang} dict={dict} nav={nav} settings={settings} />
        <main className="flex-1">{children}</main>
        <Footer locale={lang} dict={dict} nav={nav} settings={settings} />
        <FloatingQuote
          locale={lang}
          phone={settings.phone}
          quoteLabel={dict.nav.quote}
          callLabel={lang === "fr" ? "Appeler" : "Call"}
        />
        {aiCfg.enabled && aiCfg.assistantEnabled && <AssistantWidget locale={lang} brandName={settings.brandName} />}
      </body>
    </html>
  );
}
