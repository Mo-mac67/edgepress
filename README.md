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
- Status: **Phase 1** — ported baseline, fs+KV adapters, private dev deploy

## Quick start (dev)

```bash
cd apps/web
npm ci
npm run dev   # http://localhost:3000 — fs storage in ./data, admin at /en/admin
```

License: MIT · © Synergion
