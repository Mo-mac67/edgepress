"use client";

import { useState } from "react";

export function NewsletterSignup({ locale, placeholder, buttonLabel }: { locale: string; placeholder?: string; buttonLabel?: string }) {
  const fr = locale === "fr";
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setErr("");
    const res = await fetch("/api/newsletter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, locale }),
    }).catch(() => null);
    if (res?.ok) setState("done");
    else {
      const d = await res?.json().catch(() => ({}));
      setState("error");
      setErr(d?.error || (fr ? "Échec de l'inscription" : "Couldn't subscribe"));
    }
  }

  if (state === "done") {
    return <p className="mt-6 font-medium text-accent-dark">{fr ? "Merci ! Vous êtes inscrit·e." : "Thanks! You're on the list."}</p>;
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-6 flex max-w-md gap-2">
      <input
        type="email"
        required
        className="field flex-1"
        placeholder={placeholder || (fr ? "votre@email.com" : "you@email.com")}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button type="submit" disabled={state === "sending"} className="btn-primary whitespace-nowrap">
        {state === "sending" ? "…" : buttonLabel || (fr ? "S'inscrire" : "Subscribe")}
      </button>
      {err && <p className="w-full text-sm text-red-600">{err}</p>}
    </form>
  );
}
