import type { EventType } from "./events-store";

/** Client-side analytics helper. Persists a session id and posts events. */
export function getSessionId(): string {
  if (typeof window === "undefined") return "anon";
  try {
    let id = localStorage.getItem("ms_sid");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("ms_sid", id);
    }
    return id;
  } catch {
    return "anon";
  }
}

export function track(type: EventType, meta?: Record<string, string | number>): void {
  if (typeof window === "undefined") return;
  const path = window.location.pathname;
  const locale = path.split("/")[1] === "fr" ? "fr" : "en";
  const payload = JSON.stringify({ type, path, locale, sessionId: getSessionId(), meta });
  try {
    const sent = navigator.sendBeacon?.("/api/track", new Blob([payload], { type: "application/json" }));
    if (!sent) {
      void fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      });
    }
  } catch {
    /* tracking must never break the page */
  }
}
