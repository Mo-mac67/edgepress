# Changelog

All notable changes to EdgePress are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com); versions follow semver.

Get notified: **Watch → Custom → Releases** on the GitHub repo, and the admin
panel itself shows a banner when a newer release exists (checked daily).
Upgrade with `npx create-edgepress upgrade` (scaffolded sites) or `git pull`
(clones) — your content lives in your storage and is never touched by code
updates.

## [1.4.0] — 2026-07-26

### Added
- **Username sign-in** — the login screen now takes an optional username. Team
  members sign in with their name + password; the owner can set a login
  username (Settings → “Sign-in & admin URL”). Backward-compatible: the owner
  can always sign in with just the password, so no one is ever locked out.
- **Changeable admin URL** — move the admin off the guessable default `/admin`
  to any path (Settings, owner only). The default is then disabled; recovery
  escape hatch is the `ADMIN_PATH` env var. Reserved routes are rejected.

### Note
- Multi-user with per-tab permissions, a super-admin/owner role, and optional
  TOTP 2FA already shipped in 1.0 (Settings → team + 2FA); sessions expire
  after 8 hours.

## [1.3.0] — 2026-07-26

### Added
- **Edit links & buttons in place** — the inline "Edit on page" editor now edits
  link and button text, and a floating bar lets you change a link/button
  **destination** (href) — for both block and Custom-HTML pages, design untouched.

## [1.2.0] — 2026-07-26

### Added
- **Inline visual editing (“Edit on page”)** — toggle *Edit on page* in the
  editor and edit text directly on the live preview. For block pages, click any
  heading, paragraph, card, step, FAQ or CTA text and type. For **Custom-HTML
  pages it edits text in place while preserving the exact design** — only text
  nodes change; the CSS, layout and markup are saved back untouched, and the
  other language in a bilingual page is left alone. Only a signed-in admin gets
  edit affordances — never a visitor.
- **Per-language Custom HTML** — a `mode:"html"` page can now hold different
  HTML per language (checkbox “Different HTML per language” in the editor;
  switch languages with the tabs above). Rendering falls back to the shared
  HTML for any locale you leave blank, so existing pages are unchanged.
- **Dashboard traffic charts** — a “Page views over time” timeline + “Top
  pages”, so analytics show life even on a site with visitors but no leads yet;
  every chart now has a friendly empty state instead of a blank card.
- **Find & Replace in the code editor** — Ctrl+F / Ctrl+H, visible match
  highlighting, and Replace / Replace-all to change a word everywhere at once.

### Changed
- **AI Site Builder** now gets stronger design + copy direction (section
  rhythm, business-specific copy, cohesive palette/typography), so generated
  drafts read less generic.
- `create-edgepress --cloudflare` **auto-bakes `SITE_URL`** after the first
  deploy (writes the live workers.dev URL into `wrangler.jsonc` + `.env.production`
  and redeploys once) — sitemaps/OG/canonical URLs are correct with no manual step.

### Fixed
- `npm run cf:deploy` / `cf:preview` now **wipe `.next` + `.open-next` first**
  (new `npm run clean`), so a stale incremental cache can never repackage and
  ship older code.
- Removed a stray NUL byte embedded in `packages/ai/src/features.ts` — the
  translation-signature separator is now a Unicode escape instead of a raw
  null character. Runtime behaviour is identical (signatures are unchanged),
  but the file is clean UTF-8 and greppable again.

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
