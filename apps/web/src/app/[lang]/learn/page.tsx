import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale } from "@/i18n/config";
import { getPublishedCourses } from "@/lib/courses-store";
import { tx } from "@/lib/cms-types";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "fr" ? "Cours" : "Courses" };
}

export default async function LearnIndex({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound(); // format-invalid first segment (layout is lenient)
  const fr = lang === "fr";
  const courses = await getPublishedCourses();

  return (
    <section className="bg-cream min-h-screen">
      <div className="container-page pb-16 pt-32">
        <h1 className="section-title text-center">{fr ? "Cours" : "Courses"}</h1>
        {courses.length === 0 ? (
          <p className="mt-8 text-center text-ink-soft">{fr ? "Aucun cours publié pour l'instant." : "No published courses yet."}</p>
        ) : (
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => (
              <Link key={c.id} href={`/${lang}/learn/${c.slug}`} className="card group overflow-hidden transition hover:-translate-y-1 hover:shadow-xl">
                <div className="relative aspect-[16/10] overflow-hidden bg-brand-soft">
                  {c.cover && <Image src={c.cover} alt={tx(c.title, lang)} fill sizes="(max-width:768px) 100vw, 33vw" className="object-cover transition duration-500 group-hover:scale-105" />}
                </div>
                <div className="p-6">
                  <h3 className="font-display text-lg font-bold text-brand">{tx(c.title, lang)}</h3>
                  <p className="mt-2 line-clamp-2 text-sm text-ink-soft">{tx(c.description, lang)}</p>
                  <p className="mt-3 text-xs font-semibold text-accent-dark">{c.lessons.length} {fr ? "leçon(s)" : `lesson${c.lessons.length === 1 ? "" : "s"}`}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
