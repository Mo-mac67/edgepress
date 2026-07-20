import "server-only";
import type { KVNamespace } from "./storage";

/**
 * SQLite storage adapter (self-host option). Exposes a KVNamespace-compatible
 * interface backed by Node's built-in `node:sqlite`, so EVERYTHING that goes
 * through the storage layer — including backup/restore — works unchanged.
 *
 * Enabled with EDGEPRESS_STORAGE=sqlite. Loaded ONLY via dynamic import from
 * storage.ts, so the Cloudflare/Workers bundle never touches it. Requires Node
 * 22.5+ (node:sqlite is built in — no native dependency to compile). If it
 * isn't available, storage.ts falls back to the filesystem adapter.
 */

let cache: KVNamespace | null = null;

export async function sqliteKV(): Promise<KVNamespace> {
  if (cache) return cache;

  // webpackIgnore: keep this a native runtime import so the Cloudflare/Workers
  // bundle never tries to resolve node:sqlite (it only runs in Node self-host).
  const { DatabaseSync } = await import(/* webpackIgnore: true */ "node:sqlite");
  const path = (await import("node:path")).default;
  const { mkdirSync } = await import("node:fs");

  const dir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, "edgepress.sqlite"));
  db.exec("CREATE TABLE IF NOT EXISTS docs (key TEXT PRIMARY KEY, value TEXT NOT NULL)");

  const getStmt = db.prepare("SELECT value FROM docs WHERE key = ?");
  const putStmt = db.prepare("INSERT INTO docs (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
  const delStmt = db.prepare("DELETE FROM docs WHERE key = ?");
  const listStmt = db.prepare("SELECT key FROM docs ORDER BY key");

  cache = {
    async get(key: string) {
      const row = getStmt.get(key) as { value?: string } | undefined;
      return row?.value ?? null;
    },
    async put(key: string, value: string) {
      putStmt.run(key, value);
    },
    async delete(key: string) {
      delStmt.run(key);
    },
    async list(options?: { prefix?: string; cursor?: string }) {
      const prefix = options?.prefix ?? "";
      const rows = listStmt.all() as { key: string }[];
      const keys = rows.filter((r) => r.key.startsWith(prefix)).map((r) => ({ name: r.key }));
      return { keys, list_complete: true as const };
    },
  };
  return cache;
}
