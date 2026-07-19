"use client";

import { useRouter } from "next/navigation";

export function MarketSignOutButton({ label }: { label: string }) {
  const router = useRouter();
  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.refresh();
  }
  return (
    <button onClick={signOut} className="btn-secondary">
      {label}
    </button>
  );
}
