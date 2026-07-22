import "server-only";
import { randomUUID } from "node:crypto";
import { writeJsonDoc } from "./storage";
import { appendLogItem, readWithCompaction } from "./append-log";
import type { Lead } from "./types";
export { LEAD_STATUSES } from "./types";

/**
 * Lead store behind a small repository interface. New leads are written via the
 * race-safe append-log (each lead gets its own key — two simultaneous
 * submissions can never lose one), then folded into `leads.json` on admin
 * reads. Persistence backend (KV/file/SQL) is handled by storage.ts.
 */
const KEY = "leads.json";
const ITEM_PREFIX = "lead-item-";

async function readAll(): Promise<Lead[]> {
  return readWithCompaction<Lead>(KEY, ITEM_PREFIX);
}

async function writeAll(leads: Lead[]): Promise<void> {
  await writeJsonDoc(KEY, leads);
}

export async function getLeads(): Promise<Lead[]> {
  const leads = await readAll();
  return leads.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getLead(id: string): Promise<Lead | null> {
  const leads = await readAll();
  return leads.find((l) => l.id === id) ?? null;
}

export async function createLead(
  input: Omit<Lead, "id" | "createdAt" | "status">,
): Promise<Lead> {
  const lead: Lead = {
    ...input,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    status: "new",
    read: false,
  };
  // Atomic per-lead write — concurrent submissions can never overwrite each
  // other (the old read-modify-write on leads.json could lose one).
  await appendLogItem(ITEM_PREFIX, lead.id, lead);
  return lead;
}

export async function updateLead(
  id: string,
  patch: Partial<Pick<Lead, "status" | "notes" | "read" | "lastFollowUpAt">>,
): Promise<Lead | null> {
  const leads = await readAll();
  const idx = leads.findIndex((l) => l.id === id);
  if (idx === -1) return null;
  leads[idx] = { ...leads[idx], ...patch };
  await writeAll(leads);
  return leads[idx];
}

export async function deleteLead(id: string): Promise<boolean> {
  const leads = await readAll();
  const next = leads.filter((l) => l.id !== id);
  if (next.length === leads.length) return false;
  await writeAll(next);
  return true;
}

