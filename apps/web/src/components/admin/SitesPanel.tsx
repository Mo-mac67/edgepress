"use client";

import { useEffect, useState } from "react";
import { useAdminUI } from "./ui";

/**
 * The agency console: every EdgePress site you run, in one table.
 *
 * A studio with six client sites otherwise has six admin panels to open, six
 * version numbers to remember and six places a lead can sit unread. This shows
 * counts and staleness only — never a client's actual data.
 */

interface SiteSummary {
  id: string;
  name: string;
  url: string;
  addedAt: string;
  hasKey: boolean;
  lastCheckedAt?: string;
  lastError?: string;
  lastStatus?: {
    version?: string;
    latest?: string | null;
    updateAvailable?: boolean;
    counts?: { pages: number; pagesTotal: number; posts: number; postsTotal?: number; leads: number; newLeads: number };
    newestLeadAt?: string | null;
    storage?: string;
  };
}

interface Summary { total: number; unreachable: number; needUpdate: number; newLeads: number }

const ago = (iso?: string | null): string => {
  if (!iso) return "—";
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (!Number.isFinite(mins)) return "—";
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
};

export function SitesPanel() {
  const ui = useAdminUI();
  const [sites, setSites] = useState<SiteSummary[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", url: "", apiKey: "" });
  const [err, setErr] = useState("");

  async function load() {
    const res = await fetch("/api/admin/sites");
    if (!res.ok) { setSites([]); return; }
    const d = await res.json();
    setSites(d.sites);
    setSummary(d.summary);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    setErr("");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/sites", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok) { setErr(d.error || "Could not add that site"); return; }
      setForm({ name: "", url: "", apiKey: "" });
      ui.toast("Site added", "success");
      load();
    } finally { setBusy(false); }
  }

  async function refreshAll() {
    setBusy(true);
    ui.toast("Checking every site…");
    try {
      const res = await fetch("/api/admin/sites", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "refresh-all" }),
      });
      if (res.ok) { const d = await res.json(); setSites(d.sites); setSummary(d.summary); ui.toast("Up to date", "success"); }
    } finally { setBusy(false); }
  }

  async function remove(site: SiteSummary) {
    const yes = await ui.confirm({
      title: `Remove ${site.name}?`,
      message: "This only removes it from your console. The site itself and its content are untouched.",
      confirmLabel: "Remove",
    });
    if (!yes) return;
    await fetch(`/api/admin/sites?id=${site.id}`, { method: "DELETE" });
    ui.toast("Removed from the console");
    load();
  }

  if (!sites) return <p className="text-sm text-ink-soft">Loading…</p>;

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-display font-bold text-brand">Your sites</h3>
            <p className="mt-1 text-sm text-ink-soft">
              Every EdgePress install you run, in one place — versions, unread leads, and whether anything is down.
              Counts only; a client&rsquo;s data stays on their site.
            </p>
          </div>
          {sites.length > 0 && (
            <button onClick={refreshAll} disabled={busy} className="btn-secondary py-2 text-sm">
              {busy ? "Checking…" : "Check all"}
            </button>
          )}
        </div>

        {summary && sites.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-sand px-3 py-1 font-semibold text-ink">{summary.total} site{summary.total === 1 ? "" : "s"}</span>
            {summary.newLeads > 0 && <span className="rounded-full bg-accent-soft px-3 py-1 font-semibold text-accent-dark">{summary.newLeads} unread lead{summary.newLeads === 1 ? "" : "s"}</span>}
            {summary.needUpdate > 0 && <span className="rounded-full bg-accent-soft px-3 py-1 font-semibold text-accent-dark">{summary.needUpdate} need updating</span>}
            {summary.unreachable > 0 && <span className="rounded-full bg-red-100 px-3 py-1 font-semibold text-red-700">{summary.unreachable} unreachable</span>}
          </div>
        )}

        {sites.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-line p-4 text-sm text-ink-soft">
            No sites yet. On each site you run, create an API key (Developer → API keys) and add it below.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                  <th className="pb-2 pr-3">Site</th>
                  <th className="pb-2 pr-3">Version</th>
                  <th className="pb-2 pr-3">Content</th>
                  <th className="pb-2 pr-3">Leads</th>
                  <th className="pb-2 pr-3">Checked</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {sites.map((s) => (
                  <tr key={s.id} className={s.lastError ? "bg-red-50/60" : undefined}>
                    <td className="py-3 pr-3">
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-heading hover:underline">{s.name}</a>
                      <span className="block text-xs text-ink-soft">{s.url.replace(/^https?:\/\//, "")}</span>
                      {s.lastError && <span className="mt-1 block text-xs font-medium text-red-700">{s.lastError}</span>}
                    </td>
                    <td className="py-3 pr-3">
                      {s.lastStatus?.version ? (
                        <>
                          <span className="font-mono text-xs">{s.lastStatus.version}</span>
                          {s.lastStatus.updateAvailable && (
                            <span className="ml-2 rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-bold text-accent-dark">
                              → {s.lastStatus.latest}
                            </span>
                          )}
                        </>
                      ) : <span className="text-ink-soft">—</span>}
                    </td>
                    <td className="py-3 pr-3 text-ink-soft">
                      {s.lastStatus?.counts
                        ? `${s.lastStatus.counts.pages} page${s.lastStatus.counts.pages === 1 ? "" : "s"}, ${s.lastStatus.counts.posts} post${s.lastStatus.counts.posts === 1 ? "" : "s"}`
                        : "—"}
                    </td>
                    <td className="py-3 pr-3">
                      {s.lastStatus?.counts ? (
                        <>
                          {s.lastStatus.counts.newLeads > 0
                            ? <span className="font-semibold text-accent-dark">{s.lastStatus.counts.newLeads} new</span>
                            : <span className="text-ink-soft">none new</span>}
                          <span className="block text-xs text-ink-soft">last {ago(s.lastStatus.newestLeadAt)}</span>
                        </>
                      ) : <span className="text-ink-soft">—</span>}
                    </td>
                    <td className="py-3 pr-3 text-xs text-ink-soft">{ago(s.lastCheckedAt)}</td>
                    <td className="py-3 text-right">
                      <a href={`${s.url}/en/admin`} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-accent-dark hover:underline">Open admin</a>
                      <button onClick={() => remove(s)} className="ml-3 text-xs font-semibold text-red-600 hover:underline">Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card p-5">
        <h3 className="font-display font-bold text-brand">Add a site</h3>
        <p className="mt-1 text-sm text-ink-soft">
          On the site you want to add, go to <strong>Developer → API keys</strong>, create a key, and paste it here.
          The key is stored on this install and never shown again — revoke it there to cut this console off.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input className="field" placeholder="Name (optional)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="field" placeholder="https://client.com" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
          <span />
          <input className="field sm:col-span-2" placeholder="API key from that site" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} />
          <button onClick={add} disabled={busy || !form.url || !form.apiKey} className="btn-primary py-2 text-sm">
            {busy ? "Adding…" : "Add site"}
          </button>
        </div>
        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      </section>
    </div>
  );
}
