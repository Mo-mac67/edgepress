# EdgePress

**The AI-native CMS that runs free on the edge.**

Block-based site builder + admin panel + CRM + automated SEO + a full AI suite
(content studio, translation, site builder, copilot, visitor assistant) — in one
self-hostable app. Default deployment: Cloudflare Workers free tier ($0/month).
Also runs on Docker, plain Node, or Vercel via storage adapters.

> ⛔ **PRIVATE** — do not publish, announce, or make this repository public.
> Launch happens only on the owner's explicit instruction (see RFC §11).

- Architecture & roadmap: [docs/RFC-001-architecture.md](docs/RFC-001-architecture.md)
- Product app: `apps/web` (Next.js — public site + admin + Content API)
- Status: building toward v1 (block CMS + CRM + SEO + full AI suite: content
  studio, translation, site builder, admin copilot, MCP server, visitor
  assistant). Private dev instance only.

## What's inside

- **Block CMS** — drag-and-drop page builder, Tiptap rich text, revisions,
  autosave, themes, media, blog, menus — plus a code editor for page HTML and
  site-wide Custom CSS.
- **Headless too** — Custom Content Types with typed fields + CSV, a public
  Content API, API keys, and HMAC-signed webhooks.
- **AI, provider-agnostic + BYOK** — free Cloudflare Workers AI by default, or
  your own Anthropic/OpenAI/Google/Ollama key. Pages, whole sites, articles
  (single or bulk), translation, image generation, audio transcription,
  semantic media search, lead scoring, a visitor assistant, SEO diagnosis,
  A/B titles, intent optimization — with per-feature routing + a call budget.
- **Any language + RTL** — configurable locales with fallback, whole-site
  translation, a brand glossary, and outdated-translation flags.
- **CRM + SEO + analytics** — lead inbox with AI replies; audits, instant
  indexing, freshness; anomaly alerts, a printable PDF report, and A/B
  headline testing with conversion tracking.
- **Forms builder** — submissions, spam-flagging, CSV export, embeds.
- **Auth & safety** — Owner/team roles, per-tab permissions, TOTP 2FA, audit
  log, one-file backup/restore.
- **MCP server** — manage the site from Claude or any MCP agent.

## Run it

**Docker (any server — no external services):**

```bash
cd apps/web
docker compose up -d      # http://localhost:3000
```

Data (CMS docs + uploaded media) persists in the `edgepress-data` volume via the
filesystem storage adapter.

**Cloudflare Workers (the $0 edge deploy):**

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Mo-mac67/edgepress)

One click provisions the Worker, KV and R2 and deploys. Or manually: create a KV
namespace + R2 bucket, set them in `apps/web/wrangler.jsonc`, then
`npm run cf:deploy`. Workers AI is included free — no API key needed.

On first load, EdgePress shows a **setup wizard** — name your site and choose an
admin password. No default password ships.

**Local dev:**

```bash
cd apps/web
npm ci
npm run dev   # http://localhost:3000 — fs storage in ./data, admin at /en/admin
```

License: MIT · © Synergion
