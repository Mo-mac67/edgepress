import "server-only";

/**
 * Storage abstraction. On Cloudflare Workers the JSON "documents" live in a KV
 * namespace (binding APP_KV); locally they fall back to JSON files under
 * DATA_DIR. Every store goes through readJsonDoc / writeJsonDoc so callers never
 * care which backend is active.
 */

export type KVNamespace = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; cursor?: string }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }>;
};

/** Returns the KV namespace when running on Cloudflare, else null (local dev). */
export async function getKV(): Promise<KVNamespace | null> {
  return kv();
}

async function kv(): Promise<KVNamespace | null> {
  try {
    const mod = await import("@opennextjs/cloudflare");
    const env = mod.getCloudflareContext().env as Record<string, unknown> | undefined;
    return (env?.APP_KV as KVNamespace | undefined) ?? null;
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
