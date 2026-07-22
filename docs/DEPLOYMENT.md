# EdgePress — Deployment Guide

Everything about running EdgePress: locally, on Cloudflare's free tier, on your
own domain, several sites on one account, Docker/Node self-hosting, storage
options, migration, and troubleshooting.

---

## 1. The options at a glance

| Where | Cost | Documents | Media | Best for |
| --- | --- | --- | --- | --- |
| **Cloudflare Workers** | $0 (free tier) | KV | R2 | The default — global edge, free AI included |
| **Docker** | your server | JSON files / SQLite / Postgres | files / S3 | Self-hosting, one container |
| **Plain Node** | your server | JSON files / SQLite / Postgres | files / S3 | VPS, Vercel-style hosts |

The same codebase runs everywhere — a storage adapter is the only difference
(§6). Content moves between any of them with Backup/Restore (§8).

---

## 2. Cloudflare — the one-command way

```bash
npx create-edgepress my-site --cloudflare
# with a domain that's already on your Cloudflare account:
npx create-edgepress my-site --cloudflare --domain my-site.com
```

The wizard, on **your** Cloudflare account:

1. checks wrangler auth (run `npx wrangler login` once, or set
   `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`),
2. creates a **KV namespace** (`my_site_kv`) and an **R2 bucket**
   (`my-site-media`) — R2 must be enabled once in the dashboard,
3. writes them into `wrangler.jsonc` (with the custom-domain route if
   `--domain` was given),
4. installs dependencies, builds, and deploys,
5. prints your live URL — open `/en/admin` and the setup wizard creates your
   **Owner** account (no default password ships).

Flags: `--no-deploy` stops after step 3 (resources + config only);
`--template <dir>` scaffolds from a local checkout.

## 3. Cloudflare — the manual way

```bash
npx create-edgepress my-site && cd my-site        # or clone the repo's apps/web
cp wrangler.jsonc.example wrangler.jsonc          # set "name" to a unique worker name
npx wrangler kv namespace create my_site_kv       # paste the printed id into wrangler.jsonc
npx wrangler r2 bucket create my-site-media       # set bucket_name in wrangler.jsonc
cp .env.production.example .env.production        # SITE_URL=https://your-final-url
npm install
npm run cf:deploy
```

To update later: pull/edit code, then `npm run cf:deploy` again. Content lives
in KV/R2, not in the deploy — redeploys never touch it.

## 4. Your own domain

The domain must be on the same Cloudflare account (any of your zones).

**Dashboard (simplest):** Workers & Pages → *your worker* → Settings →
**Domains & Routes** → *Add Custom Domain* → enter `my-site.com`. DNS and SSL
provision automatically.

**Or in `wrangler.jsonc`:**

```jsonc
"workers_dev": false,
"routes": [{ "pattern": "my-site.com", "custom_domain": true }],
"vars": { "SITE_URL": "https://my-site.com", ... }
```

then `npm run cf:deploy`. Keep `SITE_URL` in **`.env.production`** in sync too —
it's baked at build time into sitemaps, canonical URLs and OG tags.

**Rollback / detaching:** removing the custom domain from one worker and adding
it to another takes seconds and is fully reversible — this is also the
migration switch (§7).

## 5. Several sites on one account

Each site is fully isolated: **its own worker + KV namespace + R2 bucket + Owner
password + backups**. Repeat §2 (or §3) per site with unique names:

```bash
npx create-edgepress shop-cms  --cloudflare --domain shop.com
npx create-edgepress blog-cms  --cloudflare --domain blog.net
```

Never point two sites at the same KV namespace or bucket.

**Free-tier quotas are shared account-wide** (all workers together):

| Resource | Free per day |
| --- | --- |
| Worker requests | 100,000 |
| KV reads / writes | 100,000 / 1,000 |
| Workers AI | ~10,000 "neurons" (varies by model) |
| R2 storage | 10 GB total |

Several low-traffic sites fit comfortably. If one grows, the $5/mo Workers Paid
plan raises the whole account's limits.

## 6. Self-hosting (Docker / Node) & storage adapters

**Docker:**

```bash
docker compose up -d      # http://localhost:3000 — data persists in a volume
```

**Plain Node** (VPS, or Vercel-style hosts):

```bash
npm install && npm run build && npm start
```

Pick storage with env vars:

| Env | Values | Default |
| --- | --- | --- |
| `EDGEPRESS_STORAGE` | `fs` · `sqlite` · `postgres` · `kv` | `fs` (self-host), `kv` (Workers) |
| `EDGEPRESS_MEDIA` | `fs` · `s3` · (R2 on Workers) | `fs` / R2 |
| `DATA_DIR` | path for fs/sqlite data | `./data` |
| `DATABASE_URL` | postgres connection string | — |
| `PG_POOL_MAX` / `PG_IDLE_TIMEOUT_MS` | postgres pool tuning | `3` / `1000` |
| `S3_ENDPOINT` `S3_BUCKET` `S3_REGION` `S3_ACCESS_KEY_ID` `S3_SECRET_ACCESS_KEY` | any S3-compatible store (AWS, MinIO, Backblaze, R2's S3 API) | — |

Notes:
- **SQLite** uses Node's built-in `node:sqlite` (Node 22.5+) — nothing to compile.
- **Postgres** needs `npm install pg`. No Postgres handy? Test with
  `node scripts/pg-test-server.mjs` — a real wire-protocol server backed by
  PGlite (WASM) on `127.0.0.1:5433`.
- In postgres mode a DB failure **fails loudly** (no silent filesystem
  fallback), so data can never split across backends.
- Always set a long random `ADMIN_SECRET` in production — it salts session and
  password hashes. See `.env.example` for every optional integration
  (email/SMS/Telegram notifications, cron secrets, reCAPTCHA, BYOK AI keys…).

## 7. Migrating an existing site onto EdgePress

Follow the safe path (details in [ADOPTING-FOR-A-SITE.md](ADOPTING-FOR-A-SITE.md)):

1. Stand EdgePress up on its **workers.dev staging URL** (§2) — don't touch the
   live domain yet.
2. In the panel: **Pages → Import whole site** — enter the old site's URL;
   EdgePress reads its `sitemap.xml` and rebuilds **every page** as an editable
   draft (batched, resumable, localized sitemaps deduped). Odd pages can be
   redone individually with *Import URL* or *Import screenshot*.
3. Match the look in **Appearance** (or a preset + Custom CSS), review each
   draft, publish on staging.
4. Compare staging vs live side by side.
5. **Switch**: move the custom domain from the old worker to the EdgePress
   worker (§4). Keep the old worker — pointing the domain back is the instant
   rollback. One site at a time.

## 8. Backups & moving hosts

**Security → Backup** exports every document (pages, posts, collections, forms,
leads, settings…) as one JSON file; restore it on any other EdgePress instance —
including one on a *different* storage backend (KV → Postgres, fs → KV…).
Media binaries (R2/S3/files) are not inside the JSON — copy those separately.

## 9. Upgrading EdgePress

```bash
cd my-site
npx create-edgepress upgrade    # then: npm install && npm run cf:deploy
```

- **Your content is never touched** — it lives in KV/SQLite/Postgres/files, not
  in the code, and redeploys don't write to it.
- **Preserved automatically:** `wrangler.jsonc`, every `.env*`, `data/`,
  `backups/`, your package name, and any dependencies you added yourself.
- **Overwritten:** core `src/` code. Keep customizations in Custom HTML pages,
  Custom CSS, and Custom code (which all live in your content store) — or run
  the project as a git clone and `git pull` instead.
- The admin sidebar shows your current version (`EdgePress vX.Y.Z`).
- Take a backup (Security → Backup) before upgrading — good practice, though
  upgrades don't touch content.

## 10. Troubleshooting

| Symptom | Fix |
| --- | --- |
| `wrangler isn't authenticated` | `npx wrangler login`, or set `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` |
| R2 bucket creation fails | Enable R2 once: dashboard → R2 → Purchase (free tier) |
| Deploy succeeds but old content shows | KV propagation is ~60s; hard-refresh |
| `Wrangler requires Node.js v22+` | Use Node 22+ for deploys (`node -v`) |
| Sitemap/OG show the wrong domain | Update `SITE_URL` in `.env.production` **and** `wrangler.jsonc`, redeploy |
| Postgres mode errors instead of falling back | Intentional (§6) — fix `DATABASE_URL`; data never silently splits |
| `Import whole site` finds nothing | The old site needs a reachable `/sitemap.xml`; import pages one-by-one with *Import URL* otherwise |
