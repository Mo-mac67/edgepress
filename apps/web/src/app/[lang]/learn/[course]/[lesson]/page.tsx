import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale } from "@/i18n/config";
import { getCourse } from "@/lib/courses-store";
import { embedSrc, tx } from "@/lib/cms-types";
import { MarkComplete } from "@/components/CourseProgress";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ lang: string; course: string; lesson: string }> }): Promise<Metadata> {
  const { lang, course, lesson } = await params;
  const c = await getCourse(course);
  const l = c?.lessons.find((x) => x.slug === lesson);
  return c?.status === "published" && l ? { title: `${tx(l.title, lang)} — ${tx(c.title, lang)}` } : {};
}

export default async function LessonPage({ params }: { params: Promise<{ lang: string; course: string; lesson: string }> }) {
  const { lang, course, lesson } = await params;
  if (!isLocale(lang)) notFound(); // format-invalid first segment (layout is lenient)
  const c = await getCourse(course);
  if (!c || c.status !== "published") notFound();
  const idx = c.lessons.findIndex((x) => x.slug === lesson);
  if (idx < 0) notFound();
  const l = c.lessons[idx];
  const fr = lang === "fr";
  const prev = c.lessons[idx - 1];
  const next = c.lessons[idx + 1];
  const embed = l.videoUrl ? embedSrc(l.videoUrl) : null;

  return (
    <section className="bg-white min-h-screen">
      <div className="container-page max-w-3xl pb-16 pt-32">
        <Link href={`/${lang}/learn/${c.slug}`} className="text-sm font-semibold text-accent-dark hover:underline">← {tx(c.title, lang)}</Link>
        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink-soft">{fr ? "Leçon" : "Lesson"} {idx + 1} / {c.lessons.length}</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-brand">{tx(l.title, lang)}</h1>

        {embed && (
          <div className={`mt-6 overflow-hidden rounded-xl border border-line ${embed.aspect === "video" ? "aspect-video" : "aspect-square"}`}>
            <iframe src={embed.src} title={tx(l.title, lang)} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
          </div>
        )}

        {tx(l.body, lang) && (
          <div className="prose mt-6 max-w-none prose-headings:font-display prose-headings:text-brand prose-a:text-accent-dark" dangerouslySetInnerHTML={{ __html: tx(l.body, lang) }} />
        )}

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
          <MarkComplete course={c.slug} lesson={l.slug} labels={{ done: fr ? "Terminé" : "Completed", mark: fr ? "Marquer comme terminé" : "Mark complete" }} />
          <div className="flex gap-2">
            {prev && <Link href={`/${lang}/learn/${c.slug}/${prev.slug}`} className="btn-secondary text-sm">← {tx(prev.title, lang)}</Link>}
            {next && <Link href={`/${lang}/learn/${c.slug}/${next.slug}`} className="btn-primary text-sm">{tx(next.title, lang)} →</Link>}
          </div>
        </div>
      </div>
    </section>
  );
}
