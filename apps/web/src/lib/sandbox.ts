import "server-only";
import { readJsonDoc, writeJsonDoc } from "./storage";
import { exportAll, importAll } from "./backup";

/**
 * Sandbox mode — a public instance anyone can log into and break, which puts
 * itself back the way it was on a schedule.
 *
 * Two responsibilities:
 *  1. RESET: keep a pristine snapshot and restore it on a cron.
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

/** Minutes between resets (informational — the cron schedule is authoritative). */
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
  await writeJsonDoc(SNAPSHOT_KEY, backup);
  const state = await getSandboxState();
  await writeJsonDoc(STATE_KEY, { ...state, snapshotAt: new Date().toISOString() });
  return { keys: Object.keys(backup.docs).length };
}

export async function hasSnapshot(): Promise<boolean> {
  return (await readJsonDoc<unknown>(SNAPSHOT_KEY, null)) !== null;
}

/**
 * Put the sandbox back. Returns how many documents were restored, or null when
 * there's no snapshot yet (so a cron firing before setup is a no-op, not a
 * wipe — restoring "nothing" would be worse than doing nothing).
 */
export async function resetSandbox(): Promise<{ restored: number } | null> {
  const snapshot = await readJsonDoc<unknown>(SNAPSHOT_KEY, null);
  if (!snapshot) return null;
  const { restored } = await importAll(snapshot);
  const state = await getSandboxState();
  await writeJsonDoc(STATE_KEY, {
    ...state,
    lastResetAt: new Date().toISOString(),
    resets: (state.resets ?? 0) + 1,
  });
  return { restored };
}
