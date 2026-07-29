# Changelog

All notable changes to EdgePress are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com); versions follow semver.

Get notified: **Watch → Custom → Releases** on the GitHub repo, and the admin
panel itself shows a banner when a newer release exists (checked daily).
Upgrade with `npx create-edgepress upgrade` (scaffolded sites) or `git pull`
(clones) — your content lives in your storage and is never touched by code
updates.

## [2.2.0] — 2026-07-29

### Added
- **Agency console — "Your sites"** (owner only). If you build sites for
  clients, each one is its own install with its own admin panel, version number
  and inbox. This puts them in one table: versions and which need updating,
  published page/post counts, unread lead counts, and which sites aren't
  answering. See docs/agency-console.md.
  - Each site is reached with an **API key it issued itself** (Developer → API
    keys), so access is granted and revoked on the client's side and the console
    never holds a password. The key is stored on the console install and is
    **never returned to the browser** — there's a test that greps the whole
    serialised response for it.
  - **Counts only, never content.** A console needs to know a site is alive and
    whether it needs attention; it doesn't need its customers' contact details.
    Shipping them would turn one leaked key into a breach across every site.
  - Plain `http` is refused rather than warned about — an API key sent in the
    clear is a key given away. `localhost` is the exception, for development.
  - A site being down is *reported*, not thrown: revoked key, timeout,
    unreachable and "too old to have the endpoint" each say so distinctly. A
    console that crashes when a client site is offline is useless exactly when
    you need it.
  - "Check all" polls sequentially, because each check is an outbound request
    and hosts cap those per invocation — twenty at once would report false
    failures.
- New `GET /api/site-status` on every install: what this site will tell a
  console about itself, API-key authenticated.

### Fixed
- **`npm run cf:deploy` no longer loops on Windows.** From wrangler 4.114,
  wrangler spots an OpenNext project and hands the deploy back to
  `opennextjs-cloudflare deploy`, which calls wrangler again — ending in an
  empty error message that gives no clue what went wrong. `cf:deploy` and
  `cf:preview` now go through `scripts/cf-deploy.mjs`, which cleans, builds, and
  calls wrangler's bin directly with `OPEN_NEXT_DEPLOY=1` so the hand-off
  doesn't recurse. Also sidesteps the `npm exec` wrapper that exits 1 with no
  output on Windows shells.

## [2.1.1] — 2026-07-29

### Fixed
- **Two pages could share one address, and the second became unreachable.**
  `savePage`/`savePost` matched on id only, so anything that set a slug without
  checking — renaming a page in the editor, AI generation, the site and
  WordPress importers, templates, MCP — could produce a duplicate. `getPage`
  returns the first match, so the save reported success while the content was
  invisible. The store now guarantees a slug belongs to exactly one item,
  suffixing the way WordPress does (`pricing-2`) and returning the slug it
  actually used. Suffixing rather than refusing because fifteen callers treat
  saving as infallible; failing them would trade silent loss for silent errors.
  - Renaming a page to a taken address now reports `slugChanged` so the editor
    can say which URL it got instead of quietly showing the wrong one.
  - Trashed items no longer reserve their slug — deleting a page and recreating
    it with the same address works, and the create endpoint now agrees with the
    store instead of rejecting it.
  - Saving a page over itself never renames it; only a *different* item's slug
    counts as taken.

## [2.1.0] — 2026-07-29

### Added
- **Import a WordPress site** (Pages → From WordPress). Reads the `.xml` that
  WordPress's own Tools → Export produces — no plugin on the old site, no
  database access. Closes the gap 2.0.0 listed as its biggest: migrating was
  manual, so anyone with an existing site couldn't get in the door.
  - Pages arrive with their **original HTML intact**; a migration where the
    layout shifts isn't a migration. Convert to blocks later if you want.
  - Posts keep date, author, categories and tags. Drafts stay drafts — nothing
    goes live that wasn't live.
  - **301 redirects for every old URL**, so rankings and inbound links survive
    the move from `/2023/05/post` to `/blog/post`.
  - Media is re-hosted into your own storage in batches, with links rewritten as
    each batch lands — otherwise the new site would hotlink the old one forever.
    Batched because each file is an outbound request and hosts cap those per
    invocation; a big library would die halfway through a single-shot import.
  - **Slug clashes are surfaced, not silenced.** Every WordPress site has an
    `/about` and so does a fresh install, so the first run keeps what you have,
    lists the clashes, and asks whether to replace them. Re-running changes
    nothing the second time.
  - Menus, revisions and trashed items are skipped **with counts** — nothing
    vanishes unexplained.
  - The WXR parser is dependency-free (`packages/core/src/wxr.ts`): Workers has
    no DOMParser, and an XML library would cost every install bundle size for
    one code path. 25 tests cover CDATA bodies, entity-encoded titles, `?p=`
    permalinks, and the storage round-trip.

## [2.0.0] — 2026-07-28

**First stable release.** Nothing in your site changes when you upgrade from
1.x — this marks the end of the beta, not a rewrite.

### What "stable" commits to
- **Your data stays yours and stays put.** Storage document keys are fixed. An
  upgrade never migrates, rewrites or deletes content — code and content are
  separate. Backup/restore round-trips are exercised in CI on the filesystem
  adapter; KV, Postgres and SQLite go through the same storage interface, but
  only fs runs on every commit.
- **The Content API and webhook payloads are settled.** Additive changes only
  within 2.x.
- **The theme contract is settled** — `themeCss()` emits the documented
  `--color-*` / `--font-*` / `--ui-radius` tokens, and a theme exported today
  will import into any 2.x site.
- Anything breaking gets a major version and a written migration path.

### Highlights since 1.0
- **CMS and theme are properly separated** (1.14–1.17). Every colour, font and
  corner is a token the CMS owns, so one panel restyles the whole site — a
  fully dark site needs no CSS. Themes are portable files you can carry between
  projects, with 14 designed ones in the gallery.
- **Public sandbox mode** (1.18) — run a demo anyone can sign into and change,
  which puts itself back on its own.
- **Inline editing on the page**, draft mode, structural block editing, and
  Custom-HTML pages that stay pixel-exact while still being editable.
- **Security**: username sign-in, changeable admin URL, per-member 2FA,
  sign-out-everywhere, theme-colour validation, secret scanning + push
  protection on the repo.
- **Operations**: automated releases, scheduled backups to R2, site templates,
  a CI job that installs the product the way a new user does and builds it.

### Known gaps, stated plainly
- No WordPress importer yet — migrating an existing WP site is manual. It's the
  next thing being built.
- One open advisory (`brace-expansion`, build-time only): the patched release is
  ESM-only and would break CommonJS build tooling. Tracked, not shipped-around.
- R2 media isn't included in backups or sandbox resets — only the media index.

## [1.18.0] — 2026-07-27

### Added
- **Public sandbox mode** (`EDGEPRESS_SANDBOX=1`, off by default) — run an
  instance anyone can sign into and change, which puts itself back on a
  schedule. Capture a snapshot in Settings → Sandbox, and visitors get the real
  admin panel with no signup. See docs/sandbox.md.
  - Everything about *building a site* stays editable — that's the product.
    What's refused is reaching real people (email, outbound webhooks) and
    locking the next visitor out (password, username, admin URL, sign-out
    everywhere, 2FA, restoring a backup).
  - Email is contained by **withholding the API key**, which is the same path
    every sender already takes when no key is set: it logs what it would have
    sent and moves on. A sender added later inherits that automatically.
  - Resets run **at request time**, not on a cron. A Cloudflare trigger invokes
    a `scheduled` handler the OpenNext worker doesn't export, so a trigger would
    have silently never fired. This is the same approach scheduled publishing
    already uses, and it works identically on Workers, Docker and Node.
  - A reset restores the snapshot **and removes documents that aren't in it** —
    otherwise the leads, submissions and collections visitors create would
    survive every reset and pile up forever.
  - A reset with no snapshot **does nothing** — restoring "nothing" would mean
    deleting everything, so firing before setup is a no-op, not a wipe.
  - A non-dismissible banner tells visitors their edits are temporary.

## [1.17.0] — 2026-07-27

### Added
- **Theme gallery** — 14 designed themes, up from 10 palettes. Each card shows a
  miniature page rendered in that theme's own colours, font and corner radius,
  so you see what you'd actually get instead of four colour chips.
- **A theme is now the whole design.** Presets used to carry colours only, so
  picking one left your old typography and corners in place. They now bring
  `fontPair`, `radius` and `headerStyle` too — anything a theme doesn't specify
  keeps your current setting, and your Custom CSS is never touched.
- New themes: **Paper & Ink** (long-form reading), **Studio Noir** (dark
  portfolio), **Clinic Blue** (health/services) and **Terracotta** (hospitality).
- **`themes/` in the repo** — every theme as a portable `.edgepress-theme.json`,
  the exact format Import theme accepts. Generated from the gallery, with a CI
  check so the files can never drift from the code.

### Fixed
- **9 of the 14 themes had an unreadable primary button.** White-on-accent was
  hardcoded until `accentInk` existed, which hid it; measuring every theme
  surfaced it. Light accents (mint, gold, amber) now carry dark button text, and
  accents that should keep white text were nudged darker until they clear it.
  The default theme's indigo moved #6366f1 → #5b5bef for the same reason (4.47:1
  → 5.02:1). A test now holds every theme to WCAG AA on body text, headings and
  the primary button, so a new theme can't ship unreadable.

### Changed
- **create-edgepress publishes from CI** when its version changes, after a smoke
  test that scaffolds a project and builds it. Publishing was a manual step
  someone had to remember, which is why the registry sat weeks behind the repo.
  Needs an `NPM_TOKEN` repo secret.

## [1.16.2] — 2026-07-27

### Security
- **Dependency upgrades closing 13 of 14 advisories** — Next.js 16.2.9 → 16.2.11
  (9 of them), plus `postcss` → 8.5.23 and `sharp` → 0.35.3 pinned through
  `overrides` so no stale transitive copy survives.
- `@opennextjs/cloudflare` is unpinned from 1.20.1 → ^1.20.2; the exact pin only
  existed because 1.20.2 needs Next ≥ 16.2.11, which we now have.
- **Not fixed, deliberately:** a ReDoS advisory in `brace-expansion`. The patched
  release is ESM-only, so forcing it would break every CommonJS build tool that
  `require()`s it. It is a build-time dependency and never runs on your site;
  we'll take it when the toolchain moves.

## [1.16.1] — 2026-07-27

### Security
- **Theme colours are validated before they reach a stylesheet.** `themeCss`
  output is injected into a `<style>` inside a Custom-HTML page's iframe, so an
  unvalidated colour value could close that tag and inject markup. Values are
  now restricted to `#hex`, colour keywords, and `rgb()`/`hsl()`; anything else
  falls back to the default. This matters most for the new **Import theme**
  feature — a theme file from a stranger can no longer carry a payload.

### Fixed
- The bundled `followups` workflow pinged a **hardcoded site URL**, so every
  install would have called someone else's domain on a daily schedule. It now
  reads a `SITE_URL` repository variable and skips cleanly when it isn't set.
- Removed a leftover project name from the bundled editor launch config.
- Changing **Primary** in Appearance moves the heading colour with it again —
  unless you've deliberately set a different heading colour, in which case the
  two stay independent.

## [1.16.0] — 2026-07-27

### Added
- **Heading colour is its own theme token.** `brand` was doing two jobs at once
  — heading TEXT and dark-section BACKGROUND — which made a dark site
  impossible (dark headings on a dark canvas). Headings now read a separate
  `heading` token that defaults to `brand`, so existing sites look identical
  while a dark theme can finally have light headings.
- **`accentInk` — the text colour on accent surfaces.** Primary buttons were
  hardcoded white-on-accent, unreadable when the accent is light (mint, yellow).
  Now themeable, defaulting to white.
- **A dark preset: "Midnight & Mint".** One click gives a genuinely dark site —
  dark canvas and cards, light headings, mint accent with dark button text —
  entirely from the Appearance panel, no hand-written CSS. It's also proof the
  theme layer really owns presentation.

### Fixed
- The mobile sticky bar's "Call" button used dark brand text on the page
  background — invisible under a dark theme. It and three other
  white-on-accent spots now use the new tokens.

## [1.15.0] — 2026-07-27

### Changed
- **CMS and theme are now cleanly separated** (standard content/presentation
  split — see docs/architecture-cms-vs-theme.md). The theme owns *all* visual
  design; content stays presentation-agnostic.
  - **Surfaces are themeable** — new `bg` (page canvas) and `surface`
    (cards/panels/inputs) theme tokens. Every block and base style now reads
    `bg-surface` / `var(--color-bg)` instead of a hardcoded white, so a theme
    can drive the whole palette — including a fully **dark** site — from the
    Appearance panel with no hand-edited CSS. Defaults are white, so existing
    light sites are pixel-identical.
  - The **admin panel is pinned** to a fixed light workspace regardless of the
    site theme, so a dark site theme never restyles the dashboard.

### Added
- **Export / Import theme** (Appearance) — a theme is now a portable
  `*.edgepress-theme.json` file: colours, fonts, corners and custom CSS, with
  **no content and no business info**. Export it to reuse a design on another
  site, or import one someone shared. (Starter kits still bundle theme +
  seed content together; the theme alone is independently portable.)

## [1.14.0] — 2026-07-27

### Fixed
- **Theme is now separate from Custom-HTML content** — a full-document
  Custom-HTML page renders in an isolated iframe that couldn't see the site
  theme, so the Appearance panel (e.g. accent colour) had no effect on it. The
  renderer now injects the CMS theme variables (`:root{--color-*}`) into every
  Custom-HTML page, so its CSS can reference them (e.g. `--mint: var(--color-accent)`)
  and the CMS actually drives the design. Content and theme are no longer fused.

## [1.13.0] — 2026-07-27

### Added
- **Two-factor authentication for team members** — each team member can now turn
  on their own TOTP 2FA (Settings → Two-factor), and it's enforced at their
  login (previously owner-only). The owner sees a 2FA badge next to each member
  in Admin users and can **Reset 2FA** for anyone who loses their device.
  Backward-compatible; the owner's own sign-in is unaffected.

## [1.12.0] — 2026-07-27

### Added
- **Scheduled backups** — the backup endpoint can now be called headlessly with
  a token (`EDGEPRESS_BACKUP_TOKEN`), and `?archive=1` writes a full JSON backup
  off-site to your R2 bucket (`backups/…json`). Point any scheduler (GitHub
  Actions, cron-job.org, a Cloudflare cron worker) at it for daily off-site
  backups — see docs/scheduled-backups.md. Restore stays one-click in Settings.

## [1.11.0] — 2026-07-27

### Added
- **Site templates (starter kits)** — export a site's design + structure (theme,
  menus, pages, brand settings) as one JSON, then apply it to a new site to spin
  up a client project fast (Settings → Developer). Business-specific contact
  info, leads and users are never included, and applying a template never
  overwrites the target site's contact info.

## [1.10.0] — 2026-07-27

### Added
- **Structural editing on the page** — for block pages, hovering a block in
  "Edit on page" shows a toolbar to **move it up/down, add a block below, or
  delete it** — right on the live preview. Changes respect draft mode (Publish
  to go live). (Block pages only; Custom-HTML pages keep their hand markup.)

## [1.9.0] — 2026-07-27

### Added
- **Edit images in place** — in "Edit on page", click any image and the floating
  bar lets you set a new image URL (paste one from the Media library). Works on
  Custom-HTML pages, design preserved; the change is saved into the page HTML.

## [1.8.0] — 2026-07-27

### Added
- **Draft mode for on-page editing** — while "Edit on page" is active, inline
  text/link edits are held as an unpublished DRAFT (autosave is suspended). A
  bar shows "draft (not published)" with **Publish changes** and **Discard** so
  you review before anything goes live.

## [1.7.0] — 2026-07-27

### Added
- **Client-ready mode** — one toggle (Settings, owner only) makes the admin open
  in the clean Simple workspace by default for everyone, so a site you hand to a
  client is uncluttered out of the box (each person can still switch to Pro).
- **Sign out everywhere** — an owner action that ends every active session at
  once (bumps a session epoch that invalidates all cookies). For a lost device
  or a departing team member. Backward-compatible; nobody is locked out (password
  sign-in still works).

## [1.6.0] — 2026-07-26

### Added
- **Automated releases** — a GitHub Action publishes a GitHub Release (with the
  matching CHANGELOG section as notes) on every `v*` tag push. This is what
  powers the in-admin "update available" banner across all installs — no manual
  release step per version.

### Changed
- **Analytics events are sharded** across 4 keys per week instead of one weekly
  doc. Pageviews are high-volume and a single read-modify-write doc raced and
  throttled under load; sharding cuts write contention and lost-updates ~4x
  while keeping dashboard reads inside the Workers free-tier subrequest budget.
  Backward-compatible — existing history (legacy + single-doc weeks) is still read.

## [1.5.0] — 2026-07-26

### Added
- **Simple / Pro workspace toggle** — a switch in the admin top bar. *Simple*
  shows only the everyday essentials (Dashboard, Pages, Blog, Media, Menus,
  Leads, Appearance, Security, Help) and gets the advanced sections out of the
  way; *Pro* shows everything. The choice is remembered per browser.

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
