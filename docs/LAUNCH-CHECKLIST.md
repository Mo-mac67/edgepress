# EdgePress — Pre-public-launch checklist

The repo is **private** until the owner explicitly says to go public (RFC §11).
Before flipping to public, complete this list.

## Security (blocking)

- [ ] **Untrack the owner's personal deploy config** so the public repo ships
      only the templates: `git rm --cached apps/web/wrangler.jsonc apps/web/.env.production`
      (both are now git-ignored; local copies stay for the owner's own demo).
      The public repo keeps `wrangler.jsonc.example` + `.env.production.example`.
- [ ] **Rotate/remove any secrets AND personal identifiers in git history.** The
      repo was seeded from a client codebase; scrub with `git filter-repo` and
      verify no API keys, passwords, account IDs, the demo KV id
      (`58a978…`), or the demo domain (`edgepress.mh-bamzadeh.workers.dev`)
      remain in history.
- [ ] Confirm **no default admin password** ships (setup wizard enforces this).
      `SUPERADMIN_PASSWORD` must be env-only (done).
- [ ] Set a strong `ADMIN_SECRET` env in every deployment (session hash salt).
- [ ] Rate-limit `/api/admin/login` (add if not already) and `/api/setup`.
- [ ] Review all `/api/admin/*` routes are `isAuthed`-guarded; `/api/mcp`
      token-guarded; `/api/assistant` rate-limited.
- [x] Dependency audit (`npm audit`) — the high (brace-expansion DoS) is fixed
      via `npm audit fix`. Remaining: 4 **moderate** in the Next.js → postcss
      chain (`postcss <8.5.10` XSS in CSS *stringify*), only "fixable" by
      downgrading Next to v9 (`--force`) — declined. It's a **build-time** tool
      (EdgePress never runs untrusted CSS through postcss at runtime), so runtime
      risk is negligible; it clears when Next/OpenNext ship a patched postcss.
      Enable Dependabot to track it.
- [ ] CSP/headers reviewed (frame-ancestors 'self', HSTS, etc.).

## Product

- [ ] Fresh-install smoke on all three paths: Docker, `cf:deploy`, local dev.
- [ ] Setup wizard → create → publish → edit → translate → restore revision.
- [ ] AI works with the free Workers AI default and with a BYOK key.
- [ ] MCP server connects from a real MCP client.
- [ ] Visitor assistant answers from seeded content.
- [ ] i18n: adding a second locale works end to end.

## Ops

- [ ] Nightly KV/R2 backup (cron) for self-hosters — document or ship it.
- [ ] Error monitoring guidance (Workers logs / Sentry).
- [ ] `create-edgepress` CLI + "Deploy to Cloudflare" button point at the public
      repo URL.

## Docs & community

- [ ] README quick-starts verified.
- [ ] docs/GUIDE.md (user) + docs/RFC-001 (architecture) current.
- [ ] LICENSE (MIT) present; add SECURITY.md, CONTRIBUTING.md, CODE_OF_CONDUCT.
- [ ] Live demo instance reachable and reset-safe.

## Launch

- [ ] Owner gives explicit go-public instruction.
- [ ] `gh repo edit --visibility public` (only after the above).
- [ ] Publish `edgepress` + `create-edgepress` to npm.
