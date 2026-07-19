import "server-only";
import { randomUUID } from "node:crypto";
import { readJsonDoc, writeJsonDoc } from "./storage";
import type { Role } from "./admin-auth";

export interface AuditEntry {
  id: string;
  action: string;
  role: Role | null;
  detail?: string;
  createdAt: string;
}

const KEY = "audit.json";
const MAX = 2000;

export async function logAudit(input: { action: string; role: Role | null; detail?: string }): Promise<void> {
  const entries = await readJsonDoc<AuditEntry[]>(KEY, []);
  entries.push({ id: randomUUID(), createdAt: new Date().toISOString(), ...input });
  await writeJsonDoc(KEY, entries.slice(-MAX));
}

export async function getAudit(): Promise<AuditEntry[]> {
  const entries = await readJsonDoc<AuditEntry[]>(KEY, []);
  return [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
