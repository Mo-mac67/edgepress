import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readJsonDoc, writeJsonDoc } from "./storage";

/** Content-API keys. Full token is shown once at creation; only a sha256 hash
 *  is stored. Presenting a key grants read access to draft/unpublished content. */

export interface ApiKey {
  id: string;
  label: string;
  prefix: string; // first 8 chars, for identification in the UI
  hash: string;
  createdAt: string;
  lastUsed?: string;
}

const KEY = "content-api-keys.json";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

function publicView(k: ApiKey): Omit<ApiKey, "hash"> {
  return { id: k.id, label: k.label, prefix: k.prefix, createdAt: k.createdAt, lastUsed: k.lastUsed };
}

export async function listApiKeys(): Promise<Omit<ApiKey, "hash">[]> {
  return (await readJsonDoc<ApiKey[]>(KEY, [])).map(publicView);
}

export async function createApiKey(label: string): Promise<{ token: string; key: Omit<ApiKey, "hash"> }> {
  const token = "ep_" + randomBytes(24).toString("hex");
  const keys = await readJsonDoc<ApiKey[]>(KEY, []);
  const key: ApiKey = {
    id: randomUUID().slice(0, 8),
    label: String(label ?? "").trim().slice(0, 60) || "API key",
    prefix: token.slice(0, 11),
    hash: sha(token),
    createdAt: new Date().toISOString(),
  };
  keys.push(key);
  await writeJsonDoc(KEY, keys);
  return { token, key: publicView(key) };
}

export async function revokeApiKey(id: string): Promise<boolean> {
  const keys = await readJsonDoc<ApiKey[]>(KEY, []);
  const next = keys.filter((k) => k.id !== id);
  if (next.length === keys.length) return false;
  await writeJsonDoc(KEY, next);
  return true;
}

/** Validate a presented token (marks lastUsed). Returns true if it matches. */
export async function verifyApiKey(token: string | null | undefined): Promise<boolean> {
  if (!token) return false;
  const h = sha(token.trim());
  const keys = await readJsonDoc<ApiKey[]>(KEY, []);
  const match = keys.find((k) => k.hash === h);
  if (!match) return false;
  match.lastUsed = new Date().toISOString();
  try {
    await writeJsonDoc(KEY, keys);
  } catch {
    /* best effort */
  }
  return true;
}

/** Extract a bearer token from an Authorization header or ?key= query param. */
export function tokenFromRequest(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const key = new URL(request.url).searchParams.get("key");
  return key || null;
}
