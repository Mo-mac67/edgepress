import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { readJsonDoc, writeJsonDoc } from "./storage";

export type Role = "super" | "admin";

export interface AdminUser {
  id: string;
  label: string;
  createdAt: string;
}

const COOKIE_NAME = "ms_admin";
const CONFIG_FILE = "admin-config.json";
const USERS_FILE = "admin-users.json";

function secret(): string {
  return process.env.ADMIN_SECRET ?? "dev-secret-change-me";
}
function hash(password: string): string {
  return createHash("sha256").update(password + secret()).digest("hex");
}
/** The super role exists only when SUPERADMIN_PASSWORD is explicitly set — no
 *  hardcoded default (this is open-source; a shipped default would be a
 *  backdoor). Returns null when unset, so no password can match it. */
function superHash(): string | null {
  const p = process.env.SUPERADMIN_PASSWORD;
  return p ? hash(p) : null;
}

const readJson = <T>(key: string, fallback: T) => readJsonDoc<T>(key, fallback);
const writeJson = (key: string, data: unknown) => writeJsonDoc(key, data);

type AdminConfig = { passwordHash?: string; tabPermissions?: Record<string, string[]>; setupDone?: boolean };

/** First-run detection: true once the owner has completed the setup wizard. */
export async function isSetupDone(): Promise<boolean> {
  const cfg = await readJson<AdminConfig>(CONFIG_FILE, {});
  return !!cfg.setupDone;
}
export async function completeSetup(password: string): Promise<boolean> {
  if (!password || password.length < 6) return false;
  const cfg = await readJson<AdminConfig>(CONFIG_FILE, {});
  await writeJson(CONFIG_FILE, { ...cfg, passwordHash: hash(password), setupDone: true });
  return true;
}

/** Primary client-admin hash: persisted (after change) or env-derived. */
async function primaryAdminHash(): Promise<string> {
  const cfg = await readJson<AdminConfig>(CONFIG_FILE, {});
  return cfg.passwordHash ?? hash(process.env.ADMIN_PASSWORD ?? "admin");
}

type StoredUser = AdminUser & { passwordHash: string };
async function storedUsers(): Promise<StoredUser[]> {
  return readJson<StoredUser[]>(USERS_FILE, []);
}

/** Every hash that grants the "admin" role. */
async function allAdminHashes(): Promise<string[]> {
  const users = await storedUsers();
  return [await primaryAdminHash(), ...users.map((u) => u.passwordHash)];
}

export async function verifyPassword(password: string): Promise<Role | null> {
  const h = hash(password);
  if (h === superHash()) return "super";
  if ((await allAdminHashes()).includes(h)) return "admin";
  return null;
}

export async function setAuthCookie(role: Role, credentialHash: string): Promise<void> {
  (await cookies()).set(COOKIE_NAME, `${role}.${credentialHash}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

/** Convenience used by login (knows the plaintext). */
export async function signIn(password: string): Promise<Role | null> {
  const role = await verifyPassword(password);
  if (role) await setAuthCookie(role, hash(password));
  return role;
}

export async function getRole(): Promise<Role | null> {
  const value = (await cookies()).get(COOKIE_NAME)?.value;
  if (!value) return null;
  const [role, h] = value.split(".");
  if (role === "super" && h === superHash()) return "super";
  if (role === "admin" && (await allAdminHashes()).includes(h)) return "admin";
  return null;
}

export async function isAuthed(): Promise<boolean> {
  return (await getRole()) !== null;
}

export async function clearAuthCookie(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
}

/** Sets the primary client-admin password (self-change or super reset). Preserves other config fields (tabPermissions). */
export async function setAdminPassword(next: string): Promise<boolean> {
  if (!next || next.length < 4) return false;
  const cfg = await readJson<AdminConfig>(CONFIG_FILE, {});
  await writeJson(CONFIG_FILE, { ...cfg, passwordHash: hash(next) });
  return true;
}

/** Which admin identity is signed in: "super", "admin" (primary password) or a managed user's label. */
export async function getAdminUsername(): Promise<string | null> {
  const value = (await cookies()).get(COOKIE_NAME)?.value;
  if (!value) return null;
  const [role, h] = value.split(".");
  if (role === "super" && h === superHash()) return "super";
  if (role === "admin") {
    if (h === (await primaryAdminHash())) return "admin";
    const u = (await storedUsers()).find((x) => x.passwordHash === h);
    if (u) return u.label;
  }
  return null;
}

/** Tabs the signed-in admin may see; null = unrestricted. Super is never restricted. */
export async function getAllowedTabs(): Promise<string[] | null> {
  const username = await getAdminUsername();
  if (!username || username === "super") return null;
  const cfg = await readJson<AdminConfig>(CONFIG_FILE, {});
  return cfg.tabPermissions?.[username] ?? null;
}

// ---- managed admin users (super only) ----
export async function listAdminUsers(): Promise<AdminUser[]> {
  return (await storedUsers()).map(({ id, label, createdAt }) => ({ id, label, createdAt }));
}

export async function addAdminUser(label: string, password: string): Promise<boolean> {
  if (!label.trim() || !password || password.length < 4) return false;
  const users = await storedUsers();
  users.push({ id: randomUUID(), label: label.trim().slice(0, 60), passwordHash: hash(password), createdAt: new Date().toISOString() });
  await writeJson(USERS_FILE, users);
  return true;
}

export async function removeAdminUser(id: string): Promise<boolean> {
  const users = await storedUsers();
  const next = users.filter((u) => u.id !== id);
  if (next.length === users.length) return false;
  await writeJson(USERS_FILE, next);
  return true;
}

export { hash as hashPassword };
