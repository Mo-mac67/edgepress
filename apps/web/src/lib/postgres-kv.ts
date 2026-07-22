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

let cache: KVNamespace | null = null;

export async function postgresKV(): Promise<KVNamespace> {
  if (cache) return cache;

  const pg = (await import(/* webpackIgnore: true */ "pg")) as unknown as { Pool: new (c: { connectionString?: string }) => PgPool; default?: { Pool: new (c: { connectionString?: string }) => PgPool } };
  const Pool = pg.Pool ?? pg.default?.Pool;
  if (!Pool) throw new Error("pg driver not available");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
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
