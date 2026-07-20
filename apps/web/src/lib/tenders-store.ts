import "server-only";
import { randomUUID } from "node:crypto";
import { readJsonDoc, writeJsonDoc } from "./storage";

/**
 * Project marketplace: a client publishes a project brief; verified service
 * providers bid on it. Admin approves projects before they go live. Bids are
 * sealed: visible to the project owner and admins only (bid count is public).
 * KV/file-backed — free, no external services.
 *
 * Optional feature module — enable per project if you need a tender/bid flow.
 */
export type TenderStatus = "pending" | "open" | "awarded" | "closed";

export interface BlueprintLine {
  label: string;
  detail: string;
  min: number;
  max: number;
}

export interface Tender {
  id: string;
  ownerId: string;
  ownerName: string;
  title: string;
  description: string;
  /** Free-text location (city / region). */
  location: string;
  /** Generic project category. */
  category: string;
  /** Free-form tags (services / scopes of work). */
  tags: string[];
  lines: BlueprintLine[];
  totalMin: number;
  totalMax: number;
  status: TenderStatus;
  createdAt: string;
}

export interface Bid {
  id: string;
  tenderId: string;
  businessId: string;
  company: string;
  trade: string;
  amount: number;
  timelineWeeks?: number;
  message: string;
  createdAt: string;
}

const TENDERS = "tenders.json";
const BIDS = "bids.json";

async function readJson<T>(file: string): Promise<T[]> {
  return readJsonDoc<T[]>(file, []);
}
async function writeJson(file: string, data: unknown): Promise<void> {
  await writeJsonDoc(file, data);
}

// ---- tenders ----
export async function createTender(
  input: Omit<Tender, "id" | "status" | "createdAt">,
): Promise<Tender> {
  const tenders = await readJson<Tender>(TENDERS);
  const tender: Tender = {
    ...input,
    id: randomUUID(),
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  tenders.push(tender);
  await writeJson(TENDERS, tenders);
  return tender;
}

export async function listTenders(filter?: { status?: TenderStatus; ownerId?: string }): Promise<Tender[]> {
  let tenders = await readJson<Tender>(TENDERS);
  if (filter?.status) tenders = tenders.filter((t) => t.status === filter.status);
  if (filter?.ownerId) tenders = tenders.filter((t) => t.ownerId === filter.ownerId);
  return tenders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getTender(id: string): Promise<Tender | null> {
  return (await readJson<Tender>(TENDERS)).find((t) => t.id === id) ?? null;
}

export async function setTenderStatus(id: string, status: TenderStatus): Promise<boolean> {
  const tenders = await readJson<Tender>(TENDERS);
  const t = tenders.find((x) => x.id === id);
  if (!t) return false;
  t.status = status;
  await writeJson(TENDERS, tenders);
  return true;
}

// ---- bids ----
export async function addBid(input: Omit<Bid, "id" | "createdAt">): Promise<Bid | null> {
  const bids = await readJson<Bid>(BIDS);
  // One bid per business per tender; a new bid replaces the old one.
  const filtered = bids.filter((b) => !(b.tenderId === input.tenderId && b.businessId === input.businessId));
  const bid: Bid = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
  filtered.push(bid);
  await writeJson(BIDS, filtered);
  return bid;
}

export async function bidsForTender(tenderId: string): Promise<Bid[]> {
  return (await readJson<Bid>(BIDS))
    .filter((b) => b.tenderId === tenderId)
    .sort((a, b) => a.amount - b.amount);
}

export async function bidsByBusiness(businessId: string): Promise<Bid[]> {
  return (await readJson<Bid>(BIDS))
    .filter((b) => b.businessId === businessId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function bidCount(tenderId: string): Promise<number> {
  return (await bidsForTender(tenderId)).length;
}
