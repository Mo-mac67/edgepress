"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";

export function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(false);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (res.ok) router.refresh();
    else setError(true);
  }

  return (
    <section className="container-page flex min-h-[70vh] items-center justify-center py-16">
      <form onSubmit={submit} className="card w-full max-w-sm p-7">
        <BrandMark size={44} />
        <h1 className="mt-4 font-display text-xl font-bold text-brand">EdgePress Admin</h1>
        <p className="mt-1 text-sm text-ink-soft">Sign in to manage leads.</p>
        <label className="mt-5 block">
          <span className="mb-1.5 block text-sm font-medium text-ink-soft">Password</span>
          <input
            type="password"
            className="field"
            value={password}
            placeholder="••••••••"
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
        </label>
        {error && <p className="mt-3 text-sm font-medium text-red-600">Incorrect password.</p>}
        <button type="submit" disabled={loading} className="btn-primary mt-5 w-full">
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </section>
  );
}
