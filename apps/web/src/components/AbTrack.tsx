"use client";

import { useEffect } from "react";

/**
 * Records an A/B headline impression once on mount, and drops a short-lived
 * cookie so a conversion (lead submit) can be attributed to the shown variant.
 */
export function AbTrack({ slug, variant }: { slug: string; variant: number }) {
  useEffect(() => {
    document.cookie = `ep_abv=${encodeURIComponent(slug)}.${variant}; path=/; max-age=1800; samesite=lax`;
    const key = `ep_ab_seen_${slug}_${variant}`;
    if (sessionStorage.getItem(key)) return; // once per session per variant
    sessionStorage.setItem(key, "1");
    fetch("/api/ab", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, variant }), keepalive: true }).catch(() => {});
  }, [slug, variant]);
  return null;
}
