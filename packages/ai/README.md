# @edgepress/ai

Provider-agnostic AI layer of EdgePress:

- **Engine** (`engine.ts`) — `aiComplete(feature, req)` with per-feature
  provider routing, BYOK key handling, call-budget enforcement, usage
  metering and a TTL response cache. Providers: Cloudflare Workers AI
  (free default, via the injected platform env — no SDK import), Anthropic,
  OpenAI, Google, Ollama.
- **Features** (`features.ts`) — page/site generation to Block[], rewrite/
  tone, batch + whole-page translation, keyword ideas, and the rest of the
  content feature set. All output lands as drafts.
- **Image ops** (`image-ops.ts`) — BYOK Replicate background-removal/upscale;
  kept out of the barrel so engine-only consumers don't pull its tables.
- **Types** (`types.ts`) — client-safe provider/feature/config types for the
  admin UI.

## Consumption

Source package, same mechanism as [@edgepress/core](../core/README.md):
`@edgepress/ai/*` → `packages/ai/src/*` via tsconfig paths. Depends only on
`@edgepress/core` (storage + platform injection).

## Rules

- No `server-only`, no `next/*`, no host SDK imports — Workers AI arrives
  through `getPlatformEnv()`.
- Every new feature routes through `aiComplete` so budget/metering apply,
  and ships with tests + docs per the merge gate.
