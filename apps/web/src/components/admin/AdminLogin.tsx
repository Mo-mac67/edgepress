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
  const [sso, setSso] = useState(false);

  useEffect(() => {
    fetch("/api/auth/oauth/google").then(async (r) => r.ok && setSso((await r.json()).enabled === true)).catch(() => {});
    const reason = new URLSearchParams(window.location.search).get("sso");
    if (reason && reason !== "off") setError(reason === "email" ? "That Google account isn't on the allowlist." : "Google sign-in failed — try again or use your password.");
  }, []);

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
        {sso && (
          // OAuth needs a full-page navigation to the API route — <Link> would be wrong here.
          // eslint-disable-next-line @next/next/no-html-link-for-pages
          <a href="/api/auth/oauth/google/start" className="btn-secondary mt-3 flex w-full items-center justify-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden><path fill="currentColor" d="M21.35 11.1H12v2.9h5.3c-.5 2.5-2.6 3.9-5.3 3.9a6 6 0 1 1 0-12c1.5 0 2.9.5 4 1.5l2.2-2.2A9 9 0 1 0 12 21c5.2 0 8.9-3.6 8.9-8.9 0-.3 0-.7-.1-1z"/></svg>
            Sign in with Google
          </a>
        )}
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
        <p className="mt-1 text-sm text-ink-soft">Let&apos;s set up your site — this takes a few seconds.</p>

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
