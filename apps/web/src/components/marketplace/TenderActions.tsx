"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { marketDict } from "@/lib/marketplace-i18n";
import type { Bid, TenderStatus } from "@/lib/tenders-store";

/** Bid list (owner/admin) or bid form (verified provider) for a project. */
export function TenderActions({
  locale,
  tenderId,
  status,
  isOwner,
  viewer,
  bids,
  bidCount,
  myBid,
}: {
  locale: string;
  tenderId: string;
  status: TenderStatus;
  isOwner: boolean;
  viewer: { role: "customer" | "business"; verified: boolean } | null;
  bids: Bid[] | null;
  bidCount: number;
  myBid: Bid | null;
}) {
  const m = marketDict(locale).market;
  const a = marketDict(locale).auth;
  const router = useRouter();
  const money = new Intl.NumberFormat(locale === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });

  const [amount, setAmount] = useState(myBid ? String(myBid.amount) : "");
  const [weeks, setWeeks] = useState(myBid?.timelineWeeks ? String(myBid.timelineWeeks) : "");
  const [message, setMessage] = useState(myBid?.message ?? "");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [awarded, setAwarded] = useState(false);

  async function sendBid(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(`/api/tenders/${tenderId}/bids`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount), timelineWeeks: Number(weeks) || undefined, message }),
      });
      if (res.ok) setSent(true);
    } finally {
      setBusy(false);
    }
  }

  async function award() {
    setBusy(true);
    try {
      const res = await fetch(`/api/tenders/${tenderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "awarded" }),
      });
      if (res.ok) {
        setAwarded(true);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8">
      {/* Owner / admin: bids list */}
      {bids && (
        <>
          <h2 className="text-lg font-bold">
            {m.receivedBids} ({bidCount})
          </h2>
          <p className="mt-1 text-xs text-ink-soft">{m.sealed}</p>
          {bids.length === 0 ? (
            <p className="mt-3 text-sm text-ink-soft">{m.noBidsYet}</p>
          ) : (
            <div className="mt-4 space-y-3">
              {bids.map((b) => (
                <div key={b.id} className="card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-semibold">{b.company}</span>
                      {b.trade ? <span className="ml-2 rounded bg-black/5 px-1.5 py-0.5 text-xs text-ink-soft">{b.trade}</span> : null}
                      {b.timelineWeeks ? (
                        <span className="ml-2 text-xs text-ink-soft">{b.timelineWeeks} {m.weeksShort}</span>
                      ) : null}
                    </div>
                    <span className="text-lg font-bold">{money.format(b.amount)}</span>
                  </div>
                  {b.message && <p className="mt-2 text-sm text-ink-soft">{b.message}</p>}
                  {isOwner && status === "open" && !awarded && (
                    <button onClick={award} disabled={busy} className="btn-primary mt-3 text-sm">
                      <Icon name="check" size={16} />
                      {m.award}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {(awarded || status === "awarded") && (
            <p className="mt-4 rounded-xl border border-line bg-black/5 p-3 text-sm font-medium">{m.awardedNote}</p>
          )}
        </>
      )}

      {/* Provider: bid form */}
      {!bids && status === "open" && (
        <>
          <h2 className="text-lg font-bold">{m.placeBid}</h2>
          {!viewer && (
            <p className="mt-3 text-sm text-ink-soft">
              {m.signInToBid}{" "}
              <Link href={`/${locale}/account`} className="font-semibold text-ink hover:underline">
                {a.signIn} →
              </Link>
            </p>
          )}
          {viewer?.role === "customer" && <p className="mt-3 text-sm text-ink-soft">{m.signInToBid}</p>}
          {viewer?.role === "business" && !viewer.verified && (
            <p className="mt-3 rounded-xl border border-line bg-black/5 p-3 text-sm text-ink-soft">{m.unverifiedNote}</p>
          )}
          {viewer?.role === "business" && viewer.verified && (
            sent ? (
              <p className="mt-3 rounded-xl border border-line bg-black/5 p-3 text-sm font-medium">{m.bidSent}</p>
            ) : (
              <form onSubmit={sendBid} className="card mt-4 max-w-lg p-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-ink-soft">{m.bidAmount}</span>
                    <input type="number" min="1" className="field w-full" value={amount} onChange={(e) => setAmount(e.target.value)} required />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-ink-soft">{m.bidTimeline}</span>
                    <input type="number" min="1" className="field w-full" value={weeks} onChange={(e) => setWeeks(e.target.value)} />
                  </label>
                </div>
                <label className="mt-3 block text-sm">
                  <span className="mb-1 block font-medium text-ink-soft">{m.bidMessage}</span>
                  <textarea className="field min-h-[100px] w-full" value={message} placeholder={m.bidMessagePh} onChange={(e) => setMessage(e.target.value)} />
                </label>
                {myBid && <p className="mt-2 text-xs text-ink-soft">{m.bidUpdatesNote}</p>}
                <button type="submit" disabled={busy} className="btn-primary mt-4">
                  <Icon name="arrow-right" size={18} />
                  {m.sendBid}
                </button>
              </form>
            )
          )}
        </>
      )}
    </div>
  );
}
