import "server-only";
import { deleteJsonDoc, listJsonDocs, readJsonDoc, writeJsonDoc } from "./storage";
import { exportAll, importAll } from "./backup";

/**
 * Sandbox mode — a public instance anyone can log into and break, which puts
 * itself back the way it was on a schedule.
 *
 * Two responsibilities:
 *  1. RESET: keep a pristine snapshot and restore it once the interval has
 *     elapsed, evaluated at request time (see maybeResetSandbox).
 *  2. CONTAIN: a stranger with admin rights must not be able to reach the
 *     outside world (email, webhooks) or lock the next visitor out (password,
 *     admin URL, sign-out-everywhere). Everything else stays fully editable —
 *     the point is to let people actually try the product.
 *
 * Enabled with EDGEPRESS_SANDBOX=1. Off by default, so a normal install is
 * completely unaffected by any of this.
 */

const SNAPSHOT_KEY = "sandbox-snapshot.json";
const STATE_KEY = "sandbox-state.json";

export interface SandboxState {
  /** ISO time of the last successful reset. */
  lastResetAt?: string;
  /** ISO time the snapshot was captured. */
  snapshotAt?: string;
  resets?: number;
}

export function isSandbox(): boolean {
  return process.env.EDGEPRESS_SANDBOX === "1";
}

/** The sign-in hint shown in the banner (e.g. "sandbox / sandbox"). A sandbox
 *  nobody can get into is pointless, so these credentials are meant to be
 *  public — set EDGEPRESS_SANDBOX_LOGIN to advertise them. */
export function sandboxLogin(): string | undefined {
  return process.env.EDGEPRESS_SANDBOX_LOGIN?.trim() || undefined;
}

/** Minutes between resets. */
export function sandboxResetMinutes(): number {
  const n = Number(process.env.EDGEPRESS_SANDBOX_RESET_MINUTES);
  return Number.isFinite(n) && n > 0 ? n : 60;
}

/**
 * Actions a sandbox visitor must not be able to perform. Grouped by WHY, so it
 * stays obvious what each one is protecting.
 */
export type SandboxBlockedAction =
  // reaching real people
  | "send-email"
  | "deliver-webhook"
  // locking the next visitor out
  | "change-password"
  | "change-admin-path"
  | "change-owner-username"
  | "logout-everywhere"
  | "manage-2fa"
  // spending the owner's money / quota
  | "restore-backup";

const REASONS: Record<SandboxBlockedAction, string> = {
  "send-email": "Sending email is disabled in the sandbox.",
  "deliver-webhook": "Outbound webhooks are disabled in the sandbox.",
  "change-password": "The sign-in password is fixed in the sandbox so the next visitor can get in.",
  "change-admin-path": "The admin URL is fixed in the sandbox.",
  "change-owner-username": "The sign-in username is fixed in the sandbox.",
  "logout-everywhere": "Signing everyone out is disabled in the sandbox.",
  "manage-2fa": "Two-factor is disabled in the sandbox so nobody gets locked out.",
  "restore-backup": "Restoring a backup is disabled in the sandbox; it resets on its own.",
};

/** True when this action must be refused because we're in sandbox mode. */
export function sandboxBlocks(action: SandboxBlockedAction): boolean {
  return isSandbox();
}

/** Human-readable reason, for the API response body. */
export function sandboxReason(action: SandboxBlockedAction): string {
  return REASONS[action];
}

export async function getSandboxState(): Promise<SandboxState> {
  return (await readJsonDoc<SandboxState | null>(STATE_KEY, null)) ?? {};
}

/**
 * Capture the current content as the state every reset returns to. Called once
 * after seeding the sandbox the way you want visitors to find it.
 */
export async function captureSnapshot(): Promise<{ keys: number }> {
  const backup = await exportAll();
  // Never snapshot the snapshot (or the reset bookkeeping) — re-capturing would
  // nest the previous blob inside the new one and grow without bound.
  delete backup.docs[SNAPSHOT_KEY];
  delete backup.docs[STATE_KEY];
  await writeJsonDoc(SNAPSHOT_KEY, backup);
  const state = await getSandboxState();
  await writeJsonDoc(STATE_KEY, { ...state, snapshotAt: new Date().toISOString() });
  return { keys: Object.keys(backup.docs).length };
}

export async function hasSnapshot(): Promise<boolean> {
  return (await readJsonDoc<unknown>(SNAPSHOT_KEY, null)) !== null;
}

/**
 * Reset when the interval has elapsed, evaluated on a request rather than by a
 * cron. Cloudflare cron triggers fire a `scheduled` handler, which the OpenNext
 * worker doesn't export — a trigger would silently never run. Read-time is also
 * how scheduled publishing already works here, and it behaves identically on
 * Workers, Docker and plain Node.
 *
 * Cheap in the common case: one small read, and nothing at all when sandbox
 * mode is off. A sandbox nobody is visiting doesn't need resetting.
 */
export async function maybeResetSandbox(): Promise<boolean> {
  if (!isSandbox()) return false;
  const state = await getSandboxState();
  const dueAfter = sandboxResetMinutes() * 60_000;
  const last = state.lastResetAt ? Date.parse(state.lastResetAt) : 0;
  if (last && Date.now() - last < dueAfter) return false;
  if (!(await hasSnapshot())) return false;

  // Claim the slot BEFORE restoring so two concurrent requests don't both run
  // it. Restore is idempotent, so a rare double-run is harmless anyway.
  await writeJsonDoc(STATE_KEY, { ...state, lastResetAt: new Date().toISOString() });
  return (await resetSandbox()) !== null;
}

/**
 * Put the sandbox back. Returns how many documents were restored, or null when
 * there's no snapshot yet (so a reset firing before setup is a no-op, not a
 * wipe — restoring "nothing" would be worse than doing nothing).
 */
export async function resetSandbox(): Promise<{ restored: number; removed: number } | null> {
  const snapshot = await readJsonDoc<{ docs?: Record<string, unknown> } | null>(SNAPSHOT_KEY, null);
  if (!snapshot?.docs || Object.keys(snapshot.docs).length === 0) return null;

  // Overwrite everything the snapshot knows about…
  const { restored } = await importAll(snapshot);

  // …then remove what it doesn't. importAll only overwrites matching keys, so
  // without this the leads, form submissions and collections a visitor creates
  // would survive every reset and pile up forever. Restoring a state means
  // ending at that state, not merging into it.
  const keep = new Set(Object.keys(snapshot.docs));
  keep.add(SNAPSHOT_KEY); // the snapshot itself must outlive the reset
  keep.add(STATE_KEY);
  let removed = 0;
  for (const key of await listJsonDocs("")) {
    if (keep.has(key)) continue;
    await deleteJsonDoc(key);
    removed++;
  }

  const state = await getSandboxState();
  await writeJsonDoc(STATE_KEY, {
    ...state,
    lastResetAt: new Date().toISOString(),
    resets: (state.resets ?? 0) + 1,
  });
  return { restored, removed };
}
