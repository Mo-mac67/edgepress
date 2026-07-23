"use client";

import { useState } from "react";

/** Starts a Stripe hosted-checkout session for a payment block. */
export function PayButton({ pageId, blockId, locale, label }: { pageId: string; blockId: string; locale: string; label: string }) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [err, setErr] = useState("");

  async function buy() {
    setState("loading");
    setErr("");
    const res = await fetch("/api/pay/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageId, blockId, locale }),
    }).catch(() => null);
    const d = await res?.json().catch(() => ({}));
    if (res?.ok && d?.url) {
      window.location.href = d.url; // Stripe-hosted checkout
    } else {
      setState("error");
      setErr(d?.error || "Checkout unavailable right now");
    }
  }

  return (
    <div className="mt-6">
      <button onClick={buy} disabled={state === "loading"} className="btn-primary">
        {state === "loading" ? "Opening secure checkout…" : label}
      </button>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      <p className="mt-2 text-xs text-ink-soft">Secure payment by Stripe — card details never touch this site.</p>
    </div>
  );
}
