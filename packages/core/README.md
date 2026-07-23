# @edgepress/core

Host-agnostic core of EdgePress:

- **Storage adapters** — one `readJsonDoc`/`writeJsonDoc`/`listJsonDocs`
  surface over Cloudflare KV, plain filesystem (`EDGEPRESS_STORAGE=fs`),
  SQLite (`sqlite`, via `node:sqlite`) and Postgres (`postgres`, optional
  `pg` peer). SQLite/Postgres load dynamically so bundles stay clean.
- **Platform injection** (`platform.ts`) — core never imports a host SDK.
  The app registers a bindings source once (`setPlatformEnvSource`); on
  Workers that's OpenNext's `getCloudflareContext().env`, elsewhere nothing.
- **Append-log** — race-safe per-item writes with bounded lazy compaction
  (concurrent submissions can never lose one).
- **Content model** (`types.ts`) — Page/Post/Block schema, `isLive()`
  read-time scheduled publishing, locale helpers (`i18n.ts`).
- **Pure utilities** — CSV parse/serialize, RFC-6238 TOTP, S3 SigV4 signing
  (dependency-free), spam heuristics.

## Consumption

Currently a **source package**: `apps/web` maps `@edgepress/core/*` to
`packages/core/src/*` via tsconfig paths (with Next's
`experimental.externalDir`), and the unit suite imports it the same way —
no build step, no lockfile coupling. `exports` in package.json already
points at the sources, so publishing later only needs a `tsc` build step
swapped in.

## Rules

- Nothing here may import `server-only`, `next/*`, or a host SDK.
- New modules ship with unit tests (`apps/web/tests/unit/`) — see the merge
  gate in [CONTRIBUTING.md](../../CONTRIBUTING.md).
