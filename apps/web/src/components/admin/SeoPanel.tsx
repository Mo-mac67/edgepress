"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { useAdminUI } from "./ui";
import type { SeoSettings } from "@/lib/cms-types";
import type { PageAudit } from "@/lib/seo";
import type { Locale } from "@/i18n/config";

export function SeoPanel() {
  const ui = useAdminUI();
  const [seo, setSeo] = useState<SeoSettings | null>(null);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [siteUrl, setSiteUrl] = useState("");
  const [saved, setSaved] = useState(false);
  const [audits, setAudits] = useState<PageAudit[]>([]);
  const [auditLocale, setAuditLocale] = useState<Locale>("en");
  const [auditing, setAuditing] = useState(false);
  const [openAudit, setOpenAudit] = useState<string | null>(null);
  const [diag, setDiag] = useState<Record<string, { loading?: boolean; summary?: string; findings?: { issue: string; fix: string }[] }>>({});
  const [generating, setGenerating] = useState<string | null>(null);
  const [indexNowMsg, setIndexNowMsg] = useState("");

  useEffect(() => {
    fetch("/api/admin/seo").then(async (r) => {
      if (!r.ok) return;
      const d = await r.json();
      setSeo(d.seo);
      setAiAvailable(d.aiAvailable);
      setSiteUrl(d.siteUrl);
    });
  }, []);

  async function runAudit(locale: Locale = auditLocale) {
    setAuditing(true);
    const r = await fetch(`/api/admin/seo/audit?locale=${locale}`);
    if (r.ok) setAudits((await r.json()).audits);
    setAuditing(false);
  }
  useEffect(() => {
    runAudit("en");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function diagnose(pageId: string) {
    setDiag((d) => ({ ...d, [pageId]: { loading: true } }));
    setOpenAudit(pageId);
    const r = await fetch("/api/admin/ai/seo-diagnose", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pageId, locale: auditLocale }) });
    const data = await r.json();
    if (r.ok) setDiag((d) => ({ ...d, [pageId]: { summary: data.summary, findings: data.findings } }));
    else { setDiag((d) => ({ ...d, [pageId]: {} })); ui.toast(data.error || "Diagnosis failed", "error"); }
  }

  if (!seo) return <p className="text-sm text-ink-soft">Loading…</p>;
  const set = (patch: Partial<SeoSettings>) => setSeo({ ...seo, ...patch });

  async function save() {
    const r = await fetch("/api/admin/seo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seo }),
    });
    if (r.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  }

  async function aiGenerate(pageId: string) {
    setGenerating(pageId);
    const r = await fetch("/api/admin/seo/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageId, locale: auditLocale, apply: true }),
    });
    setGenerating(null);
    if (r.ok) {
      runAudit();
      ui.toast("SEO title & description generated", "success");
    } else {
      const d = await r.json().catch(() => ({}));
      ui.toast(d.error || "AI generation failed", "error");
    }
  }

  async function submitIndexNow() {
    setIndexNowMsg("Submitting…");
    const r = await fetch("/api/admin/seo/indexnow", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const d = await r.json().catch(() => ({}));
    setIndexNowMsg(r.ok ? `Submitted ${d.submitted} URLs to search engines ✓` : `Failed: ${d.error ?? d.status ?? "error"}`);
  }

  const scoreColor = (s: number) => (s >= 80 ? "text-green-700 bg-green-50" : s >= 50 ? "text-amber-700 bg-amber-50" : "text-red-700 bg-red-50");
  const Text = ({ label, value, onChange, ph }: { label: string; value: string; onChange: (v: string) => void; ph?: string }) => (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      <input className="field" value={value} placeholder={ph} onChange={(e) => onChange(e.target.value)} />
    </label>
  );

  return (
    <div className="space-y-6">
      {/* Page health audit */}
      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display font-bold text-brand">Page health</h3>
            <p className="mt-1 text-sm text-ink-soft">Automatic SEO checks for every published page — fix the red items first.</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="field max-w-[90px] py-2 text-sm"
              value={auditLocale}
              onChange={(e) => {
                const l = e.target.value as Locale;
                setAuditLocale(l);
                runAudit(l);
              }}
            >
              <option value="en">EN</option>
              <option value="fr">FR</option>
            </select>
            <button onClick={() => runAudit()} className="btn-secondary py-2 text-sm">
              <Icon name="refresh" size={15} /> {auditing ? "Analyzing…" : "Re-analyze"}
            </button>
          </div>
        </div>
        <div className="mt-4 divide-y divide-line">
          {audits.map((a) => (
            <div key={a.pageId} className="py-3">
              <div className="flex items-center gap-3">
                <span className={`grid h-10 w-12 place-items-center rounded-lg text-sm font-extrabold ${scoreColor(a.score)}`}>{a.score}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-brand">{a.title}</p>
                  <p className="text-xs text-ink-soft">/{a.slug || "(home)"} · {a.checks.filter((c) => !c.pass).length} issue(s)</p>
                </div>
                <button
                  onClick={() => aiGenerate(a.pageId)}
                  disabled={!aiAvailable || generating === a.pageId}
                  title={aiAvailable ? "AI-write the SEO title & description" : "Set ANTHROPIC_API_KEY to enable"}
                  className="btn-secondary py-1.5 text-xs disabled:opacity-40"
                >
                  <Icon name="star" size={13} />
                  {generating === a.pageId ? "Writing…" : "AI meta"}
                </button>
                <button
                  onClick={() => diagnose(a.pageId)}
                  disabled={diag[a.pageId]?.loading}
                  title="AI: why won't this page rank, and how to fix it"
                  className="btn-secondary py-1.5 text-xs disabled:opacity-40"
                >
                  <Icon name="chart" size={13} />
                  {diag[a.pageId]?.loading ? "Analyzing…" : "Diagnose"}
                </button>
                <button onClick={() => setOpenAudit(openAudit === a.pageId ? null : a.pageId)} className="rounded p-2 hover:bg-sand">
                  <Icon name="chevron-down" size={16} className={openAudit === a.pageId ? "rotate-180" : ""} />
                </button>
              </div>
              {openAudit === a.pageId && (
                <>
                  <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                    {a.checks.map((c) => (
                      <li key={c.id} className="flex items-start gap-2 text-sm">
                        <Icon name={c.pass ? "check" : "x"} size={16} className={`mt-0.5 shrink-0 ${c.pass ? "text-green-600" : "text-red-500"}`} />
                        <span>
                          {c.label}
                          <span className="ml-1 text-xs text-ink-soft">({c.detail})</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  {diag[a.pageId]?.findings && (
                    <div className="mt-3 rounded-lg border border-accent/40 bg-accent/5 p-3">
                      <p className="text-sm font-semibold text-brand"><Icon name="star" size={13} className="mr-1 inline" />AI diagnosis</p>
                      {diag[a.pageId]!.summary && <p className="mt-1 text-sm text-ink-soft">{diag[a.pageId]!.summary}</p>}
                      <ul className="mt-2 space-y-2">
                        {diag[a.pageId]!.findings!.map((f, i) => (
                          <li key={i} className="text-sm">
                            <span className="font-medium text-ink">{f.issue}</span>
                            <span className="mt-0.5 block text-ink-soft">→ {f.fix}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
          {audits.length === 0 && <p className="py-6 text-center text-sm text-ink-soft">{auditing ? "Analyzing…" : "No published pages."}</p>}
        </div>
        {!aiAvailable && (
          <p className="mt-3 rounded-lg bg-sand p-3 text-xs text-ink-soft">
            💡 <b>AI meta writer</b> is off. Add an <code>ANTHROPIC_API_KEY</code> secret to the Worker and every page gets one-click AI titles &amp; descriptions.
          </p>
        )}
      </section>

      <FreshnessCard />

      {/* Instant indexing */}
      <section className="card p-5">
        <h3 className="font-display font-bold text-brand">Instant indexing (IndexNow)</h3>
        <p className="mt-1 text-sm text-ink-soft">
          Every time a page or post is published, the site automatically pings Bing, Yandex and other IndexNow engines
          (key file: <a href={`${siteUrl}/indexnow-key.txt`} target="_blank" rel="noopener noreferrer" className="text-accent-dark underline">/indexnow-key.txt</a>).
          Google reads the sitemap at{" "}
          <a href={`${siteUrl}/sitemap.xml`} target="_blank" rel="noopener noreferrer" className="text-accent-dark underline">/sitemap.xml</a> — submit it once in Google Search Console.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={seo.autoIndexNow} onChange={(e) => set({ autoIndexNow: e.target.checked })} />
            Auto-ping on publish
          </label>
          <button onClick={submitIndexNow} className="btn-secondary py-2 text-sm">
            <Icon name="arrow-up-right" size={15} /> Submit all pages now
          </button>
          {indexNowMsg && <span className="text-sm text-ink-soft">{indexNowMsg}</span>}
        </div>
      </section>

      {/* Tracking & verification */}
      <section className="card p-5">
        <h3 className="font-display font-bold text-brand">Tracking &amp; verification codes</h3>
        <p className="mt-1 text-sm text-ink-soft">Paste an ID and the tag is injected on every page automatically — no code needed.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Text label="Google Analytics 4 (G-…)" value={seo.ga4Id} ph="G-XXXXXXXXXX" onChange={(v) => set({ ga4Id: v.trim() })} />
          <Text label="Google Tag Manager (GTM-…)" value={seo.gtmId} ph="GTM-XXXXXXX" onChange={(v) => set({ gtmId: v.trim() })} />
          <Text label="Meta (Facebook) Pixel ID" value={seo.fbPixelId} ph="1234567890" onChange={(v) => set({ fbPixelId: v.trim() })} />
          <Text label="Google site verification" value={seo.googleVerification} ph="content value from Search Console" onChange={(v) => set({ googleVerification: v.trim() })} />
          <Text label="Bing site verification" value={seo.bingVerification} ph="content value from Bing Webmaster" onChange={(v) => set({ bingVerification: v.trim() })} />
        </div>
      </section>

      {/* Structured data */}
      <section className="card p-5">
        <h3 className="font-display font-bold text-brand">Business schema (rich results)</h3>
        <p className="mt-1 text-sm text-ink-soft">Powers the Google business card / map results. Injected as JSON-LD structured data using your Site info.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink">Business type</span>
            <select className="field" value={seo.business.type} onChange={(e) => set({ business: { ...seo.business, type: e.target.value } })}>
              <option value="GeneralContractor">General Contractor</option>
              <option value="HomeAndConstructionBusiness">Home &amp; Construction Business</option>
              <option value="LocalBusiness">Local Business</option>
            </select>
          </label>
          <Text label="Price range" value={seo.business.priceRange} ph="$$$" onChange={(v) => set({ business: { ...seo.business, priceRange: v } })} />
          <Text label="Opening hours" value={seo.business.openingHours} ph="Mo-Fr 08:00-18:00" onChange={(v) => set({ business: { ...seo.business, openingHours: v } })} />
          <Text label="Latitude" value={seo.business.latitude} ph="43.6435" onChange={(v) => set({ business: { ...seo.business, latitude: v } })} />
          <Text label="Longitude" value={seo.business.longitude} ph="-79.4032" onChange={(v) => set({ business: { ...seo.business, longitude: v } })} />
          <Text label="Default share image" value={seo.defaultOgImage} ph="/images/photos/hero-custom-home.jpg" onChange={(v) => set({ defaultOgImage: v })} />
        </div>
      </section>

      <button onClick={save} className="btn-primary">{saved ? "Saved — live on the site ✓" : "Save SEO settings"}</button>

      <RedirectsCard />
    </div>
  );
}

/** Redirect manager — keeps old URLs alive after a migration or re-slug. */
function RedirectsCard() {
  const [rules, setRules] = useState<{ id: string; from: string; to: string; code: number }[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [code, setCode] = useState<301 | 302>(301);
  const [err, setErr] = useState("");

  async function load() {
    const res = await fetch("/api/admin/redirects");
    if (res.ok) setRules((await res.json()).redirects ?? []);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    setErr("");
    const res = await fetch("/api/admin/redirects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ from, to, code }) });
    const d = await res.json().catch(() => ({}));
    if (res.ok) { setFrom(""); setTo(""); load(); }
    else setErr(d.error || "Couldn't add the rule");
  }

  async function del(id: string) {
    await fetch(`/api/admin/redirects?id=${id}`, { method: "DELETE" });
    load();
  }

  return (
    <section className="card p-5">
      <h3 className="font-display font-bold text-brand">Redirects</h3>
      <p className="mt-1 text-sm text-ink-soft">
        Old URLs keep working after a migration or a slug change. Checked only when a page isn&apos;t found. <code className="rounded bg-surface-soft px-1">/old/*</code> matches a whole section; a trailing <code className="rounded bg-surface-soft px-1">*</code> in the target carries the rest of the path over.
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
        <input className="field" placeholder="/old-page.html or /old-blog/*" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input className="field" placeholder="/en/new-page or /en/blog/*" value={to} onChange={(e) => setTo(e.target.value)} />
        <select className="field" value={code} onChange={(e) => setCode(Number(e.target.value) as 301 | 302)}>
          <option value={301}>301 permanent</option>
          <option value={302}>302 temporary</option>
        </select>
        <button onClick={add} className="btn-secondary">Add</button>
      </div>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      {rules.length > 0 && (
        <ul className="mt-4 divide-y divide-line">
          {rules.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0 truncate"><code className="text-brand">{r.from}</code> <span className="text-ink-soft">→</span> <code>{r.to}</code> <span className="text-xs text-ink-soft">({r.code})</span></span>
              <button onClick={() => del(r.id)} className="shrink-0 text-xs font-semibold text-red-600">Delete</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Content freshness — lists published pages not updated in a while, so stale
 *  content is easy to find and refresh. */
function FreshnessCard() {
  const STALE_DAYS = 120;
  const [stale, setStale] = useState<{ id: string; slug: string; title: string; days: number }[]>([]);
  const loc = (typeof window !== "undefined" && window.location.pathname.split("/")[1]) || "en";

  useEffect(() => {
    fetch("/api/admin/pages").then(async (r) => {
      if (!r.ok) return;
      const { pages } = await r.json();
      const now = Date.now();
      const rows = (pages as { id: string; slug: string; status: string; title: Record<string, string>; updatedAt?: string }[])
        .filter((p) => p.status === "published" && p.updatedAt)
        .map((p) => ({ id: p.id, slug: p.slug, title: p.title?.en || p.slug || "Home", days: Math.floor((now - +new Date(p.updatedAt!)) / 86_400_000) }))
        .filter((p) => p.days >= STALE_DAYS)
        .sort((a, b) => b.days - a.days);
      setStale(rows);
    });
  }, []);

  return (
    <section className="card p-5">
      <h3 className="font-display font-bold text-brand">Content freshness</h3>
      <p className="mt-1 text-sm text-ink-soft">Published pages not updated in over {STALE_DAYS} days — refreshing old content helps rankings.</p>
      {stale.length === 0 ? (
        <p className="mt-3 text-sm text-green-700">✓ All published pages are reasonably fresh.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {stale.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0 truncate"><span className="font-medium text-brand">{p.title}</span> <span className="text-ink-soft">/{p.slug || "(home)"}</span></span>
              <span className="flex shrink-0 items-center gap-3">
                <span className="text-ink-soft">{p.days}d old</span>
                <a href={`/${loc}/admin/pages/${p.id}`} className="font-semibold text-accent-dark">Update →</a>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
