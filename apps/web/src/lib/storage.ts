import "server-only";

/**
 * Storage adapter. Documents live in Cloudflare KV (binding APP_KV) by default;
 * with EDGEPRESS_STORAGE=fs (Docker/Node self-host) they live as JSON files
 * under DATA_DIR. Every store goes through readJsonDoc / writeJsonDoc so callers
 * never care which backend is active.
 */

export type KVNamespace = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; cursor?: string }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }>;
};

/** Returns the KV namespace when running on Cloudflare, else null (fs mode). */
export async function getKV(): Promise<KVNamespace | null> {
  return kv();
}

async function kv(): Promise<KVNamespace | null> {
  // Explicit filesystem mode skips the Cloudflare lookup entirely.
  if (process.env.EDGEPRESS_STORAGE === "fs") return null;
  // SQLite self-host mode: dynamic import so the Workers bundle never loads it.
  // Falls back to the filesystem adapter if node:sqlite isn't available.
  if (process.env.EDGEPRESS_STORAGE === "sqlite") {
    try {
      const { sqliteKV } = await import("./sqlite-kv");
      return await sqliteKV();
    } catch {
      return null;
    }
  }
  try {
    const mod = await import("@opennextjs/cloudflare");
    const env = mod.getCloudflareContext().env as Record<string, unknown> | undefined;
    // Honor a custom binding name (EDGEPRESS_KV_BINDING) or any *_KV binding.
    const bindingName = process.env.EDGEPRESS_KV_BINDING;
    if (env) {
      if (bindingName && env[bindingName]) return env[bindingName] as KVNamespace;
      if (env.APP_KV) return env.APP_KV as KVNamespace;
      const kvKey = Object.keys(env).find((k) => k.endsWith("_KV"));
      if (kvKey) return env[kvKey] as KVNamespace;
    }
    return null;
  } catch {
    return null;
  }
}

export async function readJsonDoc<T>(key: string, fallback: T): Promise<T> {
  const store = await kv();
  if (store) {
    const value = await store.get(key);
    return value ? (JSON.parse(value) as T) : fallback;
  }
  // Local filesystem fallback.
  try {
    const path = (await import("node:path")).default;
    const { readFile } = await import("node:fs/promises");
    const dir = process.env.DATA_DIR || path.join(process.cwd(), "data");
    return JSON.parse(await readFile(path.join(dir, key), "utf8")) as T;
  } catch {
    return fallback;
  }
}

export async function writeJsonDoc(key: string, data: unknown): Promise<void> {
  const store = await kv();
  if (store) {
    await store.put(key, JSON.stringify(data));
    return;
  }
  const path = (await import("node:path")).default;
  const { mkdir, writeFile } = await import("node:fs/promises");
  const dir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, key), JSON.stringify(data, null, 2), "utf8");
}
