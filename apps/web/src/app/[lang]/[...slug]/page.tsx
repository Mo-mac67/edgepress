import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PageView } from "@/components/blocks/PageView";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { isAuthed } from "@/lib/admin-auth";
import { getPage, getPost, getPosts } from "@/lib/cms-store";
import { tx } from "@/lib/cms-types";

// Dynamic: CMS pages render per-request from KV so anything created or edited in
// the admin is live immediately — no redeploy. This is core to EdgePress as a
// CMS. Rendering is a KV read + block render (well within limits); pair with a
// short edge cache (see the fetch cache headers) if you need extra headroom.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[lang]/[...slug]">): Promise<Metadata> {
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

export default async function CmsPage({ params }: PageProps<"/[lang]/[...slug]">) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const path = slug.join("/");

  // Blog
  if (slug[0] === "blog") {
    if (slug.length === 1) return <BlogIndex lang={lang} />;
    const post = await getPost(slug[1]);
    if (!post || post.status !== "published") notFound();
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
          <div
            className="prose mt-6 max-w-none prose-headings:font-display prose-headings:text-brand prose-a:text-accent-dark"
            dangerouslySetInnerHTML={{ __html: tx(post.body, lang) }}
          />
        </div>
      </article>
    );
  }

  const page = await getPage(path);
  if (!page) notFound();
  // Drafts stay hidden from visitors but render for signed-in admins (live preview).
  if (page.status !== "published" && !(await isAuthed())) notFound();
  return <PageView page={page} locale={lang} dict={dict} />;
}

async function BlogIndex({ lang }: { lang: string }) {
  const posts = (await getPosts()).filter((p) => p.status === "published");
  return (
    <section className="bg-cream">
      <div className="container-page pb-16 pt-32">
        <h1 className="section-title text-center">Blog</h1>
        {posts.length === 0 ? (
          <p className="mt-8 text-center text-ink-soft">No posts yet.</p>
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
