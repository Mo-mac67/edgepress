# EdgePress — Pre-public-launch checklist

The repo is **private** until the owner explicitly says to go public (RFC §11).
Before flipping to public, complete this list.

## Security (blocking)

- [ ] **Rotate/remove any secrets in git history.** The repo was seeded from a
      client codebase; scrub with `git filter-repo` and verify no API keys,
      passwords, or account IDs remain in history.
- [ ] Confirm **no default admin password** ships (setup wizard enforces this).
      `SUPERADMIN_PASSWORD` must be env-only (done).
- [ ] Set a strong `ADMIN_SECRET` env in every deployment (session hash salt).
- [ ] Rate-limit `/api/admin/login` (add if not already) and `/api/setup`.
- [ ] Review all `/api/admin/*` routes are `isAuthed`-guarded; `/api/mcp`
      token-guarded; `/api/assistant` rate-limited.
- [ ] Dependency audit (`npm audit`) — fix highs; enable Dependabot.
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
