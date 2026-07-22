// In-memory rate limiter — correct for single-instance (VPS/Docker/Node)
// deployments. On Cloudflare Workers each isolate has its OWN memory, so for
// the sensitive low-volume routes (login, setup, 2FA) use rateLimitDurable()
// below, which counts in KV and therefore holds across isolates and PoPs.
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit = 20, windowMs = 60_000): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count++;
  return true;
}

export function clientIp(req: Request): string {
  const h = req.headers;
  return (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "local").trim();
}

/**
 * Durable rate limit for SENSITIVE, low-volume routes (login/setup/2FA):
 * a fixed-window counter stored in Cloudflare KV, so the limit holds across
 * Workers isolates and locations (the in-memory limiter can't). The
 * get→put increment isn't atomic — a burst can slightly undercount — which is
 * acceptable for brute-force throttling. Costs 1 KV read + 1 write per attempt,
 * so keep it off high-volume public endpoints. Outside real KV deployments
 * (fs/sqlite/postgres single-node) it falls back to the in-memory limiter,
 * which is correct there.
 */
export async function rateLimitDurable(key: string, limit = 10, windowSec = 60): Promise<boolean> {
  if (process.env.EDGEPRESS_STORAGE !== "kv") return rateLimit(key, limit, windowSec * 1000);
  try {
    const { getKV } = await import("./storage");
    const kv = await getKV();
    if (!kv) return rateLimit(key, limit, windowSec * 1000);
    const windowId = Math.floor(Date.now() / (windowSec * 1000));
    const bucketKey = `rl-${key}-${windowId}`;
    const count = Number((await kv.get(bucketKey)) ?? 0);
    if (count >= limit) return false;
    await kv.put(bucketKey, String(count + 1), { expirationTtl: Math.max(60, windowSec * 2) });
    return true;
  } catch {
    // Never let limiter failures take auth down — degrade to in-memory.
    return rateLimit(key, limit, windowSec * 1000);
  }
}
