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
  const setKey = (k: "anthropic" | "openai" | "google", v: string) => setCfg({ ...cfg, keys: { ...cfg.keys, [k]: v } });

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
          {(["anthropic", "openai", "google"] as const).map((k) => (
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
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={cfg.approveFirst} onChange={(e) => set({ approveFirst: e.target.checked })} />
          <span className="text-ink">Always create AI content as drafts (recommended)</span>
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
    </div>
  );
}
