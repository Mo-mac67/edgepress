"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";

export function AdminLogin() {
  const [mode, setMode] = useState<"loading" | "setup" | "login">("loading");

  useEffect(() => {
    fetch("/api/setup")
      .then((r) => r.json())
      .then((d) => setMode(d.done ? "login" : "setup"))
      .catch(() => setMode("login"));
  }, []);

  if (mode === "loading") {
    return <section className="container-page flex min-h-[70vh] items-center justify-center"><p className="text-sm text-ink-soft">Loading…</p></section>;
  }
  return mode === "setup" ? <SetupWizard /> : <LoginForm />;
}

function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [needsCode, setNeedsCode] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, code: code || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok && data.ok) return router.refresh();
    if (data.needsCode) {
      setNeedsCode(true);
      setError(res.status === 401 ? "Invalid authentication code." : "");
      return;
    }
    setError("Incorrect password.");
  }

  return (
    <section className="container-page flex min-h-[70vh] items-center justify-center py-16">
      <form onSubmit={submit} className="card w-full max-w-sm p-7">
        <BrandMark size={44} />
        <h1 className="mt-4 font-display text-xl font-bold text-brand">EdgePress Admin</h1>
        <p className="mt-1 text-sm text-ink-soft">Sign in to manage your site.</p>
        <label className="mt-5 block">
          <span className="mb-1.5 block text-sm font-medium text-ink-soft">Password</span>
          <input type="password" className="field" value={password} placeholder="••••••••" onChange={(e) => setPassword(e.target.value)} autoFocus disabled={needsCode} />
        </label>
        {needsCode && (
          <label className="mt-3 block">
            <span className="mb-1.5 block text-sm font-medium text-ink-soft">Authentication code</span>
            <input inputMode="numeric" className="field tracking-[0.3em]" value={code} placeholder="000000" maxLength={6} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoFocus />
            <span className="mt-1 block text-xs text-ink-soft">From your authenticator app.</span>
          </label>
        )}
        {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary mt-5 w-full">
          {loading ? "Signing in…" : needsCode ? "Verify" : "Sign in"}
        </button>
      </form>
    </section>
  );
}

/** First-run wizard: name the site + set the admin password. Shown until the
 *  owner completes setup (no more admin/admin default). */
function SetupWizard() {
  const router = useRouter();
  const [siteName, setSiteName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setLoading(true);
    const res = await fetch("/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteName, password }),
    });
    setLoading(false);
    if (res.ok) router.refresh();
    else setError((await res.json().catch(() => ({}))).error || "Setup failed.");
  }

  return (
    <section className="container-page flex min-h-[80vh] items-center justify-center py-16">
      <form onSubmit={submit} className="card w-full max-w-md p-8">
        <BrandMark size={48} />
        <h1 className="mt-4 font-display text-2xl font-bold text-brand">Welcome to EdgePress</h1>
        <p className="mt-1 text-sm text-ink-soft">Let's set up your site — this takes a few seconds.</p>

        <label className="mt-6 block">
          <span className="mb-1.5 block text-sm font-medium text-ink">Site name</span>
          <input className="field" value={siteName} placeholder="e.g. Acme Studio" onChange={(e) => setSiteName(e.target.value)} autoFocus />
        </label>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm font-medium text-ink">Choose an admin password</span>
          <input type="password" className="field" value={password} placeholder="At least 6 characters" onChange={(e) => setPassword(e.target.value)} />
        </label>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm font-medium text-ink">Confirm password</span>
          <input type="password" className="field" value={confirm} placeholder="Repeat your password" onChange={(e) => setConfirm(e.target.value)} />
        </label>

        {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary mt-6 w-full">
          {loading ? "Setting up…" : "Create my site"}
        </button>
        <p className="mt-3 text-center text-xs text-ink-soft">You can change everything later in the admin panel.</p>
      </form>
    </section>
  );
}
