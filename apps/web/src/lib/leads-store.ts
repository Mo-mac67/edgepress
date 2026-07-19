import "server-only";
import { randomUUID } from "node:crypto";
import { readJsonDoc, writeJsonDoc } from "./storage";
import type { Lead } from "./types";
export { LEAD_STATUSES } from "./types";

/**
 * Lead store behind a small repository interface. Persistence (Cloudflare KV in
 * production, JSON file in local dev) is handled by storage.ts.
 */
const KEY = "leads.json";

async function readAll(): Promise<Lead[]> {
  return readJsonDoc<Lead[]>(KEY, []);
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
  const leads = await readAll();
  const lead: Lead = {
    ...input,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    status: "new",
    read: false,
  };
  leads.push(lead);
  await writeAll(leads);
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

