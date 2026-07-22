# EdgePress — Pre-public-launch checklist

The repo is **private** until the owner explicitly says to go public (RFC §11).
Before flipping to public, complete this list.

## Security (blocking)

- [x] **Untrack the owner's personal deploy config** — `wrangler.jsonc` and
      `.env.production` are git-ignored; the repo ships only the `*.example`
      templates.
- [x] **Scrub secrets and personal identifiers from git history**
      (`git filter-repo`: removed the personal deploy config from all history
      and redacted legacy identifiers/credentials inherited from the seed
      codebase). Verified with `git log -S` sweeps afterwards.
- [x] Confirm **no default admin password** ships (setup wizard enforces this).
      `SUPERADMIN_PASSWORD` is env-only.
- [x] Set a strong `ADMIN_SECRET` env in every deployment (session hash salt).
      Done on the demo instance; documented in SECURITY.md for self-hosters.
- [x] Rate-limit `/api/admin/login` and `/api/setup` (both per-IP limited).
- [x] All `/api/admin/*` routes `isAuthed`/owner-guarded (login/logout are the
      deliberate exceptions); `/api/mcp` token-guarded; public write endpoints
      (`/api/leads`, `/api/forms/*`, `/api/assistant`, `/api/track`, `/api/ab`,
      `/api/setup`) rate-limited.
- [x] Media serving hardened against path traversal (fs/sqlite modes validate
      the object key; R2/S3 keys are opaque).
- [x] Dependency audit (`npm audit`) — the high (brace-expansion DoS) is fixed.
      Remaining: 4 **moderate** in the Next.js → postcss chain (build-time
      only; the sole "fix" is a breaking Next v9 downgrade — declined). Clears
      when Next ships a patched postcss; Dependabot is configured to track it.
- [x] CSP/headers reviewed (`frame-ancestors 'self'` via next.config headers).

Note: the in-memory rate limiter is per-isolate on Workers (an attacker hitting
many colos gets a higher effective ceiling). Acceptable for launch; a KV/DO
limiter is a good follow-up for high-profile deployments.

## Product

- [x] Local dev fresh-install smoke (fs + sqlite modes, many E2E rounds).
- [x] `cf:deploy` fresh-install smoke (the demo instance).
- [ ] Docker fresh-install smoke (Docker not available on the dev machine —
      Dockerfile/compose written; needs one run before announcing Docker
      support loudly).
- [x] Setup wizard → create → publish → edit → translate → restore revision.
- [x] AI works with the free Workers AI default (BYOK paths implemented; give
      one Anthropic/OpenAI key a smoke test at launch).
- [ ] MCP server: protocol verified end-to-end via JSON-RPC; connect once from
      a real MCP client (Claude) before announcing.
- [x] Visitor assistant answers from seeded content.
- [x] i18n: adding another locale works end to end (incl. RTL + fallback).

## Ops

- [x] Backup/restore from the panel (Settings → Backup, works on KV and fs).
      Document a cron'd `GET`-based backup for self-hosters as a follow-up.
- [ ] Error monitoring guidance (Workers logs / Sentry) — add a docs section.
- [x] `create-edgepress` CLI scaffolds a clean, generic project (verified: no
      personal identifiers leak into scaffolds).

## Docs & community

- [x] README quick-starts (fs/sqlite/postgres/S3 storage matrix, Cloudflare
      deploy, setup wizard).
- [x] docs/GUIDE.md + docs/RFC-001 present.
- [x] LICENSE (MIT) + SECURITY.md + CONTRIBUTING.md.
- [x] Live demo instance reachable (owner's own account), still first-run safe.

## Launch day (the only remaining steps)

- [ ] Owner gives the explicit go-public instruction.
- [ ] Remove the "PRIVATE" banner from README.
- [ ] `gh repo edit --visibility public`.
- [ ] Publish `create-edgepress` to npm (`npm publish` in
      packages/create-edgepress; verify the tarball URL points at the public
      repo).
- [ ] Enable GitHub security features on the public repo (Dependabot alerts,
      private vulnerability reporting).
