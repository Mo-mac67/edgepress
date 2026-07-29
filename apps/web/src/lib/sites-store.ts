import "server-only";
import { randomUUID } from "node:crypto";
import { readJsonDoc, writeJsonDoc } from "./storage";

/**
 * The agency console: one dashboard over the other EdgePress installs you run.
 *
 * A studio with six client sites has six admin panels, six version numbers and
 * six places a lead can be waiting. This keeps the registry of those sites and
 * fetches each one's own /api/site-status.
 *
 * Each site is reached with an API key it issued — so access is granted by the
 * site, revocable from the site, and the console never holds a password. Keys
 * are stored here because there's nothing else they could be: this install has
 * to present them. They're never returned to the browser.
 */

const KEY = "console-sites.json";
const MAX_SITES = 100;

export interface ManagedSite {
  id: string;
  /** Label for the console — usually the client's name. */
  name: string;
  /** Origin, no trailing slash, e.g. https://client.com */
  url: string;
  /** API key issued by that site. Never sent to the browser. */
  apiKey: string;
  addedAt: string;
  /** Last successful report, cached so the console renders instantly. */
  lastStatus?: SiteStatus;
  lastCheckedAt?: string;
  lastError?: string;
}

export interface SiteStatus {
  brandName?: string;
  version?: string;
  latest?: string | null;
  updateAvailable?: boolean;
  counts?: {
    pages: number; pagesTotal: number;
    posts: number; postTotal?: number; postsTotal?: number;
    leads: number; newLeads: number;
  };
  newestLeadAt?: string | null;
  storage?: string;
  reportedAt?: string;
}

/** Public shape — the API key is stripped. */
export type SiteSummary = Omit<ManagedSite, "apiKey"> & { hasKey: boolean };

const strip = (s: ManagedSite): SiteSummary => {
  const { apiKey, ...rest } = s;
  return { ...rest, hasKey: Boolean(apiKey) };
};

async function readSites(): Promise<ManagedSite[]> {
  return readJsonDoc<ManagedSite[]>(KEY, []);
}

export async function listSites(): Promise<SiteSummary[]> {
  return (await readSites()).map(strip);
}

/** Trim to an origin so "https://x.com/admin/" and "x.com" both work. */
export function normalizeSiteUrl(input: string): string | null {
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "https:" && u.hostname !== "localhost" && u.hostname !== "127.0.0.1") {
      // An API key sent over plain http is a key given away in transit.
      return null;
    }
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

export async function addSite(input: { name: string; url: string; apiKey: string }): Promise<SiteSummary | { error: string }> {
  const url = normalizeSiteUrl(input.url);
  if (!url) return { error: "Enter the site's https address" };
  const apiKey = String(input.apiKey ?? "").trim();
  if (!apiKey) return { error: "Paste an API key from that site (Developer → API keys)" };

  const sites = await readSites();
  if (sites.length >= MAX_SITES) return { error: `That's the ${MAX_SITES}-site limit` };
  if (sites.some((s) => s.url === url)) return { error: "That site is already in the console" };

  const site: ManagedSite = {
    id: randomUUID().slice(0, 8),
    name: String(input.name ?? "").trim().slice(0, 80) || new URL(url).hostname,
    url,
    apiKey,
    addedAt: new Date().toISOString(),
  };
  sites.push(site);
  await writeJsonDoc(KEY, sites);
  return strip(site);
}

export async function removeSite(id: string): Promise<boolean> {
  const sites = await readSites();
  const next = sites.filter((s) => s.id !== id);
  if (next.length === sites.length) return false;
  await writeJsonDoc(KEY, next);
  return true;
}

/**
 * Ask one site how it's doing. Never throws: a client site being down is
 * information the console exists to show, not an error that should break it.
 */
export async function refreshSite(id: string): Promise<SiteSummary | null> {
  const sites = await readSites();
  const site = sites.find((s) => s.id === id);
  if (!site) return null;

  const now = new Date().toISOString();
  try {
    const res = await fetch(`${site.url}/api/site-status`, {
      headers: { Authorization: `Bearer ${site.apiKey}` },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (res.status === 401) {
      site.lastError = "The API key was rejected — it may have been revoked.";
    } else if (!res.ok) {
      // A 404 almost always means the site predates this endpoint.
      site.lastError = res.status === 404 ? "No status endpoint — that site needs EdgePress 2.2+." : `Site replied ${res.status}`;
    } else {
      const data = (await res.json()) as SiteStatus & { ok?: boolean };
      site.lastStatus = data;
      site.lastError = undefined;
      if (data.brandName && site.name === new URL(site.url).hostname) site.name = data.brandName;
    }
  } catch (e) {
    site.lastError = e instanceof Error && e.name === "TimeoutError" ? "Timed out — the site may be down." : "Could not reach the site.";
  }
  site.lastCheckedAt = now;
  await writeJsonDoc(KEY, sites);
  return strip(site);
}

/**
 * Refresh every site. Sequential on purpose: each one is an outbound request and
 * hosts cap those per invocation, so a studio with twenty sites would blow the
 * budget firing them all at once.
 */
export async function refreshAllSites(limit = 12): Promise<SiteSummary[]> {
  const sites = await readSites();
  for (const s of sites.slice(0, limit)) await refreshSite(s.id);
  return listSites();
}

/** What needs attention, for the console header. */
export function summarize(sites: SiteSummary[]): { total: number; unreachable: number; needUpdate: number; newLeads: number } {
  return {
    total: sites.length,
    unreachable: sites.filter((s) => s.lastError).length,
    needUpdate: sites.filter((s) => s.lastStatus?.updateAvailable).length,
    newLeads: sites.reduce((n, s) => n + (s.lastStatus?.counts?.newLeads ?? 0), 0),
  };
}
