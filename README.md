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
  autosave, themes, media, blog, menus, multi-locale.
- **AI, provider-agnostic + BYOK** — free Cloudflare Workers AI by default, or
  your own Anthropic/OpenAI/Google/Ollama key. Generate pages, translate,
  rewrite, build a whole site, score leads, answer visitors.
- **MCP server** — manage the site from Claude or any MCP agent.
- **CRM + SEO** — lead inbox with AI replies; automated audits, sitemaps,
  instant indexing, structured data.

## Run it

**Docker (any server — no external services):**

```bash
cd apps/web
docker compose up -d      # http://localhost:3000
```

Data (CMS docs + uploaded media) persists in the `edgepress-data` volume via the
filesystem storage adapter.

**Cloudflare Workers (the $0 edge deploy):**

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/YOUR_ORG/edgepress)

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
