import "server-only";
import { readJsonDoc, writeJsonDoc } from "./storage";

/**
 * A/B test stats — per page slug, per variant index: impressions + conversions.
 * Tiny KV/fs doc; updated best-effort (never blocks the request path).
 */
const KEY = "ab-stats.json";

type Stats = Record<string, Record<string, { impressions: number; conversions: number }>>;

async function bump(slug: string, variant: number, field: "impressions" | "conversions"): Promise<void> {
  if (!slug || !Number.isInteger(variant) || variant < 0 || variant > 50) return;
  try {
    const stats = await readJsonDoc<Stats>(KEY, {});
    const page = (stats[slug] ??= {});
    const v = (page[String(variant)] ??= { impressions: 0, conversions: 0 });
    v[field] += 1;
    await writeJsonDoc(KEY, stats);
  } catch {
    /* best effort */
  }
}

export const recordImpression = (slug: string, variant: number) => bump(slug, variant, "impressions");
export const recordConversion = (slug: string, variant: number) => bump(slug, variant, "conversions");

export interface AbResultRow {
  slug: string;
  headlines: string[];
  variants: { headline: string; impressions: number; conversions: number; rate: number }[];
  winner: number | null;
}

/** Merge stored stats with each page's configured headlines for the results UI. */
export async function getAbResults(pages: { slug: string; ab?: { headlines: string[] } }[]): Promise<AbResultRow[]> {
  const stats = await readJsonDoc<Stats>(KEY, {});
  const rows: AbResultRow[] = [];
  for (const p of pages) {
    if (!p.ab?.headlines?.length) continue;
    const s = stats[p.slug] ?? {};
    const variants = p.ab.headlines.map((headline, i) => {
      const v = s[String(i)] ?? { impressions: 0, conversions: 0 };
      return { headline, impressions: v.impressions, conversions: v.conversions, rate: v.impressions ? v.conversions / v.impressions : 0 };
    });
    const withData = variants.filter((v) => v.impressions >= 5);
    const winner = withData.length >= 2 ? variants.indexOf(withData.reduce((a, b) => (b.rate > a.rate ? b : a))) : null;
    rows.push({ slug: p.slug, headlines: p.ab.headlines, variants, winner });
  }
  return rows;
}
