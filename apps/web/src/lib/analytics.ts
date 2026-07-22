import type { SiteEvent } from "./events-store";
import type { Lead } from "./types";

/** Week-over-week anomaly detection — flags significant drops in leads or
 *  traffic so a problem surfaces on the dashboard without digging. */
export function detectAnomalies(leads: Lead[], events: SiteEvent[]): { label: string; severity: "warn" }[] {
  const DAY = 86_400_000;
  const now = Date.now();
  const inWindow = (iso: string, from: number, to: number) => {
    const t = +new Date(iso);
    return t >= now - to * DAY && t < now - from * DAY;
  };
  const out: { label: string; severity: "warn" }[] = [];

  const leadsLast = leads.filter((l) => inWindow(l.createdAt, 0, 7)).length;
  const leadsPrev = leads.filter((l) => inWindow(l.createdAt, 7, 14)).length;
  if (leadsPrev >= 4 && leadsLast < leadsPrev * 0.5) {
    out.push({ label: `Leads down ${Math.round((1 - leadsLast / leadsPrev) * 100)}% this week (${leadsPrev} → ${leadsLast})`, severity: "warn" });
  }

  const pv = (from: number, to: number) => events.filter((e) => e.type === "pageview" && inWindow(e.createdAt, from, to)).length;
  const pvLast = pv(0, 7);
  const pvPrev = pv(7, 14);
  if (pvPrev >= 20 && pvLast < pvPrev * 0.5) {
    out.push({ label: `Traffic down ${Math.round((1 - pvLast / pvPrev) * 100)}% this week (${pvPrev} → ${pvLast} views)`, severity: "warn" });
  }
  return out;
}

export interface KeyValue {
  key: string;
  value: number;
}

export interface Analytics {
  kpis: {
    sessions: number;
    pageviews: number;
    formStarts: number;
    leads: number;
    conversionRate: number; // leads / sessions
    formCompletion: number; // leads / form starts
  };
  leadsByCity: KeyValue[];
  leadsByProjectType: KeyValue[];
  leadsByStatus: KeyValue[];
  leadsByDay: KeyValue[];
  topPages: KeyValue[];
  funnel: KeyValue[];
}

function countBy<T>(items: T[], key: (t: T) => string | undefined): KeyValue[] {
  const map = new Map<string, number>();
  for (const it of items) {
    const k = key(it);
    if (!k) continue;
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()].map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value);
}

function lastDays(n: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export function computeAnalytics(leads: Lead[], events: SiteEvent[], days?: number): Analytics {
  if (days && Number.isFinite(days)) {
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();
    leads = leads.filter((l) => l.createdAt >= cutoff);
    events = events.filter((e) => e.createdAt >= cutoff);
  }
  const sessions = new Set(events.map((e) => e.sessionId)).size;
  const pageviews = events.filter((e) => e.type === "pageview").length;
  const formStarts = events.filter((e) => e.type === "quiz_start").length;
  const leadsCount = leads.length;

  const span = Math.min(days && Number.isFinite(days) ? days : 14, 30);
  const dayKeys = lastDays(span);
  const byDayMap = new Map(dayKeys.map((d) => [d, 0]));
  for (const l of leads) {
    const d = l.createdAt.slice(0, 10);
    if (byDayMap.has(d)) byDayMap.set(d, (byDayMap.get(d) ?? 0) + 1);
  }

  return {
    kpis: {
      sessions,
      pageviews,
      formStarts,
      leads: leadsCount,
      conversionRate: sessions ? leadsCount / sessions : 0,
      formCompletion: formStarts ? leadsCount / formStarts : 0,
    },
    leadsByCity: countBy(leads, (l) => l.city),
    leadsByProjectType: countBy(leads, (l) => l.projectType),
    leadsByStatus: countBy(leads, (l) => l.status),
    leadsByDay: dayKeys.map((d) => ({ key: d, value: byDayMap.get(d) ?? 0 })),
    topPages: countBy(
      events.filter((e) => e.type === "pageview"),
      (e) => e.path.replace(/^\/(en|fr)/, "") || "/",
    ).slice(0, 6),
    funnel: [
      { key: "sessions", value: sessions },
      { key: "formStarts", value: formStarts },
      { key: "leads", value: leadsCount },
    ],
  };
}
