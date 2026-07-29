/**
 * Deploy to Cloudflare Workers.
 *
 * Why this exists instead of `opennextjs-cloudflare deploy`: from wrangler
 * 4.114 on, wrangler notices an OpenNext project and hands the deploy back to
 * `opennextjs-cloudflare deploy`, which calls wrangler again — a loop that ends
 * in an empty error message. Setting OPEN_NEXT_DEPLOY=1 tells wrangler the
 * hand-off has already happened, and calling wrangler's bin directly avoids the
 * `npm exec` wrapper that exits 1 with no output on Windows shells.
 *
 *   node scripts/cf-deploy.mjs            # deploy
 *   node scripts/cf-deploy.mjs --preview  # local preview instead
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const appDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const preview = process.argv.includes("--preview");

const wrangler = join(appDir, "node_modules", "wrangler", "bin", "wrangler.js");
if (!existsSync(wrangler)) {
  console.error("wrangler not found — run `npm install` first.");
  process.exit(1);
}

const run = (cmd, args, extraEnv = {}) => {
  const res = spawnSync(cmd, args, {
    cwd: appDir,
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
  });
  if (res.error) {
    console.error(res.error.message);
    process.exit(1);
  }
  if (res.status !== 0) process.exit(res.status ?? 1);
};

// 1. Clean, so a stale incremental cache can't repackage older code.
run(process.execPath, [join(appDir, "scripts", "clean-build.mjs")]);

// 2. Build the worker. OpenNext runs the Next build itself (see
//    open-next.config.ts, which pins it to the webpack CLI directly).
run(process.execPath, [join(appDir, "node_modules", "@opennextjs", "cloudflare", "dist", "cli", "index.js"), "build"]);

// 3. Upload. OPEN_NEXT_DEPLOY stops wrangler recursing back into OpenNext.
run(process.execPath, [wrangler, preview ? "dev" : "deploy"], { OPEN_NEXT_DEPLOY: "1" });
