# EdgePress

**The AI-native CMS that runs free on the edge.**

Block-based site builder + admin panel + CRM + automated SEO + a full AI suite
(content studio, translation, site builder, copilot, visitor assistant) — in one
self-hostable app. Default deployment: Cloudflare Workers free tier ($0/month).
Also runs on Docker, plain Node, or Vercel via storage adapters.

```bash
npx create-edgepress my-site
```

- Architecture & roadmap: [docs/RFC-001-architecture.md](docs/RFC-001-architecture.md)
- CMS vs. theme, and the contract between them:
  [docs/architecture-cms-vs-theme.md](docs/architecture-cms-vs-theme.md)
- Product app: `apps/web` (Next.js — public site + admin + Content API)
- Status: **stable (2.0)** — the feature set is complete and covered by 166 unit
  tests plus a 112-check integration suite run against production builds in CI,
  with a Docker smoke test and an installer check that scaffolds a project and
  builds it. Storage keys, the Content API and the theme contract are settled;
  breaking changes get a major version and a migration note.

## What's inside

- **Block CMS** — drag-and-drop page builder, Tiptap rich text, revisions,
  autosave, media, blog, nested menus, built-in site search — plus a
  code editor for page HTML and site-wide Custom CSS. Scheduled publishing,
  shareable draft-preview links, duplicate, and trash/restore for pages and
  posts.
- **Themes are separate, and portable** — every colour, font and corner is a
  token the CMS owns, so one panel restyles the whole site (a fully dark site
  needs no CSS). Export a theme as a `.edgepress-theme.json` file and import it
  on the next project — design travels, content never does.
- **Headless too** — Custom Content Types with typed fields, relations
  (`?expand=1`) + CSV, a public Content API, API keys, and HMAC-signed
  webhooks.
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
- **Forms builder** — submissions, validation rules (regex/min/max),
  per-form email notifications, spam-flagging, CSV export, embeds.
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

```bash
npx create-edgepress my-site --cloudflare [--domain my-site.com]
```

One command provisions KV + R2 on your account, configures, and deploys —
Workers AI included free, no API key needed. Custom domains, multiple sites on
one account, quotas, migration and self-host storage:
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

On first load, EdgePress shows a **setup wizard** — name your site and choose an
admin password. No default password ships.

**Local dev:**

```bash
cd apps/web
npm ci
npm run dev   # http://localhost:3000 — fs storage in ./data, admin at /en/admin
```

License: MIT · © Synergion
