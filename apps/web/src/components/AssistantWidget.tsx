"use client";

import { useRef, useState } from "react";
import type { Locale } from "@/i18n/config";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

/** Floating visitor-assistant chat, grounded in the site's own content.
 *  Only rendered when the owner enables it in the admin AI panel. */
export function AssistantWidget({ locale, brandName }: { locale: Locale; brandName: string }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const greeting = locale === "fr" ? `Bonjour ! Une question sur ${brandName} ?` : `Hi! Ask me anything about ${brandName}.`;

  async function send(text: string) {
    if (!text.trim() || busy) return;
    const next = [...msgs, { role: "user" as const, content: text }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, locale, history: msgs }),
      });
      const d = await res.json();
      setMsgs((m) => [...m, { role: "assistant", content: res.ok ? d.reply : locale === "fr" ? "Désolé, une erreur s'est produite." : "Sorry, something went wrong." }]);
    } finally {
      setBusy(false);
      setTimeout(() => scrollRef.current?.scrollTo({ top: 9e9, behavior: "smooth" }), 50);
    }
  }

  return (
    <div className="no-print fixed bottom-5 left-5 z-50">
      {open && (
        <div className="mb-3 flex h-[28rem] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-brand px-4 py-3 text-white">
            <span className="font-display text-sm font-bold">{brandName}</span>
            <button onClick={() => setOpen(false)} aria-label="Close" className="text-white/80 hover:text-white">✕</button>
          </div>
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-sand/40 p-3">
            {msgs.length === 0 && <p className="rounded-xl bg-white px-3 py-2 text-sm text-ink shadow-sm">{greeting}</p>}
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <p className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${m.role === "user" ? "bg-brand text-white" : "bg-white text-ink shadow-sm"}`}>{m.content}</p>
              </div>
            ))}
            {busy && <p className="rounded-2xl bg-white px-3 py-2 text-sm text-ink-soft shadow-sm">…</p>}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-center gap-2 border-t border-line p-2">
            <input className="flex-1 rounded-lg bg-sand px-3 py-2 text-sm focus:outline-none" placeholder={locale === "fr" ? "Écrivez un message…" : "Type a message…"} value={input} onChange={(e) => setInput(e.target.value)} />
            <button type="submit" disabled={busy || !input.trim()} className="rounded-lg bg-accent px-3 py-2 text-sm font-bold text-white disabled:opacity-50">→</button>
          </form>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Chat assistant"
        className="grid h-14 w-14 place-items-center rounded-full bg-brand text-white shadow-xl transition hover:scale-105"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.9-.9L3 21l1.9-5.6a8.5 8.5 0 0 1 3.6-11.4 8.38 8.38 0 0 1 8.5.9A8.38 8.38 0 0 1 21 11.5z" /></svg>
      </button>
    </div>
  );
}
