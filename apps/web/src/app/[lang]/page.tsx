import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PageView } from "@/components/blocks/PageView";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getPage } from "@/lib/cms-store";
import { tx } from "@/lib/cms-types";

// Dynamic: the home page renders per-request from KV so edits made in the admin
// go live immediately (core to EdgePress as a CMS).
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const page = await getPage("");
  if (!page) return {};
  return {
    title: tx(page.title, lang),
    description: tx(page.description, lang),
    keywords: page.seo?.keywords || undefined,
    robots: page.seo?.noindex ? { index: false, follow: false } : undefined,
    openGraph: page.seo?.ogImage ? { images: [{ url: page.seo.ogImage }] } : undefined,
  };
}

export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const page = await getPage("");
  if (!page) notFound();
  return <PageView page={page} locale={lang} dict={dict} />;
}
