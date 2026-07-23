import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale } from "@/i18n/config";
import { searchContent } from "@/lib/search";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "fr" ? "Recherche" : "Search", robots: { index: false } };
}

export default async function SearchPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ q?: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound(); // format-invalid first segment (layout is lenient)
  const { q = "" } = await searchParams;
  const fr = lang === "fr";
  const query = q.slice(0, 100);
  const results = query.trim().length >= 2 ? await searchContent(query, lang) : [];

  return (
    <section className="bg-cream min-h-screen">
      <div className="container-page max-w-3xl pb-16 pt-32">
        <h1 className="section-title text-center">{fr ? "Recherche" : "Search"}</h1>
        <form action={`/${lang}/search`} method="GET" className="mx-auto mt-8 flex max-w-xl gap-2">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder={fr ? "Rechercher sur le site…" : "Search this site…"}
            className="field flex-1"
            autoFocus
            maxLength={100}
          />
          <button type="submit" className="btn-primary px-6">{fr ? "Chercher" : "Search"}</button>
        </form>

        {query.trim().length >= 2 && (
          <div className="mt-10">
            <p className="text-sm text-ink-soft">
              {results.length === 0
                ? fr ? `Aucun résultat pour « ${query} »` : `No results for “${query}”`
                : fr ? `${results.length} résultat(s) pour « ${query} »` : `${results.length} result(s) for “${query}”`}
            </p>
            <ul className="mt-4 space-y-4">
              {results.map((r) => (
                <li key={`${r.type}-${r.path}`} className="card p-5">
                  <Link href={`/${lang}/${r.path}`} className="font-display text-lg font-bold text-brand hover:underline">
                    {r.title}
                  </Link>
                  <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent-dark">
                    {r.type === "post" ? (fr ? "Article" : "Post") : "Page"}
                  </span>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">{r.snippet}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
