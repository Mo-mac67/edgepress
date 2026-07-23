import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { redirectOrNotFound } from "@/lib/redirect-guard";
import type { Metadata } from "next";
import { PageView } from "@/components/blocks/PageView";
import { Comments } from "@/components/Comments";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { isAuthed } from "@/lib/admin-auth";
import { getPage, getPost, getPosts } from "@/lib/cms-store";
import { isLive, tx } from "@/lib/cms-types";
import { isValidPreview } from "@/lib/preview";
import { LEGAL } from "@/lib/legal-content";

// Dynamic: CMS pages render per-request from KV so anything created or edited in
// the admin is live immediately — no redeploy. This is core to EdgePress as a
// CMS. Rendering is a KV read + block render (well within limits); pair with a
// short edge cache (see the fetch cache headers) if you need extra headroom.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ lang: string; slug: string[] }> }): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang)) return {};
  const path = slug.join("/");
  const page = await getPage(path);
  if (page)
    return {
      title: tx(page.title, lang),
      description: tx(page.description, lang),
      keywords: page.seo?.keywords || undefined,
      robots: page.seo?.noindex ? { index: false, follow: false } : undefined,
      openGraph: page.seo?.ogImage ? { images: [{ url: page.seo.ogImage }] } : undefined,
    };
  if (slug[0] === "blog" && slug[1]) {
    const post = await getPost(slug[1]);
    if (post) return { title: tx(post.title, lang), description: tx(post.excerpt, lang) };
  }
  return {};
}

export default async function CmsPage({ params, searchParams }: { params: Promise<{ lang: string; slug: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { lang, slug } = await params;
  const sp = await searchParams;
  if (!isLocale(lang)) return redirectOrNotFound(`/${[lang, ...slug].join("/")}`);
  const dict = getDictionary(lang);
  const path = slug.join("/");

  // Blog
  if (slug[0] === "blog") {
    if (slug.length === 1) return <BlogIndex lang={lang} cat={typeof sp.cat === "string" ? sp.cat : undefined} tag={typeof sp.tag === "string" ? sp.tag : undefined} />;
    const post = await getPost(slug[1]);
    if (!post || !isLive(post)) return redirectOrNotFound(`/${lang}/${path}`);
    const site = process.env.SITE_URL ?? "";
    const postLd = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: tx(post.title, lang),
      description: tx(post.excerpt, lang) || undefined,
      datePublished: post.date,
      author: { "@type": "Person", name: post.author },
      ...(post.cover ? { image: `${site}${post.cover}` } : {}),
      mainEntityOfPage: `${site}/${lang}/blog/${post.slug}`,
    };
    return (
      <article className="bg-white">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(postLd) }} />
        {post.cover && (
          <div className="relative aspect-[21/9] w-full">
            <Image src={post.cover} alt={tx(post.title, lang)} fill sizes="100vw" className="object-cover" priority />
          </div>
        )}
        <div className="container-page max-w-3xl py-12">
          <p className="text-sm text-ink-soft">{new Date(post.date).toLocaleDateString(lang === "fr" ? "fr-CA" : "en-CA")} · {post.author}</p>
          <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight text-brand">{tx(post.title, lang)}</h1>
          {((post.categories?.length ?? 0) > 0 || (post.tags?.length ?? 0) > 0) && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(post.categories ?? []).map((c) => (
                <Link key={`c-${c}`} href={`/${lang}/blog?cat=${encodeURIComponent(c)}`} className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent-dark hover:opacity-80">{c}</Link>
              ))}
              {(post.tags ?? []).map((t) => (
                <Link key={`t-${t}`} href={`/${lang}/blog?tag=${encodeURIComponent(t)}`} className="rounded-full border border-line px-2.5 py-0.5 text-xs text-ink-soft hover:text-brand">#{t}</Link>
              ))}
            </div>
          )}
          <div
            className="prose mt-6 max-w-none prose-headings:font-display prose-headings:text-brand prose-a:text-accent-dark"
            dangerouslySetInnerHTML={{ __html: tx(post.body, lang) }}
          />
          <Comments postSlug={post.slug} lang={lang} />
        </div>
      </article>
    );
  }

  const page = await getPage(path);
  if (!page) {
    // Built-in legal fallback: installs created before privacy/terms became
    // seeded CMS pages still get the default copy. Creating a CMS page with
    // the same slug takes over automatically.
    if (path === "privacy" || path === "terms") return <LegalFallback kind={path} lang={lang} />;
    return redirectOrNotFound(`/${lang}/${path}`);
  }
  // Drafts render for signed-in admins, or for anyone holding a signed
  // preview link (?preview=<token>) an admin shared.
  const previewParam = typeof sp.preview === "string" ? sp.preview : undefined;
  const previewing = !isLive(page) && (isValidPreview(page.id, previewParam) || (await isAuthed()));
  if (!isLive(page) && !previewing) notFound();
  return (
    <>
      {previewing && (
        <div className="fixed inset-x-0 top-0 z-[100] bg-amber-500 py-1.5 text-center text-xs font-bold text-white">
          Draft preview — this page is not published yet
        </div>
      )}
      <PageView page={page} locale={lang} dict={dict} />
    </>
  );
}

function LegalFallback({ kind, lang }: { kind: "privacy" | "terms"; lang: string }) {
  const doc = LEGAL[kind][lang === "fr" ? "fr" : "en"];
  return (
    <article className="container-page max-w-3xl pt-32 pb-12">
      <h1 className="text-3xl font-bold">{doc.title}</h1>
      <p className="mt-2 text-sm text-ink-soft">{doc.updated}</p>
      {doc.sections.map(([h, body]) => (
        <section key={h} className="mt-8">
          <h2 className="text-xl font-semibold">{h}</h2>
          <p className="mt-2 leading-relaxed text-ink-soft">{body}</p>
        </section>
      ))}
    </article>
  );
}

async function BlogIndex({ lang, cat, tag }: { lang: string; cat?: string; tag?: string }) {
  const all = (await getPosts()).filter((p) => isLive(p));
  const posts = all.filter((p) => (!cat || (p.categories ?? []).includes(cat)) && (!tag || (p.tags ?? []).includes(tag)));
  const categories = [...new Set(all.flatMap((p) => p.categories ?? []))].sort();
  return (
    <section className="bg-cream">
      <div className="container-page pb-16 pt-32">
        <h1 className="section-title text-center">Blog</h1>
        {categories.length > 0 && (
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link href={`/${lang}/blog`} className={`rounded-full px-3 py-1 text-sm font-semibold ${!cat && !tag ? "bg-brand text-white" : "border border-line text-ink-soft hover:text-brand"}`}>All</Link>
            {categories.map((c) => (
              <Link key={c} href={`/${lang}/blog?cat=${encodeURIComponent(c)}`} className={`rounded-full px-3 py-1 text-sm font-semibold ${cat === c ? "bg-brand text-white" : "border border-line text-ink-soft hover:text-brand"}`}>{c}</Link>
            ))}
          </div>
        )}
        {tag && <p className="mt-4 text-center text-sm text-ink-soft">Tagged <span className="font-semibold text-brand">#{tag}</span></p>}
        {posts.length === 0 ? (
          <p className="mt-8 text-center text-ink-soft">{all.length === 0 ? "No posts yet." : "No posts match this filter."}</p>
        ) : (
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => (
              <Link key={p.id} href={`/${lang}/blog/${p.slug}`} className="card group overflow-hidden transition hover:-translate-y-1 hover:shadow-xl">
                <div className="relative aspect-[16/10] overflow-hidden bg-brand-soft">
                  {p.cover && <Image src={p.cover} alt={tx(p.title, lang)} fill sizes="(max-width:768px) 100vw, 33vw" className="object-cover transition duration-500 group-hover:scale-105" />}
                </div>
                <div className="p-6">
                  <p className="text-xs text-ink-soft">{new Date(p.date).toLocaleDateString(lang === "fr" ? "fr-CA" : "en-CA")}</p>
                  <h3 className="mt-1 font-display text-lg font-bold text-brand">{tx(p.title, lang)}</h3>
                  <p className="mt-2 text-sm text-ink-soft">{tx(p.excerpt, lang)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
