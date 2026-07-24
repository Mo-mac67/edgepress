# Changelog

All notable changes to EdgePress are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com); versions follow semver.

Get notified: **Watch → Custom → Releases** on the GitHub repo, and the admin
panel itself shows a banner when a newer release exists (checked daily).
Upgrade with `npx create-edgepress upgrade` (scaffolded sites) or `git pull`
(clones) — your content lives in your storage and is never touched by code
updates.

## [1.1.0] — 2026-07-24

### Added
- **Plugins (RFC-002)** — declarative, edge-safe plugins: a JSON manifest
  bundles reusable snippets + settings + an optional **AI-agent skill** that
  the MCP server teaches any connected agent. Install/uninstall in
  Developer → Plugins. No third-party code runs on your site.

### Fixed (found by installing from scratch on a real domain)
- `create-edgepress` produced an unbuildable project after the core/ai
  package split — the scaffold now bundles `packages/{core,ai}` and rewrites
  the aliases, so `next build` passes.
- The `--cloudflare` wizard could create a local-only KV namespace →
  deploy failed 10041. Now idempotent (reuse by name) + `--remote`.
- A fresh install 500'd on every page when `SITE_URL` was still a template
  placeholder — the layout now guards `metadataBase` and never crashes.
- Clearer "activate Workers AI / add a key" guidance across all AI features.

### Changed
- Professional graphite **admin theme** with crisp focus/hover/disabled
  states, always-visible keyboard focus, and quiet data tables.
- "Blank HTML page" quick action in Pages for fully bespoke pages.

## [1.0.0] — 2026-07-23

First public release. 🎉

### Content & publishing
- Block-based page builder (20+ block types, drag & drop, per-language
  fields) with revisions, autosave, and a full **Edit HTML** mode per page
- Scheduled publishing (read-time, no cron), Trash/Restore, Duplicate, and
  signed draft **preview links** — for pages and posts
- Blog with categories/tags, moderated **comments**, Visual/HTML source view
- **Collections** (custom content types) with typed fields, **relations**
  (`?expand=1`), CSV import/export, and a public Content API + API keys
- Built-in **site search**, nested menus, redirect manager (wildcards),
  reusable **snippets** (`[snippet name]`), N-locale content with RTL
- **Courses** (LMS-lite) at `/learn`, optional community **forum**,
  appointment **booking** with deterministic double-booking protection

### Forms, marketing & commerce
- Form builder: validation rules, multi-step, conditional fields, file
  uploads, per-form email notifications, spam heuristics, CSV, embeds
- **Newsletter**: subscriber list + batched campaigns with signed
  one-click unsubscribe
- **Stripe payment block** via hosted Checkout (card data never touches
  the site) with signed webhooks and an orders list
- Lead CRM with AI replies, analytics with anomaly alerts, A/B headline
  testing, printable report

### AI (provider-agnostic + BYOK)
- Free Cloudflare Workers AI by default; bring your own Anthropic / OpenAI /
  Google / Ollama key with per-feature routing and a call budget
- Generate pages and whole sites, import any site/URL/screenshot/HTML file
  as editable content, whole-site translation, article writer (single +
  bulk), transcription, image generation, semantic media search, SEO
  diagnosis, visitor assistant, **MCP server**

### Platform
- Runs free on Cloudflare Workers (KV + R2); self-hosts on Docker or Node
  with filesystem / SQLite / Postgres storage and S3-compatible media
- Owner/team roles with per-tab permissions, TOTP 2FA, optional Google SSO,
  audit log, one-file backup/restore, hardened rate limits
- Professional graphite **admin theme**, WCAG AA contrast, a11y semantics
- 120 unit tests + 111-check integration suite run against production
  builds in CI (typecheck + lint + unit, integration, Docker smoke)
