"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { useAdminUI } from "./ui";
import { AI_PROVIDERS, type AIConfig, type AIProviderId } from "@/lib/ai/types";

type UsageRow = { feature: string; provider: string; calls: number; inTokens: number; outTokens: number };

export function AiPanel() {
  const ui = useAdminUI();
  const [cfg, setCfg] = useState<AIConfig | null>(null);
  const [ready, setReady] = useState(false);
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);

  async function load() {
    const r = await fetch("/api/admin/ai");
    if (r.ok) {
      const d = await r.json();
      setCfg(d.config);
      setReady(d.ready);
      setUsage(d.usage ?? []);
    }
  }
  useEffect(() => {
    load();
  }, []);

  if (!cfg) return <p className="text-sm text-ink-soft">Loading…</p>;
  const set = (patch: Partial<AIConfig>) => setCfg({ ...cfg, ...patch });
  const setKey = (k: "anthropic" | "openai" | "google" | "replicate", v: string) => setCfg({ ...cfg, keys: { ...cfg.keys, [k]: v } });

  async function save() {
    const r = await fetch("/api/admin/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config: cfg }) });
    if (r.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      load();
      ui.toast("AI settings saved", "success");
    }
  }
  async function test() {
    setTesting(true);
    const r = await fetch("/api/admin/ai/test", { method: "POST" });
    const d = await r.json().catch(() => ({}));
    setTesting(false);
    ui.toast(r.ok ? `AI is working — replied “${d.reply}”` : `Test failed: ${d.error ?? "error"}`, r.ok ? "success" : "error");
  }

  const totalCalls = usage.reduce((s, r) => s + r.calls, 0);

  return (
    <div className="max-w-2xl space-y-5">
      <section className="card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display font-bold text-brand">AI provider</h3>
            <p className="mt-1 text-sm text-ink-soft">EdgePress works with a free on-edge model out of the box, or your own AI keys.</p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ready ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
            {ready ? "Ready" : "Not ready"}
          </span>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={cfg.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
          <span className="font-medium text-ink">AI features enabled</span>
        </label>

        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-medium text-ink">Default provider</span>
          <select className="field" value={cfg.defaultProvider} onChange={(e) => set({ defaultProvider: e.target.value as AIProviderId })}>
            {Object.values(AI_PROVIDERS).map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-ink-soft">{AI_PROVIDERS[cfg.defaultProvider].hint}</span>
        </label>

        <button onClick={test} disabled={testing || !cfg.enabled} className="btn-secondary mt-4 py-2 text-sm">
          <Icon name="refresh" size={15} /> {testing ? "Testing…" : "Test connection"}
        </button>
      </section>

      <section className="card p-5">
        <h3 className="font-display font-bold text-brand">Your API keys (optional)</h3>
        <p className="mt-1 text-sm text-ink-soft">Bring your own keys for premium models. Keys are stored on your site and never shown again.</p>
        <div className="mt-4 space-y-3">
          {(["anthropic", "openai", "google", "replicate"] as const).map((k) => (
            <label key={k} className="block">
              <span className="mb-1 block text-sm font-medium capitalize text-ink">{k} API key</span>
              <input
                className="field"
                type="password"
                placeholder={cfg.keys[k] === "set" ? "•••••••• (saved — type to replace)" : "Paste your key"}
                value={cfg.keys[k] === "set" ? "" : cfg.keys[k]}
                onChange={(e) => setKey(k, e.target.value)}
              />
            </label>
          ))}
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink">Ollama server URL</span>
            <input className="field" value={cfg.ollamaUrl} onChange={(e) => set({ ollamaUrl: e.target.value })} placeholder="http://localhost:11434" />
          </label>
        </div>
      </section>

      <section className="card p-5">
        <h3 className="font-display font-bold text-brand">Brand voice</h3>
        <p className="mt-1 text-sm text-ink-soft">Describe your tone so every AI-written piece sounds like you.</p>
        <textarea
          className="field mt-3 min-h-[80px]"
          value={cfg.brandVoice}
          placeholder="e.g. Warm, confident, plain-spoken. We avoid jargon and hype."
          onChange={(e) => set({ brandVoice: e.target.value })}
        />
        <button
          type="button"
          onClick={async () => {
            ui.toast("Reading your published content…");
            const r = await fetch("/api/admin/ai/learn-voice", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
            const d = await r.json().catch(() => ({}));
            if (r.ok && d.voice) { set({ brandVoice: d.voice }); ui.toast("Voice drafted from your content — review and Save", "success"); }
            else ui.toast(d.error || "Couldn't learn the voice", "error");
          }}
          className="btn-secondary mt-2 py-1.5 text-xs"
          title="AI reads your published pages/posts and drafts a voice description"
        >
          Learn from my content
        </button>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={cfg.approveFirst} onChange={(e) => set({ approveFirst: e.target.checked })} />
          <span className="text-ink">Always create AI content as drafts (recommended)</span>
        </label>

        <div className="mt-5 border-t border-line pt-4">
          <p className="text-sm font-semibold text-ink">Translation glossary</p>
          <p className="mt-1 text-xs text-ink-soft">Brand terms to keep consistent across languages — one per line (e.g. <code>EdgePress → EdgePress (do not translate)</code>). Applied to every translation.</p>
          <textarea
            className="field mt-2 min-h-[80px] font-mono text-xs"
            value={cfg.glossary ?? ""}
            placeholder={"EdgePress → keep as-is\nEdge → «Edge» (garder en anglais)"}
            onChange={(e) => set({ glossary: e.target.value })}
          />
        </div>
      </section>

      <section className="card p-5">
        <h3 className="font-display font-bold text-brand">Visitor assistant</h3>
        <p className="mt-1 text-sm text-ink-soft">A chat bubble on your live site that answers visitors&apos; questions from your own pages.</p>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={cfg.assistantEnabled} onChange={(e) => set({ assistantEnabled: e.target.checked })} />
          <span className="text-ink">Show the assistant on my site</span>
        </label>
      </section>

      <section className="card p-5">
        <h3 className="font-display font-bold text-brand">AI call budget</h3>
        <p className="mt-1 text-sm text-ink-soft">Safety cap on total AI calls — 0 means unlimited. Once reached, AI features stop until you raise it (guards against runaway loops or abuse).</p>
        <input type="number" min={0} className="field mt-3 max-w-[220px]" value={cfg.callBudget ?? 0} onChange={(e) => set({ callBudget: Math.max(0, Number(e.target.value) || 0) })} />
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={cfg.cacheEnabled !== false} onChange={(e) => set({ cacheEnabled: e.target.checked })} />
          <span className="text-ink">Cache identical AI responses for 7 days (saves tokens)</span>
        </label>
      </section>

      {usage.length > 0 && (
        <section className="card p-5">
          <h3 className="font-display font-bold text-brand">Usage <span className="text-sm font-normal text-ink-soft">· {totalCalls} calls</span></h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-ink-soft"><th className="py-1 pr-4">Feature</th><th className="pr-4">Provider</th><th className="pr-4">Calls</th><th>Tokens (in/out)</th></tr></thead>
              <tbody>
                {usage.map((r, i) => (
                  <tr key={i} className="border-t border-line"><td className="py-1.5 pr-4">{r.feature}</td><td className="pr-4 text-ink-soft">{r.provider}</td><td className="pr-4">{r.calls}</td><td className="text-ink-soft">{r.inTokens}/{r.outTokens}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <button onClick={save} className="btn-primary">{saved ? "Saved ✓" : "Save AI settings"}</button>

      <AiTools ready={ready} />
      <McpSection />
    </div>
  );
}

/** Standalone AI utilities: A/B title ideas + whole-site translation. */
function AiTools({ ready }: { ready: boolean }) {
  const ui = useAdminUI();
  const [topic, setTopic] = useState("");
  const [titles, setTitles] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [linkText, setLinkText] = useState("");
  const [links, setLinks] = useState<{ slug: string; anchor: string }[]>([]);
  const [linking, setLinking] = useState(false);
  const [intentText, setIntentText] = useState("");
  const [intent, setIntent] = useState("");
  const [intentBusy, setIntentBusy] = useState(false);
  const [intentRes, setIntentRes] = useState<{ summary?: string; findings?: { issue: string; fix: string }[] } | null>(null);

  async function genTitles() {
    if (!topic.trim()) return ui.toast("Enter a topic or draft headline", "error");
    setBusy(true); setTitles([]);
    const res = await fetch("/api/admin/ai/titles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) setTitles(data.titles ?? []);
    else ui.toast(data.error || "Couldn't generate titles", "error");
  }

  async function suggestLinks() {
    if (!linkText.trim()) return ui.toast("Paste some content first", "error");
    setLinking(true); setLinks([]);
    const res = await fetch("/api/admin/ai/links", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: linkText }) });
    const data = await res.json().catch(() => ({}));
    setLinking(false);
    if (res.ok) { setLinks(data.links ?? []); if (!data.links?.length) ui.toast("No internal links suggested", "info"); }
    else ui.toast(data.error || "Couldn't suggest links", "error");
  }

  async function runIntent() {
    if (!intentText.trim() || !intent.trim()) return ui.toast("Add content and a target intent", "error");
    setIntentBusy(true); setIntentRes(null);
    const res = await fetch("/api/admin/ai/intent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: intentText, intent }) });
    const data = await res.json();
    setIntentBusy(false);
    if (res.ok) setIntentRes(data);
    else ui.toast(data.error || "Couldn't analyze", "error");
  }

  async function translateSite(to: string) {
    const label = to === "fr" ? "French" : "English";
    if (!(await ui.confirm({ title: `Translate all pages to ${label}?`, message: "Adds the translation to every page — existing content is preserved. Uses one AI call per page.", confirmLabel: "Translate all" }))) return;
    setTranslating(true);
    const res = await fetch("/api/admin/ai/translate-site", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to }) });
    const data = await res.json().catch(() => ({}));
    setTranslating(false);
    ui.toast(res.ok ? `Translated ${data.translated} page(s) to ${label}` : (data.error || "Translation failed"), res.ok ? "success" : "error");
  }

  if (!ready) return null;

  return (
    <section className="card p-5">
      <h3 className="font-display font-bold text-brand">AI tools</h3>

      <div className="mt-4">
        <p className="text-sm font-medium text-ink">A/B title ideas</p>
        <div className="mt-2 flex gap-2">
          <input className="field" placeholder="Topic or draft headline…" value={topic} onChange={(e) => setTopic(e.target.value)} onKeyDown={(e) => e.key === "Enter" && genTitles()} />
          <button onClick={genTitles} disabled={busy} className="btn-secondary shrink-0">{busy ? "Thinking…" : "Suggest"}</button>
        </div>
        {titles.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {titles.map((t, i) => (
              <li key={i} className="flex items-center justify-between gap-2 rounded-lg bg-surface-soft px-3 py-2 text-sm">
                <span>{t}</span>
                <button onClick={() => { navigator.clipboard?.writeText(t); ui.toast("Copied", "success"); }} className="shrink-0 text-xs font-semibold text-brand">Copy</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 border-t border-line pt-4">
        <p className="text-sm font-medium text-ink">Internal link suggestions</p>
        <p className="mt-1 text-xs text-ink-soft">Paste content — get anchors linking to your existing pages (better SEO + navigation).</p>
        <textarea className="field mt-2 min-h-[90px]" placeholder="Paste a paragraph or a page's content…" value={linkText} onChange={(e) => setLinkText(e.target.value)} />
        <button onClick={suggestLinks} disabled={linking} className="btn-secondary mt-2">{linking ? "Analyzing…" : "Suggest internal links"}</button>
        {links.length > 0 && (
          <ul className="mt-3 space-y-1.5 text-sm">
            {links.map((l, i) => (
              <li key={i} className="rounded-lg bg-surface-soft px-3 py-2">
                “{l.anchor}” → <code className="text-accent-dark">/{l.slug}</code>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 border-t border-line pt-4">
        <p className="text-sm font-medium text-ink">Search-intent optimizer</p>
        <p className="mt-1 text-xs text-ink-soft">Paste content + the intent you want it to satisfy — get gaps and fixes.</p>
        <input className="field mt-2" placeholder="Target intent — e.g. 'compare tankless vs tank water heaters'" value={intent} onChange={(e) => setIntent(e.target.value)} />
        <textarea className="field mt-2 min-h-[80px]" placeholder="Paste the page content…" value={intentText} onChange={(e) => setIntentText(e.target.value)} />
        <button onClick={runIntent} disabled={intentBusy} className="btn-secondary mt-2">{intentBusy ? "Analyzing…" : "Optimize for intent"}</button>
        {intentRes && (
          <div className="mt-3 rounded-lg border border-line p-3 text-sm">
            {intentRes.summary && <p className="text-ink-soft">{intentRes.summary}</p>}
            <ul className="mt-2 space-y-2">
              {(intentRes.findings ?? []).map((f, i) => (
                <li key={i}><span className="font-medium text-ink">{f.issue}</span><span className="mt-0.5 block text-ink-soft">→ {f.fix}</span></li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="mt-6 border-t border-line pt-4">
        <p className="text-sm font-medium text-ink">Whole-site translation</p>
        <p className="mt-1 text-xs text-ink-soft">Fill a language across every page in one go (additive — nothing is overwritten).</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button onClick={() => translateSite("fr")} disabled={translating} className="btn-secondary">{translating ? "Translating…" : "Translate all → French"}</button>
          <button onClick={() => translateSite("en")} disabled={translating} className="btn-secondary">{translating ? "Translating…" : "Translate all → English"}</button>
        </div>
      </div>
    </section>
  );
}

/** MCP server: expose the site as tools to external agents (Claude, etc.). */
function McpSection() {
  const ui = useAdminUI();
  const [mcp, setMcp] = useState<{ enabled: boolean; token: string; url: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/mcp").then(async (r) => r.ok && setMcp(await r.json()));
  }, []);
  if (!mcp) return null;

  async function update(payload: Record<string, unknown>) {
    const r = await fetch("/api/admin/mcp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (r.ok) {
      const d = await r.json();
      setMcp((m) => (m ? { ...m, ...d } : m));
    }
  }

  return (
    <section className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display font-bold text-brand">Manage from chat (MCP)</h3>
          <p className="mt-1 text-sm text-ink-soft">Expose your site as tools to Claude or any MCP agent — create pages, translate, publish, read leads, all from a chat.</p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-sm">
          <input type="checkbox" checked={mcp.enabled} onChange={(e) => update({ enabled: e.target.checked })} />
          {mcp.enabled ? "On" : "Off"}
        </label>
      </div>
      {mcp.enabled && (
        <div className="mt-4 space-y-2 rounded-lg bg-sand p-3 text-sm">
          <div><span className="font-medium text-ink">Server URL:</span> <code className="break-all text-ink-soft">{mcp.url}</code></div>
          <div className="flex items-center gap-2"><span className="font-medium text-ink">Token:</span> <code className="break-all text-ink-soft">{mcp.token}</code>
            <button onClick={() => { navigator.clipboard?.writeText(mcp.token); ui.toast("Token copied", "success"); }} className="text-xs font-semibold text-accent-dark hover:underline">Copy</button>
          </div>
          <button onClick={() => update({ regenerate: true })} className="text-xs font-semibold text-red-600 hover:underline">Regenerate token</button>
          <p className="pt-1 text-xs text-ink-soft">Add it to an MCP client as an HTTP server with header <code>Authorization: Bearer &lt;token&gt;</code>.</p>
        </div>
      )}
    </section>
  );
}
