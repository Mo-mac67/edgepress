/**
 * Lightweight, dependency-free spam heuristic for public submissions. Flags
 * (never blocks) so the owner can review — avoids false-positives turning away
 * real people. Higher score = more spammy.
 */

const SPAM_TERMS = [
  "viagra", "cialis", "casino", "poker", "porn", "xxx", "forex", "crypto",
  "bitcoin", "backlink", "seo service", "rank your", "cheap price", "free money",
  "make money", "work from home", "weight loss", "replica", "escort", "loan offer",
];

export function spamScore(text: string): number {
  const t = (text || "").toLowerCase();
  if (!t.trim()) return 0;
  let score = 0;
  score += (t.match(/https?:\/\//g) || []).length * 2; // raw URLs
  score += (t.match(/\[url|\[link|<a\s/g) || []).length * 3; // BBCode/HTML links
  for (const term of SPAM_TERMS) if (t.includes(term)) score += 2;
  const letters = text.replace(/[^A-Za-z]/g, "");
  if (letters.length > 20 && (text.match(/[A-Z]/g) || []).length > letters.length * 0.6) score += 1; // SHOUTING
  return score;
}

export function isSpam(text: string): boolean {
  return spamScore(text) >= 4;
}
