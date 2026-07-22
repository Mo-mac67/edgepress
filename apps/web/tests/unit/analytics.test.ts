import { describe, expect, it } from "vitest";
import { computeAnalytics, detectAnomalies } from "@/lib/analytics";
import type { SiteEvent } from "@/lib/events-store";
import type { Lead } from "@/lib/types";

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

const lead = (n: number, over: Partial<Lead> = {}): Lead => ({
  id: `l${n}`,
  createdAt: daysAgo(n),
  locale: "en",
  name: `Lead ${n}`,
  email: `l${n}@x.com`,
  phone: "4165551212",
  city: "Toronto",
  projectType: "renovation",
  status: "new",
  ...over,
});

const pv = (n: number, i = 0): SiteEvent => ({
  id: `e${n}-${i}`,
  type: "pageview",
  path: "/en",
  locale: "en",
  sessionId: `s${n}-${i}`,
  createdAt: daysAgo(n),
});

describe("detectAnomalies", () => {
  it("stays quiet with too little data", () => {
    expect(detectAnomalies([lead(1)], [])).toEqual([]);
  });

  it("flags a sharp week-over-week lead drop", () => {
    const leads = [...Array(6)].map((_, i) => lead(9 + (i % 4), { id: `p${i}` })).concat([lead(2, { id: "c1" })]);
    const out = detectAnomalies(leads, []);
    expect(out.some((a) => a.label.includes("Leads down"))).toBe(true);
  });

  it("flags a traffic drop", () => {
    const events = [
      ...[...Array(30)].map((_, i) => pv(9, i)),
      ...[...Array(3)].map((_, i) => pv(2, 100 + i)),
    ];
    const out = detectAnomalies([], events);
    expect(out.some((a) => a.label.includes("Traffic down"))).toBe(true);
  });

  it("does not flag growth", () => {
    const events = [
      ...[...Array(30)].map((_, i) => pv(2, i)),
      ...[...Array(25)].map((_, i) => pv(9, 100 + i)),
    ];
    expect(detectAnomalies([], events)).toEqual([]);
  });
});

describe("computeAnalytics", () => {
  it("counts sessions, pageviews and conversion", () => {
    const a = computeAnalytics([lead(1)], [pv(1, 1), pv(1, 2)], 30);
    expect(a.kpis.pageviews).toBe(2);
    expect(a.kpis.sessions).toBe(2);
    expect(a.kpis.leads).toBe(1);
    expect(a.kpis.conversionRate).toBeCloseTo(0.5);
  });
});
