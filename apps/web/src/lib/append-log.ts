import "server-only";
import { deleteJsonDoc, listJsonDocs, readJsonDoc, writeJsonDoc } from "./storage";

/**
 * Append-log with lazy compaction — the race-safe write pattern for
 * customer-generated records (leads, form submissions).
 *
 * WHY: KV/file adapters have no transactions, so the old
 * read-whole-doc → push → write-whole-doc pattern LOSES one of two concurrent
 * submissions (lost update). Here every new record is written to its own key
 * (an atomic put — nothing to race with). Admin reads then merge the compacted
 * aggregate with any pending item docs and fold them in (bounded per request
 * to stay inside Workers subrequest limits).
 *
 * Concurrency notes: item writes can never lose data; compaction only deletes
 * an item after its content is persisted in the aggregate; concurrent
 * compactions merge the same immutable items (idempotent). Editing races on
 * the aggregate itself (two admins updating simultaneously) remain
 * last-write-wins, as before.
 */

const COMPACT_BATCH = 40;

export async function appendLogItem(itemPrefix: string, id: string, value: unknown): Promise<void> {
  await writeJsonDoc(`${itemPrefix}${id}.json`, value);
}

export async function readWithCompaction<T extends { id: string }>(aggregateKey: string, itemPrefix: string): Promise<T[]> {
  const aggregate = await readJsonDoc<T[]>(aggregateKey, []);
  const pendingKeys = (await listJsonDocs(itemPrefix)).slice(0, COMPACT_BATCH);
  if (pendingKeys.length === 0) return aggregate;

  const reads = (await Promise.all(pendingKeys.map((k) => readJsonDoc<T | null>(k, null)))) as (T | null)[];
  const items = reads.filter((x): x is T => !!x && !!x.id);
  const known = new Set(aggregate.map((x) => x.id));
  const merged = aggregate.concat(items.filter((x) => !known.has(x.id)));

  try {
    await writeJsonDoc(aggregateKey, merged);
    // Only remove items once the merged aggregate is safely written.
    await Promise.all(pendingKeys.map((k) => deleteJsonDoc(k)));
  } catch {
    /* compaction is best-effort — items stay pending and retry next read */
  }
  return merged;
}
