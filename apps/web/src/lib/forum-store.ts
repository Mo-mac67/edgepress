import "server-only";
import { randomUUID } from "node:crypto";
import { appendLogItem, readWithCompaction } from "./append-log";
import { writeJsonDoc } from "./storage";

/**
 * Forum v1 — moderated community threads + replies. Same trust model as blog
 * comments: anyone can post (rate-limited, honeypot, spam-flagged) but
 * nothing is public until the owner approves it. Opt-in via
 * settings.forumEnabled (default OFF — a business site shouldn't sprout a
 * forum by itself).
 */

export interface ForumThread {
  id: string;
  title: string;
  body: string;
  author: string;
  createdAt: string;
  status: "pending" | "approved";
  spam?: boolean;
}

export interface ForumReply {
  id: string;
  threadId: string;
  body: string;
  author: string;
  createdAt: string;
  status: "pending" | "approved";
  spam?: boolean;
}

const THREADS_KEY = "forum-threads.json";
const THREAD_PREFIX = "forum-thread-item-";
const REPLIES_KEY = "forum-replies.json";
const REPLY_PREFIX = "forum-reply-item-";
const MAX_KEPT = 2000;

export async function getAllThreads(): Promise<ForumThread[]> {
  const all = await readWithCompaction<ForumThread>(THREADS_KEY, THREAD_PREFIX);
  return [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function getAllReplies(): Promise<ForumReply[]> {
  const all = await readWithCompaction<ForumReply>(REPLIES_KEY, REPLY_PREFIX);
  return [...all].sort((a, b) => a.createdAt.localeCompare(b.createdAt)); // reading order
}

export async function getApprovedThreads(): Promise<(ForumThread & { replyCount: number })[]> {
  const [threads, replies] = await Promise.all([getAllThreads(), getAllReplies()]);
  const counts = new Map<string, number>();
  for (const r of replies) if (r.status === "approved") counts.set(r.threadId, (counts.get(r.threadId) ?? 0) + 1);
  return threads.filter((t) => t.status === "approved").map((t) => ({ ...t, replyCount: counts.get(t.id) ?? 0 }));
}

export async function getApprovedThread(id: string): Promise<{ thread: ForumThread; replies: ForumReply[] } | null> {
  const thread = (await getAllThreads()).find((t) => t.id === id && t.status === "approved");
  if (!thread) return null;
  const replies = (await getAllReplies()).filter((r) => r.threadId === id && r.status === "approved");
  return { thread, replies };
}

export async function addThread(input: { title: string; body: string; author: string; spam?: boolean }): Promise<ForumThread | { error: string }> {
  const title = String(input.title ?? "").trim().slice(0, 140);
  const body = String(input.body ?? "").trim().slice(0, 5000);
  const author = String(input.author ?? "").trim().slice(0, 60);
  if (title.length < 4) return { error: "Give the topic a title" };
  if (body.length < 2) return { error: "Write your question or topic" };
  if (author.length < 2) return { error: "Enter your name" };
  const t: ForumThread = { id: randomUUID().slice(0, 10), title, body, author, createdAt: new Date().toISOString(), status: "pending", ...(input.spam ? { spam: true } : {}) };
  await appendLogItem(THREAD_PREFIX, t.id, t);
  return t;
}

export async function addReply(input: { threadId: string; body: string; author: string; spam?: boolean }): Promise<ForumReply | { error: string }> {
  const body = String(input.body ?? "").trim().slice(0, 5000);
  const author = String(input.author ?? "").trim().slice(0, 60);
  if (body.length < 2) return { error: "Write a reply first" };
  if (author.length < 2) return { error: "Enter your name" };
  const thread = (await getAllThreads()).find((t) => t.id === input.threadId && t.status === "approved");
  if (!thread) return { error: "Unknown topic" };
  const r: ForumReply = { id: randomUUID().slice(0, 10), threadId: thread.id, body, author, createdAt: new Date().toISOString(), status: "pending", ...(input.spam ? { spam: true } : {}) };
  await appendLogItem(REPLY_PREFIX, r.id, r);
  return r;
}

export async function moderateForumItem(kind: "thread" | "reply", id: string, status: "approved" | "pending"): Promise<boolean> {
  if (kind === "thread") {
    const all = await getAllThreads();
    const t = all.find((x) => x.id === id);
    if (!t) return false;
    t.status = status;
    await writeJsonDoc(THREADS_KEY, all.slice(0, MAX_KEPT));
    return true;
  }
  const all = await getAllReplies();
  const r = all.find((x) => x.id === id);
  if (!r) return false;
  r.status = status;
  await writeJsonDoc(REPLIES_KEY, all.slice(0, MAX_KEPT));
  return true;
}

export async function deleteForumItem(kind: "thread" | "reply", id: string): Promise<boolean> {
  if (kind === "thread") {
    const all = await getAllThreads();
    const next = all.filter((x) => x.id !== id);
    if (next.length === all.length) return false;
    await writeJsonDoc(THREADS_KEY, next.slice(0, MAX_KEPT));
    // Orphaned replies die with the thread.
    const replies = await getAllReplies();
    await writeJsonDoc(REPLIES_KEY, replies.filter((r) => r.threadId !== id).slice(0, MAX_KEPT));
    return true;
  }
  const all = await getAllReplies();
  const next = all.filter((x) => x.id !== id);
  if (next.length === all.length) return false;
  await writeJsonDoc(REPLIES_KEY, next.slice(0, MAX_KEPT));
  return true;
}
