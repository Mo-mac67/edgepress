"use client";

import { useState } from "react";

export function CommentForm({ postSlug, lang }: { postSlug: string; lang: string }) {
  const fr = lang === "fr";
  const [author, setAuthor] = useState("");
  const [body, setBody] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setErr("");
    const res = await fetch(`/api/comments/${postSlug}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author, body }),
    }).catch(() => null);
    const d = await res?.json().catch(() => ({}));
    if (res?.ok) {
      setState("done");
      setAuthor("");
      setBody("");
    } else {
      setState("error");
      setErr(d?.error || (fr ? "Échec de l'envoi" : "Couldn't send the comment"));
    }
  }

  if (state === "done") {
    return <p className="mt-6 rounded-lg bg-accent-soft p-4 text-sm font-medium text-accent-dark">{fr ? "Merci ! Votre commentaire sera visible après modération." : "Thanks! Your comment will appear once it's approved."}</p>;
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-3">
      <input
        className="field max-w-sm"
        placeholder={fr ? "Votre nom" : "Your name"}
        value={author}
        onChange={(e) => setAuthor(e.target.value)}
        required
        minLength={2}
        maxLength={60}
      />
      <textarea
        className="field min-h-[100px]"
        placeholder={fr ? "Votre commentaire…" : "Write a comment…"}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        required
        minLength={2}
        maxLength={2000}
      />
      {err && <p className="text-sm text-red-600">{err}</p>}
      <button type="submit" disabled={state === "sending"} className="btn-primary text-sm">
        {state === "sending" ? (fr ? "Envoi…" : "Sending…") : fr ? "Publier le commentaire" : "Post comment"}
      </button>
      <p className="text-xs text-ink-soft">{fr ? "Les commentaires sont modérés avant publication." : "Comments are moderated before they appear."}</p>
    </form>
  );
}
