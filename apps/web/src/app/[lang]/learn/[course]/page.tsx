import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCourse } from "@/lib/courses-store";
import { tx } from "@/lib/cms-types";
import { CourseProgress, LessonCheck } from "@/components/CourseProgress";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ lang: string; course: string }> }): Promise<Metadata> {
  const { lang, course } = await params;
  const c = await getCourse(course);
  return c?.status === "published" ? { title: tx(c.title, lang), description: tx(c.description, lang) } : {};
}

export default async function CoursePage({ params }: { params: Promise<{ lang: string; course: string }> }) {
  const { lang, course } = await params;
  const c = await getCourse(course);
  if (!c || c.status !== "published") notFound();
  const fr = lang === "fr";

  return (
    <section className="bg-cream min-h-screen">
      <div className="container-page max-w-3xl pb-16 pt-32">
        <Link href={`/${lang}/learn`} className="text-sm font-semibold text-accent-dark hover:underline">← {fr ? "Tous les cours" : "All courses"}</Link>
        <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-brand">{tx(c.title, lang)}</h1>
        {tx(c.description, lang) && <p className="mt-3 leading-relaxed text-ink-soft">{tx(c.description, lang)}</p>}
        <CourseProgress course={c.slug} lessonSlugs={c.lessons.map((l) => l.slug)} labels={{ complete: fr ? "terminé" : "complete" }} />

        <ol className="mt-8 space-y-2">
          {c.lessons.map((l, i) => (
            <li key={l.id}>
              <Link href={`/${lang}/learn/${c.slug}/${l.slug}`} className="card flex items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:shadow-md">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft font-display text-sm font-bold text-brand">{i + 1}</span>
                <span className="font-medium text-ink">{tx(l.title, lang)}</span>
                <LessonCheck course={c.slug} lesson={l.slug} />
              </Link>
            </li>
          ))}
          {c.lessons.length === 0 && <li className="card p-6 text-center text-sm text-ink-soft">{fr ? "Les leçons arrivent bientôt." : "Lessons coming soon."}</li>}
        </ol>
      </div>
    </section>
  );
}
