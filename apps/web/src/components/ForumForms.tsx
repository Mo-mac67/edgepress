"use client";

import { useState } from "react";

/** New-topic and reply forms for the forum (both land in moderation). */
export function ForumForms({ mode, lang, threadId }: { mode: "thread" | "reply"; lang: string; threadId?: string }) {
  const fr = lang === "fr";
  const [open, setOpen] = useState(mode === "reply");
  const [author, setAuthor] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setErr("");
    const url = mode === "thread" ? "/api/forum" : `/api/forum/${threadId}/replies`;
    const payload = mode === "thread" ? { author, title, body } : { author, body };
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).catch(() => null);
    const d = await res?.json().catch(() => ({}));
    if (res?.ok) setState("done");
    else {
      setState("idle");
      setErr(d?.error || (fr ? "Échec de l'envoi" : "Couldn't post"));
    }
  }

  if (state === "done") {
    return (
      <p className="mt-6 rounded-lg bg-accent-soft p-4 text-sm font-medium text-accent-dark">
        {fr ? "Merci ! Votre message sera visible après modération." : "Thanks! Your post will appear once it's approved."}
      </p>
    );
  }

  if (!open) {
    return (
      <div className="mt-6 text-center">
        <button onClick={() => setOpen(true)} className="btn-primary">{fr ? "Nouveau sujet" : "Start a topic"}</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card mt-6 space-y-3 p-5">
      <h3 className="font-display font-bold text-brand">{mode === "thread" ? (fr ? "Nouveau sujet" : "Start a topic") : fr ? "Répondre" : "Write a reply"}</h3>
      <input className="field max-w-sm" placeholder={fr ? "Votre nom" : "Your name"} value={author} onChange={(e) => setAuthor(e.target.value)} required minLength={2} maxLength={60} />
      {mode === "thread" && (
        <input className="field" placeholder={fr ? "Titre du sujet" : "Topic title"} value={title} onChange={(e) => setTitle(e.target.value)} required minLength={4} maxLength={140} />
      )}
      <textarea className="field min-h-[110px]" placeholder={fr ? "Votre message…" : "Your message…"} value={body} onChange={(e) => setBody(e.target.value)} required minLength={2} maxLength={5000} />
      {err && <p className="text-sm text-red-600">{err}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={state === "sending"} className="btn-primary text-sm">{state === "sending" ? "…" : fr ? "Publier" : "Post"}</button>
        <span className="text-xs text-ink-soft">{fr ? "Modéré avant publication." : "Moderated before it appears."}</span>
      </div>
    </form>
  );
}
