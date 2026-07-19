"use client";

import { useEffect, useState } from "react";
import { marketDict } from "@/lib/marketplace-i18n";
import { useAdminUI } from "./ui";
import type { Tender } from "@/lib/tenders-store";
import type { User } from "@/lib/user-auth";

type TenderWithBids = Tender & { bidCount: number };

/**
 * Self-contained admin panel for the project marketplace: review/approve
 * projects, verify providers, and manage site-user passwords (send reset
 * link / set temporary password). Drop into any AdminDashboard as a new tab:
 *   {tab === "marketplace" && <MarketplacePanel locale={locale} />}
 */
export function MarketplacePanel({ locale }: { locale: string }) {
  const ui = useAdminUI();
  const d = marketDict(locale);
  const t = d.admin;
  const nf = new Intl.NumberFormat(locale === "fr" ? "fr-CA" : "en-CA");

  const [tenders, setTenders] = useState<TenderWithBids[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [resetInfo, setResetInfo] = useState<{ id: string; url: string; emailed: boolean } | null>(null);
  const [pwFor, setPwFor] = useState<string | null>(null);
  const [pwValue, setPwValue] = useState("");
  const [pwDone, setPwDone] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/marketplace")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data) => {
        setTenders(data.tenders ?? []);
        setUsers(data.users ?? []);
        setLoaded(true);
      })
      .catch(() => setError(t.loadError));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function setTenderState(id: string, status: string) {
    setTenders((prev) => prev.map((x) => (x.id === id ? { ...x, status: status as Tender["status"] } : x)));
    await fetch(`/api/tenders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  async function act(payload: Record<string, unknown>): Promise<Response> {
    return fetch("/api/admin/marketplace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  async function setVerified(id: string, verified: boolean) {
    setUsers((prev) => prev.map((u) => (u.id === id && u.business ? { ...u, business: { ...u.business, verified } } : u)));
    await act({ action: "verify", id, verified });
  }

  async function sendResetLink(u: User) {
    setResetInfo(null);
    const res = await act({ action: "reset-link", id: u.id, email: u.email, lang: locale });
    if (res.ok) {
      const data = await res.json();
      setResetInfo({ id: u.id, url: data.url, emailed: !!data.emailed });
    }
  }

  async function setTempPassword(id: string) {
    if (pwValue.length < 6) return;
    const res = await act({ action: "set-password", id, password: pwValue });
    if (res.ok) {
      setPwDone(id);
      setPwFor(null);
      setPwValue("");
    }
  }

  async function removeUser(id: string) {
    if (!(await ui.confirm({ title: t.removeConfirm, confirmLabel: "Remove", danger: true }))) return;
    setUsers((prev) => prev.filter((u) => u.id !== id));
    await act({ action: "remove-user", id });
  }

  const pending = tenders.filter((x) => x.status === "pending");
  const statusLabel = (s: string) => d.market.statuses[s] ?? s;

  if (error) return <p className="py-10 text-center text-sm text-red-600">{error}</p>;
  if (!loaded) return <p className="py-10 text-center text-sm text-ink-soft">…</p>;

  return (
    <div className="space-y-8">
      {/* Pending projects */}
      <Panel title={`${t.pending}${pending.length ? ` (${pending.length})` : ""}`}>
        {pending.length === 0 ? (
          <p className="text-sm text-ink-soft">{t.noPending}</p>
        ) : (
          <ul className="space-y-2">
            {pending.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line px-4 py-3">
                <div className="min-w-[200px] flex-1">
                  <a href={`/${locale}/tenders/${x.id}`} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">
                    {x.title}
                  </a>
                  <p className="mt-0.5 text-sm text-ink-soft">
                    {x.ownerName}
                    {x.location ? ` · ${x.location}` : ""} · ${nf.format(x.totalMin)}–${nf.format(x.totalMax)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setTenderState(x.id, "open")} className="btn-primary px-3 py-1.5 text-xs">
                    {t.approve}
                  </button>
                  <button onClick={() => setTenderState(x.id, "closed")} className="btn-secondary px-3 py-1.5 text-xs">
                    {t.reject}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* All projects */}
      <Panel title={t.all}>
        {tenders.length === 0 ? (
          <p className="text-sm text-ink-soft">{t.noPending}</p>
        ) : (
          <ul className="space-y-2">
            {tenders.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-2 text-sm last:border-0">
                <div className="min-w-[200px] flex-1">
                  <a href={`/${locale}/tenders/${x.id}`} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">
                    {x.title}
                  </a>
                  <span className="ml-2 rounded bg-black/5 px-1.5 py-0.5 text-xs">{statusLabel(x.status)}</span>
                  <span className="ml-2 text-xs text-ink-soft">{x.bidCount} {t.bidsShort}</span>
                </div>
                {x.status === "open" && (
                  <button onClick={() => setTenderState(x.id, "closed")} className="btn-secondary px-3 py-1 text-xs">
                    {t.close}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* Site users */}
      <Panel title={t.users}>
        {users.length === 0 ? (
          <p className="text-sm text-ink-soft">{t.noUsers}</p>
        ) : (
          <ul className="space-y-3">
            {users.map((u) => (
              <li key={u.id} className="rounded-xl border border-line px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-[200px] flex-1">
                    <span className="font-medium">{u.role === "business" ? u.business?.company : u.name}</span>
                    {u.business?.trade ? <span className="ml-2 rounded bg-black/5 px-1.5 py-0.5 text-xs text-ink-soft">{u.business.trade}</span> : null}
                    {u.role === "business" && (
                      <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${u.business?.verified ? "bg-black/10" : "bg-black/5 text-ink-soft"}`}>
                        {u.business?.verified ? d.auth.verifiedBadge : d.auth.pendingBadge}
                      </span>
                    )}
                    <p className="mt-0.5 text-xs text-ink-soft">
                      {u.name} · {u.email}
                      {u.business?.regions?.length ? ` · ${u.business.regions.join(", ")}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {u.role === "business" && (
                      <button onClick={() => setVerified(u.id, !u.business?.verified)} className={u.business?.verified ? "btn-secondary px-3 py-1.5 text-xs" : "btn-primary px-3 py-1.5 text-xs"}>
                        {u.business?.verified ? t.unverify : t.verify}
                      </button>
                    )}
                    <button onClick={() => sendResetLink(u)} className="btn-secondary px-3 py-1.5 text-xs">
                      {t.resetLink}
                    </button>
                    <button onClick={() => { setPwFor(pwFor === u.id ? null : u.id); setPwValue(""); setPwDone(null); }} className="btn-secondary px-3 py-1.5 text-xs">
                      {t.tempPassword}
                    </button>
                    <button onClick={() => removeUser(u.id)} className="px-2 py-1.5 text-xs font-semibold text-red-600">
                      {t.removeUser}
                    </button>
                  </div>
                </div>

                {resetInfo?.id === u.id && (
                  <div className="mt-3 rounded-lg bg-black/5 p-3 text-xs">
                    <p className="font-medium">{t.resetLinkDone}</p>
                    <input
                      readOnly
                      className="field mt-1.5 w-full font-mono text-xs"
                      value={resetInfo.url}
                      onFocus={(e) => e.currentTarget.select()}
                    />
                    <p className="mt-1.5 text-ink-soft">{resetInfo.emailed ? t.emailedYes : t.emailedNo}</p>
                  </div>
                )}

                {pwFor === u.id && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      className="field max-w-[220px] text-sm"
                      placeholder={t.tempPassword}
                      value={pwValue}
                      onChange={(e) => setPwValue(e.target.value)}
                      minLength={6}
                    />
                    <button onClick={() => setTempPassword(u.id)} disabled={pwValue.length < 6} className="btn-primary px-3 py-1.5 text-xs">
                      {t.setPassword}
                    </button>
                  </div>
                )}
                {pwDone === u.id && <p className="mt-2 text-xs font-medium">{t.passwordSet}</p>}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line p-5">
      <h2 className="mb-4 font-semibold">{title}</h2>
      {children}
    </div>
  );
}
