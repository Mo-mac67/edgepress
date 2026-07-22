# EdgePress

**The AI-native CMS that runs free on the edge.**

A block-based site builder + admin panel + CRM + automated SEO + a full AI suite,
in one self-hostable app. WordPress bolted AI on with plugins; EdgePress is
AI-native from day one — and it runs for **$0/month** on Cloudflare's edge, or on
any Node server or Docker host.

This is the EdgePress app. You own the deployment — it is **not** tied to any
hosted service or account. Bring it up on your own site and server in minutes.

## Quick start (local)

```bash
npm install
npm run dev        # http://localhost:3000
```

On first load you'll see a **setup wizard** — name your site and choose your
admin password. That account is the **Owner** (full access). No default password
ships; you create your own.

With zero configuration it runs in **filesystem mode** — content and uploads are
stored as JSON + files under `data/`. No database, no cloud account needed.

## Deploy it (pick one)

### 1. Self-host on any server (Node or Docker) — no external services

```bash
docker compose up -d          # http://localhost:3000
```

Content and media persist in the `edgepress-data` volume via the filesystem
storage adapter (`EDGEPRESS_STORAGE=fs`). Or run the plain Node build:

```bash
npm run build && npm start
```

### 2. Cloudflare Workers — the free edge deploy

```bash
cp wrangler.jsonc.example wrangler.jsonc
npx wrangler kv namespace create edgepress_kv   # paste the id into wrangler.jsonc
npx wrangler r2 bucket create edgepress-media
cp .env.production.example .env.production        # set SITE_URL to your URL
npm run cf:deploy
```

Documents live in Cloudflare **KV**, media in **R2**, and AI runs on **Workers
AI** — all on the free tier. `wrangler.jsonc` points at *your* account; the repo
only ships the `.example` template, so nothing here is wired to anyone else.

### Scaffold a fresh project

```bash
npx create-edgepress my-site
```

## What's inside

- **Block CMS** — page builder, Tiptap rich text, revisions, autosave, themes,
  media library, blog, menus — plus a **code editor** for page HTML and
  site-wide **Custom CSS** (the "Edit HTML" experience).
- **Custom Content Types** — model anything (products, team, events…) with typed
  fields + CSV import/export, served through a headless **Content API**
  (`/api/content/<type>`).
- **Forms builder** — design forms, collect submissions (auto spam-flagging),
  export CSV, embed anywhere with a copy-paste snippet.
- **AI, provider-agnostic + BYOK** — free Cloudflare Workers AI by default, or
  your own Anthropic/OpenAI/Google/Ollama key, with per-feature routing and a
  call budget. Generate pages, whole sites, and full articles (single or bulk
  from CSV); rewrite; translate; score leads; answer visitors; **generate
  images**; **transcribe audio** (Whisper); A/B title ideas; internal-link
  suggestions; search-intent optimizer; SEO diagnosis.
- **Any language + RTL** — configurable locales with default-language fallback,
  one-click whole-site translation, a brand glossary, outdated-translation
  flags, and automatic right-to-left rendering (Arabic, Persian, Hebrew…).
- **CRM + SEO + analytics** — lead inbox with AI replies and follow-ups;
  audits, sitemaps, instant indexing, structured data, content-freshness;
  natural-language analytics, anomaly alerts, a printable **PDF report**, and
  built-in **A/B headline testing** with conversion tracking.
- **Semantic media search** — find media by meaning, no external vector DB.
- **Auth** — Owner + team roles with per-tab permissions, optional TOTP 2FA,
  and a full audit log.
- **API keys + Webhooks** — HMAC-signed delivery on content/lead/form events.
- **Backup/restore** — one-click export/import of the whole site as JSON.
- **MCP server** — manage the site from Claude or any MCP agent.

## Storage adapters

Everything reads/writes through one adapter, so the same code runs anywhere:

| Mode | Set | Documents | Media |
| --- | --- | --- | --- |
| Filesystem (default self-host) | `EDGEPRESS_STORAGE=fs` | `data/*.json` | `data/` files |
| SQLite (self-host) | `EDGEPRESS_STORAGE=sqlite` | `data/edgepress.sqlite` | `data/` files |
| PostgreSQL (self-host) | `EDGEPRESS_STORAGE=postgres` | Postgres | (media adapter of choice) |
| Cloudflare | `EDGEPRESS_STORAGE=kv` | KV | R2 |

- **SQLite** uses Node's built-in `node:sqlite` (Node 22.5+) — no native dependency.
- **Postgres** needs `npm install pg` + `DATABASE_URL` (optional peer dependency; never bundled into the Worker).
- **Media** defaults to the filesystem (self-host) or R2 (Cloudflare). Set `EDGEPRESS_MEDIA=s3` with `S3_ENDPOINT` / `S3_BUCKET` / `S3_REGION` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` to use any S3-compatible store (AWS S3, MinIO, Backblaze…).

## Configuration

Copy `.env.example` to `.env.local` and set what you need — everything is
optional and no-ops when unset (email, SMS, CRM webhook, maps, BYOK AI keys).
Set a long random `ADMIN_SECRET` in production (it salts the session/password
hashes).

## License

MIT.
