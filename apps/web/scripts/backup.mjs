// Backs up the JSON data store (leads, events, audit, config) into
// backups/<timestamp>/. Run with: npm run backup
import { cp, mkdir, readdir } from "node:fs/promises";
import path from "node:path";

const DATA = path.join(process.cwd(), "data");
const STAMP = new Date().toISOString().replace(/[:.]/g, "-");
const DEST = path.join(process.cwd(), "backups", STAMP);

async function main() {
  let files = [];
  try {
    files = (await readdir(DATA)).filter((f) => f.endsWith(".json"));
  } catch {
    console.log("No data/ directory yet — nothing to back up.");
    return;
  }
  if (files.length === 0) {
    console.log("No data files to back up.");
    return;
  }
  await mkdir(DEST, { recursive: true });
  for (const f of files) await cp(path.join(DATA, f), path.join(DEST, f));
  console.log(`Backed up ${files.length} file(s) → ${DEST}`);
}

main();
