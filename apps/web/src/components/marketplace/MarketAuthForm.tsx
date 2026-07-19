"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { marketDict } from "@/lib/marketplace-i18n";

/** Sign-in / sign-up form for site users (project marketplace). Self-contained i18n. */
export function MarketAuthForm({ locale, onDone }: { locale: string; onDone?: () => void }) {
  const a = marketDict(locale).auth;
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [role, setRole] = useState<"customer" | "business">("customer");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [company, setCompany] = useState("");
  const [trade, setTrade] = useState("");
  const [regions, setRegions] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    try {
      if (mode === "forgot") {
        await fetch("/api/auth/forgot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, lang: locale }),
        });
        setInfo(a.forgotSent);
        return;
      }
      const url = mode === "signin" ? "/api/auth/login" : "/api/auth/register";
      const payload =
        mode === "signin"
          ? { email, password }
          : {
              name,
              email,
              password,
              role,
              company,
              trade,
              regions: regions.split(",").map((s) => s.trim()).filter(Boolean),
            };
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const map: Record<string, string> = {
          exists: a.errors.exists,
          invalid: a.errors.invalid,
          email: a.errors.email,
        };
        setError(mode === "signin" ? a.errors.badLogin : (map[data.error] ?? a.errors.invalid));
        return;
      }
      if (onDone) onDone();
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (mode === "forgot") {
    return (
      <form onSubmit={submit} className="card mx-auto w-full max-w-md p-6">
        <h2 className="font-semibold">{a.forgotTitle}</h2>
        <p className="mt-1 text-sm text-ink-soft">{a.forgotNote}</p>
        <label className="mt-4 mb-4 block text-sm">
          <span className="mb-1 block font-medium text-ink-soft">{a.email}</span>
          <input type="email" className="field w-full" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        {info && <p className="mb-3 text-sm font-medium">{info}</p>}
        <button type="submit" disabled={busy} className="btn-primary w-full">
          <Icon name="mail" size={18} />
          {a.forgotSend}
        </button>
        <p className="mt-4 text-center text-sm text-ink-soft">
          <button type="button" onClick={() => setMode("signin")} className="font-semibold hover:underline">
            {a.goSignIn}
          </button>
        </p>
      </form>
    );
  }

  return (
    <form onSubmit={submit} className="card mx-auto w-full max-w-md p-6">
      <div className="mb-5 flex gap-1 rounded-xl bg-black/5 p-1">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
              mode === m ? "bg-white text-ink shadow-sm" : "text-ink-soft"
            }`}
          >
            {m === "signin" ? a.signIn : a.signUp}
          </button>
        ))}
      </div>

      {mode === "signup" && (
        <>
          <p className="mb-2 text-sm font-medium text-ink-soft">{a.iAm}</p>
          <div className="mb-4 grid grid-cols-2 gap-2">
            {(["customer", "business"] as const).map((rr) => (
              <button
                key={rr}
                type="button"
                onClick={() => setRole(rr)}
                className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                  role === rr ? "border-ink bg-black/5 text-ink" : "border-line bg-white text-ink-soft"
                }`}
              >
                {rr === "customer" ? a.customer : a.business}
              </button>
            ))}
          </div>
          <label className="mb-3 block text-sm">
            <span className="mb-1 block font-medium text-ink-soft">{a.name}</span>
            <input className="field w-full" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          {role === "business" && (
            <>
              <label className="mb-3 block text-sm">
                <span className="mb-1 block font-medium text-ink-soft">{a.company}</span>
                <input className="field w-full" value={company} onChange={(e) => setCompany(e.target.value)} required />
              </label>
              <label className="mb-3 block text-sm">
                <span className="mb-1 block font-medium text-ink-soft">{a.trade}</span>
                <input className="field w-full" value={trade} onChange={(e) => setTrade(e.target.value)} />
              </label>
              <label className="mb-3 block text-sm">
                <span className="mb-1 block font-medium text-ink-soft">{a.regions}</span>
                <input className="field w-full" value={regions} onChange={(e) => setRegions(e.target.value)} />
              </label>
            </>
          )}
        </>
      )}

      <label className="mb-3 block text-sm">
        <span className="mb-1 block font-medium text-ink-soft">{a.email}</span>
        <input type="email" className="field w-full" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label className="mb-2 block text-sm">
        <span className="mb-1 block font-medium text-ink-soft">{a.password}</span>
        <input
          type="password"
          className="field w-full"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
        />
      </label>

      {mode === "signin" && (
        <p className="mb-3 text-right text-sm">
          <button type="button" onClick={() => setMode("forgot")} className="font-medium text-ink-soft hover:underline">
            {a.forgot}
          </button>
        </p>
      )}

      {error && <p className="mb-3 text-sm font-medium text-red-600">{error}</p>}

      <button type="submit" disabled={busy} className="btn-primary w-full">
        <Icon name="user" size={18} />
        {mode === "signin" ? a.signIn : a.signUp}
      </button>

      <p className="mt-4 text-center text-sm text-ink-soft">
        {mode === "signin" ? a.noAccount : a.haveAccount}{" "}
        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="font-semibold text-ink hover:underline"
        >
          {mode === "signin" ? a.signUp : a.signIn}
        </button>
      </p>
    </form>
  );
}
