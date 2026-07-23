import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale } from "@/i18n/config";
import { getSettings } from "@/lib/cms-store";
import { getApprovedThreads } from "@/lib/forum-store";
import { ForumForms } from "@/components/ForumForms";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "fr" ? "Forum" : "Community forum" };
}

export default async function ForumPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound(); // format-invalid first segment (layout is lenient)
  if ((await getSettings()).forumEnabled !== true) notFound();
  const fr = lang === "fr";
  const threads = await getApprovedThreads();

  return (
    <section className="bg-cream min-h-screen">
      <div className="container-page max-w-3xl pb-16 pt-32">
        <h1 className="section-title text-center">{fr ? "Forum" : "Community forum"}</h1>
        <p className="mt-3 text-center text-sm text-ink-soft">{fr ? "Les sujets sont modérés avant publication." : "Topics are moderated before they appear."}</p>

        <ForumForms mode="thread" lang={lang} />

        <ul className="mt-10 space-y-3">
          {threads.map((t) => (
            <li key={t.id} className="card p-5">
              <Link href={`/${lang}/forum/${t.id}`} className="font-display text-lg font-bold text-brand hover:underline">{t.title}</Link>
              <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{t.body}</p>
              <p className="mt-2 text-xs text-ink-soft">
                {t.author} · {new Date(t.createdAt).toLocaleDateString(fr ? "fr-CA" : "en-CA")} · {t.replyCount} {fr ? "réponse(s)" : `repl${t.replyCount === 1 ? "y" : "ies"}`}
              </p>
            </li>
          ))}
          {threads.length === 0 && <li className="card p-8 text-center text-sm text-ink-soft">{fr ? "Aucun sujet pour l'instant — lancez la discussion !" : "No topics yet — start the conversation!"}</li>}
        </ul>
      </div>
    </section>
  );
}
