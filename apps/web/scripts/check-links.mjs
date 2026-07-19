// Link health checker for the program dataset — the first piece of the
// "auto-update" pipeline. Pings every program URL and reports dead/redirected
// links so the data team knows what to re-verify.
//
// Usage: npm run check:links

import { readFile } from "node:fs/promises";
import path from "node:path";

const DATA_FILE = path.join(process.cwd(), "src", "lib", "programs-data.ts");
const TIMEOUT_MS = 15000;

async function main() {
  const text = await readFile(DATA_FILE, "utf8");
  const re = /id:\s*"([^"]+)"[\s\S]*?url:\s*"([^"]+)"/g;
  const entries = [];
  let m;
  while ((m = re.exec(text)) !== null) entries.push({ id: m[1], url: m[2] });

  console.log(`Checking ${entries.length} program URLs...\n`);

  const results = await Promise.all(entries.map(check));

  const bad = results.filter((r) => !r.ok);
  for (const r of results) {
    const flag = r.ok ? "OK " : "!! ";
    console.log(`${flag}${String(r.status).padEnd(7)} ${r.id.padEnd(26)} ${r.url}`);
  }

  console.log(`\n${results.length - bad.length}/${results.length} healthy.`);
  if (bad.length) {
    console.log(`\nNeeds review (${bad.length}):`);
    for (const r of bad) console.log(`  - ${r.id}: ${r.status} ${r.url}`);
    process.exitCode = 1;
  }
}

async function check({ id, url }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (link-check; MapleSave)" },
    });
    return { id, url, status: res.status, ok: res.status < 400 };
  } catch (err) {
    return { id, url, status: err.name === "AbortError" ? "TIMEOUT" : "ERROR", ok: false };
  } finally {
    clearTimeout(timer);
  }
}

main();
