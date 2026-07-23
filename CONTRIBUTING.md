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

## The merge gate — tests + docs, or no merge

Every PR that changes behaviour must ship **in the same PR**:

1. **Tests** — a unit test (`apps/web/tests/unit/`, vitest) for pure logic, or
   integration checks (`apps/web/tests/integration/run.mjs`) for anything that
   crosses an HTTP boundary. Bug fixes add a regression test that fails
   without the fix.
2. **Docs** — the matching update to `docs/GUIDE.md` (user-facing features),
   `docs/DEPLOYMENT.md` (ops), or the package README (library API). A PR that
   only refactors internals may skip docs, never tests.

CI enforces the executable half of this gate — all three jobs are required
checks on `main`:

| Job | What it proves |
| --- | --- |
| `quality` | `tsc --noEmit`, ESLint (0 errors), vitest unit suite |
| `integration` | full HTTP suite against a production build (fs mode) |
| `docker` | image builds and the container answers end-to-end |

The docs half is reviewed by hand — the PR template asks you to link the
section you touched.

## Before you open a PR

```bash
cd apps/web
npx tsc --noEmit                     # must pass
npm run lint                         # must pass — 0 errors
npm test                             # unit suite
node tests/integration/run.mjs       # HTTP suite (add --prod to mirror CI)
```

⚠️ **Never run plain `npm install` to update `package-lock.json` on Windows** —
it silently drops nested subtrees and breaks `npm ci` on Linux. Regenerate the
lock only from a pristine directory (package.json alone →
`npm install --package-lock-only` → verify with `npm ci --ignore-scripts`).

## Monorepo layout

`packages/core` (storage adapters, content types, append-log, pure utils) and
`packages/ai` (provider-agnostic engine + features) are **source packages**:
`apps/web` consumes them via tsconfig path aliases (`@edgepress/core/*`,
`@edgepress/ai/*`) with `experimental.externalDir`, so there is no build step
and no lockfile coupling. App-side files in `src/lib/` that moved there remain
as re-export shims — import sites never change. Core is host-agnostic: it
reads platform bindings (KV, Workers AI) only through the injected source in
`src/lib/cf-env.ts` — never import a host SDK inside `packages/`.

## Commit style

Conventional-ish: `feat(scope): …`, `fix(scope): …`, `docs: …`, `chore: …`.
