import "server-only";
import { getKV, writeJsonDoc } from "./storage";

/**
 * Whole-site backup/restore. Exports every stored document (pages, posts,
 * content types + entries, forms + submissions, leads, settings, theme, SEO,
 * auth config, etc.) as a single JSON file. Works in both KV (production) and
 * fs (self-host) mode. NOTE: binary media in R2 is NOT included — only the
 * media *index*; re-upload files separately if you migrate hosts.
 */

export interface BackupFile {
  version: number;
  exportedAt: string;
  storage: "kv" | "fs";
  docs: Record<string, unknown>;
}

export async function exportAll(): Promise<BackupFile> {
  const kv = await getKV();
  const docs: Record<string, unknown> = {};

  if (kv) {
    let cursor: string | undefined;
    do {
      const res = await kv.list({ cursor });
      for (const k of res.keys) {
        const v = await kv.get(k.name);
        if (v == null) continue;
        try {
          docs[k.name] = JSON.parse(v);
        } catch {
          docs[k.name] = v;
        }
      }
      cursor = res.list_complete ? undefined : res.cursor;
    } while (cursor);
  } else {
    const path = (await import("node:path")).default;
    const { readdir, readFile } = await import("node:fs/promises");
    const dir = process.env.DATA_DIR || path.join(process.cwd(), "data");
    let files: string[] = [];
    try {
      files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
    } catch {
      /* no data dir yet */
    }
    for (const f of files) {
      try {
        docs[f] = JSON.parse(await readFile(path.join(dir, f), "utf8"));
      } catch {
        /* skip unreadable */
      }
    }
  }

  return { version: 1, exportedAt: new Date().toISOString(), storage: kv ? "kv" : "fs", docs };
}

/** Restore documents from a backup. Overwrites matching keys; leaves others. */
export async function importAll(backup: unknown): Promise<{ restored: number }> {
  const b = backup as BackupFile;
  if (!b || typeof b !== "object" || !b.docs || typeof b.docs !== "object") {
    throw new Error("Invalid backup file");
  }
  let restored = 0;
  for (const [key, value] of Object.entries(b.docs)) {
    if (!/^[\w.-]+$/.test(key)) continue; // guard against odd keys
    await writeJsonDoc(key, value);
    restored++;
  }
  return { restored };
}
