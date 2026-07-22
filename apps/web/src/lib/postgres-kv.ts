import "server-only";
import type { KVNamespace } from "./storage";

/**
 * PostgreSQL storage adapter (self-host option). Exposes a KVNamespace-style
 * interface over a single `edgepress_docs(key, value)` table, so everything —
 * including backup/restore — works unchanged.
 *
 * Enabled with EDGEPRESS_STORAGE=postgres + DATABASE_URL. The `pg` driver is an
 * OPTIONAL peer dependency (`npm install pg`) loaded via a webpackIgnore'd
 * dynamic import, so it's never bundled into the Cloudflare/Workers build and
 * isn't required unless you actually use Postgres. Falls back to fs if missing.
 */

interface PgPool {
  query(text: string, params?: unknown[]): Promise<{ rows: Array<Record<string, string>> }>;
}
type PoolConfig = { connectionString?: string; max?: number; idleTimeoutMillis?: number };

let cache: KVNamespace | null = null;

export async function postgresKV(): Promise<KVNamespace> {
  if (cache) return cache;

  // Import `pg` in a way NO bundler can statically analyze (webpack dev, webpack
  // prod, and OpenNext's esbuild pass all leave it alone) — it stays a pure
  // runtime import, needed only when Postgres mode is actually used. `pg` is an
  // optional peer dependency; this whole module only loads in postgres mode.
  const importDynamic = new Function("m", "return import(m)") as (m: string) => Promise<{ Pool?: new (c: PoolConfig) => PgPool; default?: { Pool: new (c: PoolConfig) => PgPool } }>;
  const pg = await importDynamic("pg");
  const Pool = pg.Pool ?? pg.default?.Pool;
  if (!Pool) throw new Error("pg driver not available");
  // Small pool + quick idle release: a CMS does short KV-style queries, and in
  // dev each route bundle gets its own module instance (= its own pool), so
  // holding idle connections would starve small/single-connection servers.
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.PG_POOL_MAX || 3),
    idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 1000),
  });
  await pool.query("CREATE TABLE IF NOT EXISTS edgepress_docs (key text PRIMARY KEY, value text NOT NULL)");

  cache = {
    async get(key: string) {
      const r = await pool.query("SELECT value FROM edgepress_docs WHERE key = $1", [key]);
      return r.rows[0]?.value ?? null;
    },
    async put(key: string, value: string) {
      await pool.query("INSERT INTO edgepress_docs (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [key, value]);
    },
    async delete(key: string) {
      await pool.query("DELETE FROM edgepress_docs WHERE key = $1", [key]);
    },
    async list(options?: { prefix?: string; cursor?: string }) {
      const r = await pool.query("SELECT key FROM edgepress_docs ORDER BY key");
      const prefix = options?.prefix ?? "";
      return { keys: r.rows.filter((row) => row.key.startsWith(prefix)).map((row) => ({ name: row.key })), list_complete: true as const };
    },
  };
  return cache;
}
