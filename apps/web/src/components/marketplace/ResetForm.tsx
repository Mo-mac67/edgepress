"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { marketDict } from "@/lib/marketplace-i18n";

/** Set-new-password form. Token comes from the reset link (?token=…). */
export function ResetForm({ locale, initialToken }: { locale: string; initialToken: string }) {
  const a = marketDict(locale).auth;
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "ok" | "bad">("idle");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      setState(res.ok ? "ok" : "bad");
    } finally {
      setBusy(false);
    }
  }

  if (state === "ok") {
    return (
      <div className="card mx-auto w-full max-w-md p-6 text-center">
        <p className="font-medium">{a.resetOk}</p>
        <Link href={`/${locale}/account`} className="btn-primary mt-4 inline-flex">
          {a.goSignIn}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card mx-auto w-full max-w-md p-6">
      <h2 className="font-semibold">{a.resetTitle}</h2>
      <p className="mt-1 text-sm text-ink-soft">{a.resetNote}</p>
      <label className="mt-4 mb-3 block text-sm">
        <span className="mb-1 block font-medium text-ink-soft">{a.resetToken}</span>
        <input className="field w-full font-mono text-xs" value={token} onChange={(e) => setToken(e.target.value)} required />
      </label>
      <label className="mb-4 block text-sm">
        <span className="mb-1 block font-medium text-ink-soft">{a.newPassword}</span>
        <input
          type="password"
          className="field w-full"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
        />
      </label>
      {state === "bad" && <p className="mb-3 text-sm font-medium text-red-600">{a.resetBad}</p>}
      <button type="submit" disabled={busy} className="btn-primary w-full">
        <Icon name="lock" size={18} />
        {a.resetSubmit}
      </button>
    </form>
  );
}
