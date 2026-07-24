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
  log(`  ${c.cyan}npx create-edgepress <project-name>${c.reset}`);
  log(`  ${c.cyan}npx create-edgepress upgrade${c.reset}   ${c.dim}(inside an existing project — pulls the latest code, keeps your config + content)${c.reset}\n`);
  log(`Options:`);
  log(`  --template <dir>   Copy from a local EdgePress checkout instead of downloading`);
  log(`  --cloudflare       Full deploy wizard: creates KV + R2, writes the config, deploys`);
  log(`  --domain <domain>  Custom domain for --cloudflare (must already be on your CF account)`);
  log(`  --no-deploy        With --cloudflare: create resources + config, skip install/deploy`);
  log(`  EDGEPRESS_REPO     Override the GitHub repo (default ${REPO})`);
}

/**
 * In-place upgrade: overlays the latest EdgePress code onto the current
 * project. SAFE BY DESIGN: content lives in KV/data (never in the code), and
 * the template never ships wrangler.jsonc / .env* — so your deploy config,
 * content and secrets are untouched. Your package name and any extra
 * dependencies you added are re-applied. Direct edits to core src files ARE
 * overwritten (keep customizations in Custom HTML/CSS, or manage via git).
 */
async function upgrade(args) {
  const dest = process.cwd();
  if (!existsSync(join(dest, "package.json")) || !existsSync(join(dest, "src", "lib", "storage.ts"))) {
    log(`${c.red}✖ Run this inside an EdgePress project (package.json + src/lib/storage.ts expected).${c.reset}`);
    process.exit(1);
  }
  const oldPkg = JSON.parse(await readFile(join(dest, "package.json"), "utf8"));
  log(`\n${c.bold}Upgrading EdgePress in ${c.cyan}${dest}${c.reset}`);
  log(`${c.dim}Preserved: wrangler.jsonc, .env*, data/, backups/, your package name + extra deps.${c.reset}`);

  const tIdx = args.indexOf("--template");
  if (tIdx !== -1 && args[tIdx + 1]) await copyLocalTemplate(resolve(args[tIdx + 1]), dest);
  else if (process.env.EDGEPRESS_TEMPLATE) await copyLocalTemplate(resolve(process.env.EDGEPRESS_TEMPLATE), dest);
  else await downloadTemplate(dest);

  // Re-apply the project identity + any dependencies the user added themselves.
  const pkgPath = join(dest, "package.json");
  const newPkg = JSON.parse(await readFile(pkgPath, "utf8"));
  const fromVersion = oldPkg.version;
  newPkg.name = oldPkg.name;
  for (const field of ["dependencies", "devDependencies"]) {
    for (const [dep, ver] of Object.entries(oldPkg[field] ?? {})) {
      newPkg[field] = newPkg[field] ?? {};
      if (!newPkg[field][dep]) newPkg[field][dep] = ver;
    }
  }
  await writeFile(pkgPath, JSON.stringify(newPkg, null, 2) + "\n");

  // Seed any NEW config templates that appeared in this version.
  for (const [example, real] of [["wrangler.jsonc.example", "wrangler.jsonc"], [".env.production.example", ".env.production"]]) {
    const src = join(dest, example);
    const dst = join(dest, real);
    if (existsSync(src) && !existsSync(dst)) await cp(src, dst);
  }

  log(`${c.green}✔ Upgraded${c.reset} ${c.dim}${fromVersion} → ${newPkg.version}${c.reset}\n`);
  log(`Finish with:`);
  log(`  ${c.cyan}npm install${c.reset}`);
  log(`  ${c.cyan}npm run cf:deploy${c.reset}   ${c.dim}(or docker compose up -d --build / npm run build && npm start)${c.reset}`);
  log(`${c.dim}Note: direct edits to core src files are overwritten by upgrades — keep customizations`);
  log(`in Custom HTML pages / Custom CSS / Custom code, or manage the project with git.${c.reset}\n`);
}

function sh(cmd, args, cwd) {
  // stdin closed + CI=1 so wrangler/npm never wait on an interactive prompt.
  const r = spawnSync(cmd, args, {
    cwd,
    shell: process.platform === "win32",
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, CI: "1", WRANGLER_SEND_METRICS: "false" },
  });
  return { ok: r.status === 0, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

/**
 * The --cloudflare deploy wizard: provisions a KV namespace + R2 bucket on the
 * user's own account (wrangler must be logged in, or CLOUDFLARE_API_TOKEN +
 * CLOUDFLARE_ACCOUNT_ID set), writes them into wrangler.jsonc, then installs
 * and deploys. Everything lands on the USER's account — nothing is shared.
 */
async function cloudflareWizard(destApp, name, { domain, noDeploy }) {
  const wr = (args) => sh("npx", ["--yes", "wrangler", ...args], destApp);

  log(`\n${c.bold}Cloudflare deploy wizard${c.reset}`);
  const who = wr(["whoami"]);
  if (!who.ok || /not authenticated|Please run.*login/i.test(who.out)) {
    log(`${c.red}✖ wrangler isn't authenticated.${c.reset}`);
    log(`  Run ${c.cyan}npx wrangler login${c.reset} (or set CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID) and re-run:`);
    log(`  ${c.cyan}cd ${name} && npx create-edgepress --cloudflare${c.reset}\n`);
    return false;
  }

  // 1) KV namespace — idempotent + REMOTE. Reuse an existing namespace with
  // this title (re-runs shouldn't spawn duplicates), else create it remotely.
  // `--remote` matters: recent wrangler can otherwise create a LOCAL-only
  // namespace whose id doesn't exist on your account → deploy fails 10041.
  const kvTitle = `${name.replace(/-/g, "_")}_kv`;
  let kvId;
  const listed = wr(["kv", "namespace", "list"]);
  if (listed.ok) {
    try {
      const arr = JSON.parse((listed.out.match(/\[[\s\S]*\]/) || ["[]"])[0]);
      kvId = arr.find((n) => n.title === kvTitle)?.id;
    } catch { /* fall through to create */ }
  }
  if (kvId) {
    log(`${c.green}✔ Reusing KV namespace ${kvId}${c.reset}`);
  } else {
    log(`${c.dim}Creating KV namespace ${kvTitle}…${c.reset}`);
    const kv = wr(["kv", "namespace", "create", kvTitle, "--remote"]);
    // Output formats vary by wrangler version: `id = "…"` (TOML) or `"id": "…"` (JSONC).
    kvId = kv.out.match(/"?id"?\s*[=:]\s*"?([0-9a-f]{32})"?/i)?.[1];
    if (!kvId) {
      log(`${c.red}✖ Couldn't create the KV namespace:${c.reset}\n${kv.out.slice(0, 400)}`);
      return false;
    }
    log(`${c.green}✔ KV namespace ${kvId}${c.reset}`);
  }

  // 2) R2 bucket
  const bucket = `${name}-media`;
  log(`${c.dim}Creating R2 bucket ${bucket}…${c.reset}`);
  const r2 = wr(["r2", "bucket", "create", bucket]);
  if (!r2.ok && !/already exists/i.test(r2.out)) {
    log(`${c.red}✖ Couldn't create the R2 bucket:${c.reset}\n${r2.out.slice(0, 400)}`);
    log(`${c.dim}(R2 needs to be enabled once in the Cloudflare dashboard → R2.)${c.reset}`);
    return false;
  }
  log(`${c.green}✔ R2 bucket ${bucket}${c.reset}`);

  // 3) Patch wrangler.jsonc + .env.production
  const wranglerPath = join(destApp, "wrangler.jsonc");
  let cfgText = await readFile(wranglerPath, "utf8");
  cfgText = cfgText
    .replace(/"name":\s*"[^"]*"/, `"name": "${name}"`)
    .replace(/"id":\s*"[^"]*"/, `"id": "${kvId}"`)
    .replace(/"bucket_name":\s*"[^"]*"/, `"bucket_name": "${bucket}"`);
  if (domain) {
    cfgText = cfgText
      .replace(/"SITE_URL":\s*"[^"]*"/, `"SITE_URL": "https://${domain}"`)
      .replace(/"workers_dev":\s*true,?/, `"workers_dev": false,\n  "routes": [{ "pattern": "${domain}", "custom_domain": true }],`);
  }
  await writeFile(wranglerPath, cfgText);
  if (domain) await writeFile(join(destApp, ".env.production"), `SITE_URL=https://${domain}\n`);
  log(`${c.green}✔ wrangler.jsonc configured${c.reset}${domain ? ` ${c.dim}(custom domain ${domain})${c.reset}` : ""}`);

  if (noDeploy) {
    log(`${c.dim}--no-deploy: resources + config are ready. Deploy with: npm install && npm run cf:deploy${c.reset}`);
    return true;
  }

  // 4) Install + deploy
  log(`${c.dim}Installing dependencies (a few minutes)…${c.reset}`);
  if (!sh("npm", ["install", "--no-audit", "--no-fund"], destApp).ok) {
    log(`${c.red}✖ npm install failed — run it manually, then npm run cf:deploy${c.reset}`);
    return false;
  }
  log(`${c.dim}Building + deploying…${c.reset}`);
  const dep = sh("npm", ["run", "cf:deploy"], destApp);
  if (!dep.ok) {
    log(`${c.red}✖ Deploy failed:${c.reset}\n${dep.out.slice(-600)}`);
    return false;
  }
  const liveUrl = dep.out.match(/https:\/\/[^\s]+\.workers\.dev/)?.[0];
  log(`\n${c.green}${c.bold}✔ Deployed!${c.reset} ${liveUrl ? c.cyan + liveUrl + c.reset : ""}`);
  if (!domain && liveUrl) {
    await writeFile(join(destApp, ".env.production"), `SITE_URL=${liveUrl}\n`);
    log(`${c.dim}SITE_URL saved (${liveUrl}) — run npm run cf:deploy once more so sitemaps/OG bake the final URL.${c.reset}`);
  }
  log(`\nNext:`);
  log(`  1. Open ${c.cyan}${domain ? `https://${domain}` : liveUrl || "your site"}/en/admin${c.reset} → the setup wizard creates your Owner account.`);
  if (domain) log(`  2. The custom domain is routed via wrangler — DNS/SSL provision automatically (domain must be on this Cloudflare account).`);
  else log(`  2. To attach a domain later: Cloudflare dashboard → Workers & Pages → ${name} → Settings → Domains & Routes.`);
  return true;
}

async function copyLocalTemplate(src, destApp) {
  const skip = (p) =>
    // Skip build output + runtime data…
    !/[\\/](node_modules|\.next|\.open-next|\.wrangler|data|backups)([\\/]|$)/.test(p) &&
    // …and never copy anyone's PERSONAL deploy config (keep the .example ones).
    !/[\\/](wrangler\.jsonc|\.env|\.env\.local|\.env\.production)$/.test(p);

  const hasMonorepo = existsSync(join(src, APP_SUBDIR));
  const appSrc = hasMonorepo ? join(src, APP_SUBDIR) : src;
  await cp(appSrc, destApp, { recursive: true, filter: skip });

  // The app consumes @edgepress/core + @edgepress/ai as SOURCE from
  // ../../packages (monorepo layout). A scaffold is flat, so bundle the
  // packages INSIDE the project at ./packages and repoint the aliases —
  // otherwise `next build` can't resolve @edgepress/* and the deploy fails.
  const packagesSrc = join(src, "packages");
  if (hasMonorepo && existsSync(packagesSrc)) {
    // Only the runtime packages the app aliases — not the scaffolder itself.
    for (const pkg of ["core", "ai"]) {
      const from = join(packagesSrc, pkg);
      if (existsSync(from)) await cp(from, join(destApp, "packages", pkg), { recursive: true, filter: skip });
    }
    for (const cfg of ["tsconfig.json", "next.config.ts", "vitest.config.ts"]) {
      const f = join(destApp, cfg);
      if (existsSync(f)) {
        const txt = await readFile(f, "utf8");
        await writeFile(f, txt.replaceAll("../../packages", "./packages"));
      }
    }
  }
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
  if (name === "upgrade") return upgrade(args);
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

  // Seed the deploy config from the shipped templates so the project is ready
  // to run/deploy. These hold only placeholders — the adopter fills in their
  // own Cloudflare KV id + site URL (or ignores them entirely in fs mode).
  for (const [example, real] of [["wrangler.jsonc.example", "wrangler.jsonc"], [".env.production.example", ".env.production"]]) {
    const src = join(destApp, example);
    const dst = join(destApp, real);
    if (existsSync(src) && !existsSync(dst)) await cp(src, dst);
  }

  log(`${c.green}✔ Scaffolded!${c.reset}`);

  // Optional: full Cloudflare provisioning + deploy.
  if (args.includes("--cloudflare")) {
    const dIdx = args.indexOf("--domain");
    const domain = dIdx !== -1 ? String(args[dIdx + 1] ?? "").replace(/^https?:\/\//, "").replace(/\/.*$/, "") : "";
    const ok = await cloudflareWizard(destApp, name.replace(/[^a-z0-9-]/gi, "-").toLowerCase(), {
      domain,
      noDeploy: args.includes("--no-deploy"),
    });
    if (ok) return;
    log(`${c.dim}The scaffold itself is fine — fix the issue above and re-run the deploy steps manually.${c.reset}\n`);
  }

  log(`\nNext steps:\n`);
  log(`  ${c.cyan}cd ${name}${c.reset}`);
  log(`  ${c.cyan}npm install${c.reset}`);
  log(`  ${c.cyan}npm run dev${c.reset}   ${c.dim}# http://localhost:3000 — the setup wizard runs on first visit to /admin${c.reset}\n`);
  log(`Deploy free to Cloudflare in one go: ${c.cyan}npx create-edgepress <name> --cloudflare [--domain your.com]${c.reset}`);
  log(`Or manually: ${c.cyan}npm run cf:deploy${c.reset} (after creating a KV namespace + R2 bucket).`);
  log(`Or run anywhere with Docker: ${c.cyan}docker compose up -d${c.reset}\n`);
}

main().catch((e) => {
  log(`${c.red}${e?.stack || e}${c.reset}`);
  process.exit(1);
});
