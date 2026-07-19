import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { readJsonDoc, writeJsonDoc } from "./storage";

/**
 * Site user accounts (clients + service providers) for the project
 * marketplace. File/KV-backed like every other store — free, no external
 * services. Separate from the admin auth in admin-auth.ts.
 *
 * OPTIONAL FEATURE MODULE — not in core-manifest.json. Copy manually into an
 * app together with the rest of the marketplace module (see APP-CONTRACT.md).
 * MapleSave keeps its own domain-specific copy (lib/user-auth.ts, cookie
 * "ms_user"); do NOT overwrite it.
 */
export type UserRole = "customer" | "business";

export interface BusinessProfile {
  company: string;
  trade: string;
  regions: string[];
  verified: boolean;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  business?: BusinessProfile;
  createdAt: string;
}

type StoredUser = User & { passwordHash: string };

const FILE = "users.json";
const RESETS_FILE = "user-resets.json";
const COOKIE = "site_user";
const RESET_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function secret(): string {
  return process.env.ADMIN_SECRET ?? "dev-secret-change-me";
}
function hash(s: string): string {
  return createHash("sha256").update(s + secret()).digest("hex");
}

async function readAll(): Promise<StoredUser[]> {
  return readJsonDoc<StoredUser[]>(FILE, []);
}
async function writeAll(users: StoredUser[]): Promise<void> {
  await writeJsonDoc(FILE, users);
}

function toPublic(u: StoredUser): User {
  const { passwordHash: _ph, ...rest } = u;
  return rest;
}

/** Session token is tied to the password hash, so changing it invalidates sessions. */
function sessionToken(u: StoredUser): string {
  return `${u.id}.${hash(u.id + u.passwordHash)}`;
}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  company?: string;
  trade?: string;
  regions?: string[];
}): Promise<{ user?: User; error?: "exists" | "invalid" }> {
  const name = input.name.trim().slice(0, 80);
  const email = input.email.trim().toLowerCase();
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || input.password.length < 6) {
    return { error: "invalid" };
  }
  if (input.role === "business" && !input.company?.trim()) {
    return { error: "invalid" };
  }
  const users = await readAll();
  if (users.some((u) => u.email === email)) return { error: "exists" };

  const user: StoredUser = {
    id: randomUUID(),
    email,
    name,
    role: input.role,
    passwordHash: hash(input.password),
    createdAt: new Date().toISOString(),
    ...(input.role === "business"
      ? {
          business: {
            company: (input.company ?? "").trim().slice(0, 100),
            trade: (input.trade ?? "general").trim().slice(0, 60),
            regions: (input.regions ?? []).map(String).slice(0, 20),
            verified: false,
          },
        }
      : {}),
  };
  users.push(user);
  await writeAll(users);
  await setSession(user);
  return { user: toPublic(user) };
}

export async function loginUser(email: string, password: string): Promise<User | null> {
  const users = await readAll();
  const u = users.find((x) => x.email === email.trim().toLowerCase());
  if (!u || u.passwordHash !== hash(password)) return null;
  await setSession(u);
  return toPublic(u);
}

async function setSession(u: StoredUser): Promise<void> {
  (await cookies()).set(COOKIE, sessionToken(u), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function currentUser(): Promise<User | null> {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return null;
  const [id] = value.split(".");
  const users = await readAll();
  const u = users.find((x) => x.id === id);
  if (!u || sessionToken(u) !== value) return null;
  return toPublic(u);
}

export async function signOutUser(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

// ---- admin helpers ----
export async function listUsers(): Promise<User[]> {
  return (await readAll()).map(toPublic).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const u = (await readAll()).find((x) => x.email === email.trim().toLowerCase());
  return u ? toPublic(u) : null;
}

export async function setBusinessVerified(id: string, verified: boolean): Promise<boolean> {
  const users = await readAll();
  const u = users.find((x) => x.id === id && x.role === "business");
  if (!u || !u.business) return false;
  u.business.verified = verified;
  await writeAll(users);
  return true;
}

/** Admin sets a temporary password directly (user's sessions are invalidated). */
export async function adminSetUserPassword(id: string, newPassword: string): Promise<boolean> {
  if (!newPassword || newPassword.length < 6) return false;
  const users = await readAll();
  const u = users.find((x) => x.id === id);
  if (!u) return false;
  u.passwordHash = hash(newPassword);
  await writeAll(users);
  return true;
}

export async function deleteUser(id: string): Promise<boolean> {
  const users = await readAll();
  const next = users.filter((x) => x.id !== id);
  if (next.length === users.length) return false;
  await writeAll(next);
  return true;
}

// ---- password reset (token) ----
type ResetRecord = { userId: string; expiresAt: number };
type ResetDoc = Record<string, ResetRecord>; // key = sha256(token)

async function readResets(): Promise<ResetDoc> {
  const doc = await readJsonDoc<ResetDoc>(RESETS_FILE, {});
  // Prune expired entries on read.
  const now = Date.now();
  let dirty = false;
  for (const k of Object.keys(doc)) {
    if (doc[k].expiresAt < now) {
      delete doc[k];
      dirty = true;
    }
  }
  if (dirty) await writeJsonDoc(RESETS_FILE, doc);
  return doc;
}

/**
 * Creates a one-time reset token for the account with this email (24h expiry).
 * Returns the PLAINTEXT token (only the hash is stored) or null if no account.
 */
export async function createResetToken(email: string): Promise<{ token: string; user: User } | null> {
  const users = await readAll();
  const u = users.find((x) => x.email === email.trim().toLowerCase());
  if (!u) return null;
  const token = randomBytes(24).toString("hex");
  const doc = await readResets();
  doc[hash(token)] = { userId: u.id, expiresAt: Date.now() + RESET_TTL_MS };
  await writeJsonDoc(RESETS_FILE, doc);
  return { token, user: toPublic(u) };
}

/** Consumes the token and sets the new password. Returns the user or null. */
export async function resetPasswordWithToken(token: string, newPassword: string): Promise<User | null> {
  if (!token || !newPassword || newPassword.length < 6) return null;
  const doc = await readResets();
  const key = hash(token);
  const rec = doc[key];
  if (!rec || rec.expiresAt < Date.now()) return null;
  const users = await readAll();
  const u = users.find((x) => x.id === rec.userId);
  if (!u) return null;
  u.passwordHash = hash(newPassword);
  await writeAll(users);
  delete doc[key];
  await writeJsonDoc(RESETS_FILE, doc);
  return toPublic(u);
}
