import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale } from "@/i18n/config";
import { getSettings } from "@/lib/cms-store";
import { getApprovedThread } from "@/lib/forum-store";
import { ForumForms } from "@/components/ForumForms";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ lang: string; id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await getApprovedThread(id);
  return { title: data?.thread.title ?? "Forum" };
}

export default async function ThreadPage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound(); // format-invalid first segment (layout is lenient)
  if ((await getSettings()).forumEnabled !== true) notFound();
  const data = await getApprovedThread(id);
  if (!data) notFound();
  const fr = lang === "fr";

  return (
    <section className="bg-cream min-h-screen">
      <div className="container-page max-w-3xl pb-16 pt-32">
        <Link href={`/${lang}/forum`} className="text-sm font-semibold text-accent-dark hover:underline">← {fr ? "Tous les sujets" : "All topics"}</Link>
        <article className="card mt-4 p-6">
          <h1 className="font-display text-2xl font-bold text-brand">{data.thread.title}</h1>
          <p className="mt-1 text-xs text-ink-soft">{data.thread.author} · {new Date(data.thread.createdAt).toLocaleDateString(fr ? "fr-CA" : "en-CA")}</p>
          <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-ink">{data.thread.body}</p>
        </article>

        <h2 className="mt-8 font-display text-lg font-bold text-brand">
          {fr ? "Réponses" : "Replies"}{data.replies.length > 0 && <span className="ml-2 text-sm font-normal text-ink-soft">({data.replies.length})</span>}
        </h2>
        <ul className="mt-4 space-y-4">
          {data.replies.map((r) => (
            <li key={r.id} className="rounded-lg bg-surface-soft p-4">
              <p className="text-sm font-semibold text-brand">{r.author} <span className="ml-2 text-xs font-normal text-ink-soft">{new Date(r.createdAt).toLocaleDateString(fr ? "fr-CA" : "en-CA")}</span></p>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-ink">{r.body}</p>
            </li>
          ))}
          {data.replies.length === 0 && <li className="text-sm text-ink-soft">{fr ? "Pas encore de réponse." : "No replies yet."}</li>}
        </ul>

        <ForumForms mode="reply" lang={lang} threadId={id} />
      </div>
    </section>
  );
}
