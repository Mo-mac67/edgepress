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

type AdminConfig = { passwordHash?: string; tabPermissions?: Record<string, string[]>; setupDone?: boolean; totp?: { secret: string; enabled: boolean }; ownerUsername?: string; adminPath?: string; clientMode?: boolean; sessionEpoch?: number };

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

/** Hashes for managed team members (NOT the owner). */
async function managedUserHashes(): Promise<string[]> {
  return (await storedUsers()).map((u) => u.passwordHash);
}

/**
 * Role model:
 *  - "super" = the SITE OWNER (whoever set the password in the setup wizard, or
 *    an optional platform SUPERADMIN_PASSWORD). Full control: team, audit, all
 *    tabs, settings.
 *  - "admin" = a managed team member the owner created — sees only the tabs the
 *    owner allows.
 */
export async function verifyPassword(password: string): Promise<Role | null> {
  const h = hash(password);
  const sh = superHash();
  if (sh && h === sh) return "super";
  if (h === (await primaryAdminHash())) return "super"; // the owner
  if ((await managedUserHashes()).includes(h)) return "admin";
  return null;
}

/**
 * Username + password sign-in. Username is OPTIONAL and backward-compatible:
 * with no username this is exactly verifyPassword (owner, or any team member by
 * password) — so the owner can NEVER be locked out. With a username it must
 * match a team member's name, or the owner's configured username.
 */
export async function verifyCredentials(username: string | undefined, password: string): Promise<Role | null> {
  const u = (username ?? "").trim().toLowerCase();
  if (!u) return verifyPassword(password); // safety fallback — password alone always works
  const member = (await storedUsers()).find((x) => x.label.trim().toLowerCase() === u && x.passwordHash === hash(password));
  if (member) return "admin";
  const owner = (await getOwnerUsername()).toLowerCase();
  if (u === (owner || "owner") && (await verifyPassword(password)) === "super") return "super";
  return null;
}

/** Session epoch: bumping it (via logoutEverywhere) invalidates every existing
 *  cookie. 0/undefined means "no forced logout yet" (legacy cookies stay valid). */
async function currentEpoch(): Promise<number> {
  const cfg = await readJson<AdminConfig>(CONFIG_FILE, {});
  return cfg.sessionEpoch ?? 0;
}

export async function setAuthCookie(role: Role, credentialHash: string): Promise<void> {
  const epoch = await currentEpoch();
  (await cookies()).set(COOKIE_NAME, `${role}.${credentialHash}.${epoch}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

/** Invalidate all sessions everywhere (owner action): bump the epoch so every
 *  issued cookie stops validating. The owner is signed out too and re-logs in. */
export async function logoutEverywhere(): Promise<void> {
  const cfg = await readJson<AdminConfig>(CONFIG_FILE, {});
  await writeJson(CONFIG_FILE, { ...cfg, sessionEpoch: (cfg.sessionEpoch ?? 0) + 1 });
}

export async function getClientMode(): Promise<boolean> {
  const cfg = await readJson<AdminConfig>(CONFIG_FILE, {});
  return !!cfg.clientMode;
}
export async function setClientMode(on: boolean): Promise<boolean> {
  const cfg = await readJson<AdminConfig>(CONFIG_FILE, {});
  await writeJson(CONFIG_FILE, { ...cfg, clientMode: !!on });
  return true;
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
  const [role, h, ep] = value.split(".");
  // Session epoch: once the owner has forced a global logout (epoch > 0), a
  // cookie must carry the matching epoch. Legacy cookies (no epoch) stay valid
  // only while epoch is still 0 — so nothing breaks until a logout-everywhere.
  const epoch = await currentEpoch();
  if (epoch > 0 && ep !== String(epoch)) return null;
  const sh = superHash();
  if (role === "super" && ((sh && h === sh) || h === (await primaryAdminHash()))) return "super";
  if (role === "admin" && (await managedUserHashes()).includes(h)) return "admin";
  return null;
}

export async function isAuthed(): Promise<boolean> {
  return (await getRole()) !== null;
}

export async function clearAuthCookie(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
}

/** SSO (Google OAuth) sign-in as the owner. The cookie reuses the stored
 *  owner credential hash so getRole() validates it like any session. Only
 *  callable after the OAuth callback verified an allowlisted email. */
export async function signInAsOwnerSso(): Promise<boolean> {
  const h = await primaryAdminHash();
  if (!h) return false;
  await setAuthCookie("super", h);
  return true;
}

/** Sets the primary client-admin password (self-change or super reset). Preserves other config fields (tabPermissions). */
export async function setAdminPassword(next: string): Promise<boolean> {
  if (!next || next.length < 4) return false;
  const cfg = await readJson<AdminConfig>(CONFIG_FILE, {});
  await writeJson(CONFIG_FILE, { ...cfg, passwordHash: hash(next) });
  return true;
}

/** The owner's optional login username (blank = login with password only). */
export async function getOwnerUsername(): Promise<string> {
  const cfg = await readJson<AdminConfig>(CONFIG_FILE, {});
  return cfg.ownerUsername ?? "";
}
export async function setOwnerUsername(name: string): Promise<boolean> {
  const cfg = await readJson<AdminConfig>(CONFIG_FILE, {});
  await writeJson(CONFIG_FILE, { ...cfg, ownerUsername: (name ?? "").trim().slice(0, 40) });
  return true;
}

const RESERVED_ADMIN_PATHS = ["blog", "search", "learn", "forum", "account", "tenders", "api", "en", "fr"];
/** The admin URL segment. `ADMIN_PATH` env always wins (recovery escape hatch),
 *  then the configured value, else the default "admin". */
export async function getAdminPath(): Promise<string> {
  const env = (process.env.ADMIN_PATH ?? "").trim().replace(/^\/+|\/+$/g, "");
  if (env) return env;
  const cfg = await readJson<AdminConfig>(CONFIG_FILE, {});
  return ((cfg.adminPath ?? "admin").trim().replace(/^\/+|\/+$/g, "")) || "admin";
}
/** Change the admin URL segment (super only — enforced in the route). Reverting
 *  to "admin" is always allowed; other reserved top-level routes are rejected. */
export async function setAdminPath(path: string): Promise<{ ok: boolean; error?: string; path?: string }> {
  const clean = (path ?? "").trim().toLowerCase().replace(/^\/+|\/+$/g, "").replace(/[^a-z0-9/-]/g, "-").replace(/-+/g, "-");
  if (!clean) return { ok: false, error: "Path required" };
  if (clean !== "admin" && RESERVED_ADMIN_PATHS.includes(clean.split("/")[0])) return { ok: false, error: "That path is reserved" };
  const cfg = await readJson<AdminConfig>(CONFIG_FILE, {});
  await writeJson(CONFIG_FILE, { ...cfg, adminPath: clean });
  return { ok: true, path: clean };
}

/** Who is signed in: "super" (the owner) or a managed member's label. */
export async function getAdminUsername(): Promise<string | null> {
  const value = (await cookies()).get(COOKIE_NAME)?.value;
  if (!value) return null;
  const [role, h] = value.split(".");
  const sh = superHash();
  if (role === "super" && ((sh && h === sh) || h === (await primaryAdminHash()))) return "super";
  if (role === "admin") {
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

// ---- Two-factor authentication (owner, optional) ----
import { generateSecret, totpUri, verifyTotp } from "./totp";

/** Whether the owner has 2FA turned on (checked at login). */
export async function isTotpEnabled(): Promise<boolean> {
  const cfg = await readJson<AdminConfig>(CONFIG_FILE, {});
  return !!cfg.totp?.enabled;
}
export async function getTotpStatus(): Promise<{ enabled: boolean }> {
  return { enabled: await isTotpEnabled() };
}
/** Verify a login code against the owner's active 2FA secret. */
export async function verifyOwnerTotp(code: string): Promise<boolean> {
  const cfg = await readJson<AdminConfig>(CONFIG_FILE, {});
  if (!cfg.totp?.enabled || !cfg.totp.secret) return false;
  return verifyTotp(cfg.totp.secret, code);
}
/** Start enrolment: generate a secret (not yet active) + otpauth URI to scan. */
export async function startTotpSetup(account = "owner"): Promise<{ secret: string; uri: string }> {
  const cfg = await readJson<AdminConfig>(CONFIG_FILE, {});
  const secret = generateSecret();
  await writeJson(CONFIG_FILE, { ...cfg, totp: { secret, enabled: false } });
  return { secret, uri: totpUri(secret, account) };
}
/** Activate 2FA once the owner proves they can generate a valid code. */
export async function confirmTotp(code: string): Promise<boolean> {
  const cfg = await readJson<AdminConfig>(CONFIG_FILE, {});
  if (!cfg.totp?.secret || !verifyTotp(cfg.totp.secret, code)) return false;
  await writeJson(CONFIG_FILE, { ...cfg, totp: { secret: cfg.totp.secret, enabled: true } });
  return true;
}
export async function disableTotp(): Promise<void> {
  const cfg = await readJson<AdminConfig>(CONFIG_FILE, {});
  await writeJson(CONFIG_FILE, { ...cfg, totp: undefined });
}
