import { getApprovedComments } from "@/lib/comments-store";
import { getSettings } from "@/lib/cms-store";
import { CommentForm } from "./CommentForm";

/** Moderated comment thread under a blog post (server-rendered list). */
export async function Comments({ postSlug, lang }: { postSlug: string; lang: string }) {
  const settings = await getSettings();
  if (settings.commentsEnabled === false) return null;
  const comments = await getApprovedComments(postSlug);
  const fr = lang === "fr";
  return (
    <section className="mt-12 border-t border-line pt-8">
      <h2 className="font-display text-xl font-bold text-brand">
        {fr ? "Commentaires" : "Comments"}{comments.length > 0 && <span className="ml-2 text-sm font-normal text-ink-soft">({comments.length})</span>}
      </h2>
      {comments.length > 0 && (
        <ul className="mt-5 space-y-5">
          {comments.map((c, i) => (
            <li key={i} className="rounded-lg bg-surface-soft p-4">
              <p className="text-sm font-semibold text-brand">{c.author} <span className="ml-2 font-normal text-xs text-ink-soft">{new Date(c.createdAt).toLocaleDateString(fr ? "fr-CA" : "en-CA")}</span></p>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-ink">{c.body}</p>
            </li>
          ))}
        </ul>
      )}
      <CommentForm postSlug={postSlug} lang={lang} />
    </section>
  );
}
