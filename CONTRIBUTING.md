# Contributing to EdgePress

Thanks for helping! A few ground rules keep the project healthy.

## Setup

```bash
cd apps/web
npm install
npm run dev        # http://localhost:3000 — setup wizard on first /admin visit
```

Zero config runs in filesystem mode (`data/`). No cloud account needed.

## Principles

- **Portable first.** Every feature must work through the storage adapter
  (fs / sqlite / postgres / KV) and never assume Cloudflare. Optional native
  deps (like `pg`) load via runtime dynamic imports so the Workers bundle stays
  clean.
- **AI is provider-agnostic.** New AI features go through `lib/ai/engine.ts`
  (`aiComplete`) so routing/budget/usage metering apply. Free Workers AI must
  remain the working default; BYOK is optional.
- **AI output lands as drafts.** Never auto-publish generated content.
- **No personal/account data in the repo.** Deploy config ships as
  `*.example` templates only.

## Before you open a PR

```bash
npx tsc --noEmit   # must pass
npm run lint       # must pass
npm run build      # must pass
```

Add a short test or verification note in the PR description — what you ran and
what proved the change works.

## Commit style

Conventional-ish: `feat(scope): …`, `fix(scope): …`, `docs: …`, `chore: …`.
