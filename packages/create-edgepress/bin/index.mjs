#!/usr/bin/env node
/**
 * create-edgepress — scaffold a new EdgePress site.
 *
 *   npx create-edgepress my-site
 *
 * Fetches the app template (from the EdgePress GitHub repo tarball, or from a
 * local checkout via EDGEPRESS_TEMPLATE) into ./my-site and prints next steps.
 */
import { mkdir, cp, rm, readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { spawnSync } from "node:child_process";

const REPO = process.env.EDGEPRESS_REPO || "Mo-mac67/edgepress";
const BRANCH = process.env.EDGEPRESS_BRANCH || "main";
const APP_SUBDIR = "apps/web";

const c = { reset: "\x1b[0m", bold: "\x1b[1m", green: "\x1b[32m", cyan: "\x1b[36m", dim: "\x1b[2m", red: "\x1b[31m" };
const log = (s = "") => process.stdout.write(s + "\n");

function usage() {
  log(`${c.bold}create-edgepress${c.reset} — scaffold a new EdgePress site\n`);
  log(`  ${c.cyan}npx create-edgepress <project-name>${c.reset}\n`);
  log(`Options:`);
  log(`  --template <dir>   Copy from a local EdgePress checkout instead of downloading`);
  log(`  EDGEPRESS_REPO     Override the GitHub repo (default ${REPO})`);
}

async function copyLocalTemplate(src, destApp) {
  const appSrc = existsSync(join(src, APP_SUBDIR)) ? join(src, APP_SUBDIR) : src;
  await cp(appSrc, destApp, {
    recursive: true,
    filter: (p) => !/[\\/](node_modules|\.next|\.open-next|\.wrangler|data)([\\/]|$)/.test(p),
  });
}

async function downloadTemplate(destApp) {
  const url = `https://codeload.github.com/${REPO}/tar.gz/refs/heads/${BRANCH}`;
  log(`${c.dim}Downloading template from ${REPO}#${BRANCH}…${c.reset}`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Could not download the template (${res.status}). If the repo is private, use --template <local checkout>.`);
  }
  const tgz = join(tmpdir(), `edgepress-${Date.now()}.tar.gz`);
  await pipeline(res.body, createWriteStream(tgz));
  const extractDir = join(tmpdir(), `edgepress-x-${Date.now()}`);
  await mkdir(extractDir, { recursive: true });
  const tar = spawnSync("tar", ["-xzf", tgz, "-C", extractDir, "--strip-components=1"], { stdio: "inherit" });
  if (tar.status !== 0) throw new Error("Failed to extract the template (is `tar` available?).");
  await copyLocalTemplate(extractDir, destApp);
  await rm(tgz, { force: true });
  await rm(extractDir, { recursive: true, force: true });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("-h") || args.includes("--help")) return usage();

  const name = args.find((a) => !a.startsWith("-"));
  if (!name) {
    usage();
    process.exit(1);
  }
  const dest = resolve(process.cwd(), name);
  if (existsSync(dest) && (await readdir(dest)).length > 0) {
    log(`${c.red}✖ ${name} already exists and is not empty.${c.reset}`);
    process.exit(1);
  }

  log(`\n${c.bold}Creating a new EdgePress site in ${c.cyan}${dest}${c.reset}\n`);
  const destApp = dest; // the app IS the project root
  await mkdir(destApp, { recursive: true });

  const tIdx = args.indexOf("--template");
  try {
    if (tIdx !== -1 && args[tIdx + 1]) {
      await copyLocalTemplate(resolve(args[tIdx + 1]), destApp);
    } else if (process.env.EDGEPRESS_TEMPLATE) {
      await copyLocalTemplate(resolve(process.env.EDGEPRESS_TEMPLATE), destApp);
    } else {
      await downloadTemplate(destApp);
    }
  } catch (e) {
    log(`${c.red}✖ ${e.message}${c.reset}`);
    process.exit(1);
  }

  // Set the package name to the project name.
  const pkgPath = join(destApp, "package.json");
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
    pkg.name = name.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
    await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  }

  log(`${c.green}✔ Done!${c.reset}\n`);
  log(`Next steps:\n`);
  log(`  ${c.cyan}cd ${name}${c.reset}`);
  log(`  ${c.cyan}npm install${c.reset}`);
  log(`  ${c.cyan}npm run dev${c.reset}   ${c.dim}# http://localhost:3000 — the setup wizard runs on first visit to /admin${c.reset}\n`);
  log(`Deploy free to Cloudflare: ${c.cyan}npm run cf:deploy${c.reset} (after creating a KV namespace + R2 bucket).`);
  log(`Or run anywhere with Docker: ${c.cyan}docker compose up -d${c.reset}\n`);
}

main().catch((e) => {
  log(`${c.red}${e?.stack || e}${c.reset}`);
  process.exit(1);
});
