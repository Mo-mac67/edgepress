"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useAdminUI } from "./ui";
import type { Locale } from "@/i18n/config";

type Action =
  | { type: "create_page"; title: string; prompt: string }
  | { type: "translate_page"; slug: string; to: "en" | "fr" }
  | { type: "build_site"; description: string };

interface Msg {
  role: "user" | "assistant";
  content: string;
  action?: Action | null;
  done?: boolean;
}

const SUGGESTIONS = [
  "Create a pricing page",
  "Write an About page for a bakery",
  "Translate the home page to French",
];

export function CopilotPanel({ locale }: { locale: Locale }) {
  const ui = useAdminUI();
  const router = useRouter();
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "assistant", content: "Hi! I'm your site assistant. Ask me to create a page, translate content, or build a whole site — I'll propose it and you confirm." }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    const history = msgs.filter((m) => !m.action).map((m) => ({ role: m.role, content: m.content }));
    setMsgs((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/ai/copilot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text, history, locale }) });
      const d = await res.json();
      if (res.ok) setMsgs((m) => [...m, { role: "assistant", content: d.reply, action: d.action }]);
      else setMsgs((m) => [...m, { role: "assistant", content: d.error || "Something went wrong." }]);
    } finally {
      setBusy(false);
      setTimeout(() => scrollRef.current?.scrollTo({ top: 9e9, behavior: "smooth" }), 50);
    }
  }

  async function runAction(idx: number, action: Action) {
    setRunning(true);
    try {
      if (action.type === "create_page") {
        const r = await fetch("/api/admin/ai/generate-page", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: `${action.title}: ${action.prompt}`, locale }) });
        const d = await r.json();
        if (r.ok) {
          ui.toast("Draft page created", "success");
          router.push(`/${locale}/admin/pages/${d.page.id}`);
        } else ui.toast(d.error || "Failed", "error");
      } else if (action.type === "translate_page") {
        const pagesRes = await (await fetch("/api/admin/pages")).json();
        const page = pagesRes.pages.find((p: { slug: string; id: string }) => p.slug === action.slug);
        if (!page) return ui.toast("Page not found", "error");
        const from = action.to === "fr" ? "en" : "fr";
        const r = await fetch("/api/admin/ai/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pageId: page.id, from, to: action.to }) });
        ui.toast(r.ok ? "Page translated" : "Translation failed", r.ok ? "success" : "error");
      } else if (action.type === "build_site") {
        if (!(await ui.confirm({ title: "Build a whole site?", message: "This replaces the theme, menu and brand name and adds draft pages. You can review everything after.", confirmLabel: "Build it" }))) return;
        const r = await fetch("/api/admin/ai/build-site", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description: action.description, locale }) });
        const d = await r.json();
        ui.toast(r.ok ? `Built ${d.pages.length} draft pages` : d.error || "Build failed", r.ok ? "success" : "error");
        if (r.ok) router.refresh();
      }
      setMsgs((m) => m.map((x, i) => (i === idx ? { ...x, done: true } : x)));
    } finally {
      setRunning(false);
    }
  }

  function describeAction(a: Action): string {
    if (a.type === "create_page") return `Create a page “${a.title}”`;
    if (a.type === "translate_page") return `Translate “${a.slug || "home"}” to ${a.to.toUpperCase()}`;
    return `Build a whole site: ${a.description}`;
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-11rem)] max-w-2xl flex-col">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto pb-4">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${m.role === "user" ? "bg-brand text-white" : "bg-white text-ink shadow-sm ring-1 ring-line"}`}>
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.action && (
                <div className="mt-3 rounded-xl border border-accent/30 bg-accent-soft/40 p-3">
                  <p className="text-xs font-semibold text-accent-dark">Proposed action</p>
                  <p className="mt-0.5 text-sm text-ink">{describeAction(m.action)}</p>
                  <button
                    onClick={() => runAction(i, m.action as Action)}
                    disabled={running || m.done}
                    className="btn-primary mt-2 py-1.5 text-xs disabled:opacity-50"
                  >
                    {m.done ? "Done ✓" : running ? "Working…" : "Do it"}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && <div className="flex justify-start"><div className="rounded-2xl bg-white px-4 py-2.5 text-sm text-ink-soft shadow-sm ring-1 ring-line">Thinking…</div></div>}
      </div>

      {msgs.length <= 1 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => send(s)} className="rounded-full border border-line bg-white px-3 py-1.5 text-xs text-ink-soft hover:border-brand hover:text-brand">{s}</button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 rounded-xl border border-line bg-white p-2"
      >
        <input className="flex-1 bg-transparent px-2 text-sm focus:outline-none" placeholder="Ask the assistant…" value={input} onChange={(e) => setInput(e.target.value)} />
        <button type="submit" disabled={busy || !input.trim()} className="btn-primary py-2 text-sm disabled:opacity-50">
          <Icon name="arrow-up-right" size={15} />
        </button>
      </form>
      <p className="mt-2 text-center text-[11px] text-ink-soft">The assistant proposes actions — nothing changes until you click “Do it”.</p>
    </div>
  );
}
