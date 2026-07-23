import "server-only";
import { randomUUID } from "node:crypto";
import { appendLogItem, readWithCompaction } from "./append-log";
import { writeJsonDoc } from "./storage";

/**
 * Blog comments — one global moderated queue. Writes are race-safe per-item
 * (append-log, like leads/forms); nothing is public before approval.
 */

export interface Comment {
  id: string;
  postSlug: string;
  author: string;
  body: string;
  createdAt: string;
  status: "pending" | "approved";
  /** Heuristic flag — surfaced in the queue, never auto-published anyway. */
  spam?: boolean;
}

const KEY = "comments.json";
const ITEM_PREFIX = "comment-item-";
const MAX_KEPT = 2000;

export async function getAllComments(): Promise<Comment[]> {
  const all = await readWithCompaction<Comment>(KEY, ITEM_PREFIX);
  return [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getApprovedComments(postSlug: string, limit = 100): Promise<Comment[]> {
  return (await getAllComments()).filter((c) => c.postSlug === postSlug && c.status === "approved").slice(0, limit).reverse(); // oldest first for reading flow
}

export async function addComment(input: { postSlug: string; author: string; body: string; spam?: boolean }): Promise<Comment | { error: string }> {
  const author = String(input.author ?? "").trim().slice(0, 60);
  const body = String(input.body ?? "").trim().slice(0, 2000);
  if (author.length < 2) return { error: "Enter your name" };
  if (body.length < 2) return { error: "Write a comment first" };
  const c: Comment = {
    id: randomUUID().slice(0, 10),
    postSlug: String(input.postSlug).slice(0, 120),
    author,
    body,
    createdAt: new Date().toISOString(),
    status: "pending",
    ...(input.spam ? { spam: true } : {}),
  };
  await appendLogItem(ITEM_PREFIX, c.id, c);
  return c;
}

export async function setCommentStatus(id: string, status: "approved" | "pending"): Promise<boolean> {
  const all = await getAllComments();
  const c = all.find((x) => x.id === id);
  if (!c) return false;
  c.status = status;
  await writeJsonDoc(KEY, all.slice(0, MAX_KEPT));
  return true;
}

export async function deleteComment(id: string): Promise<boolean> {
  const all = await getAllComments();
  const next = all.filter((x) => x.id !== id);
  if (next.length === all.length) return false;
  await writeJsonDoc(KEY, next.slice(0, MAX_KEPT));
  return true;
}
