# EdgePress — User Guide

Everything you can do with EdgePress, from first run to advanced features.
(For installing and deploying, see the [README](../apps/web/README.md).)

---

## 1. First run

On the first visit to `/admin` (e.g. `/en/admin`), EdgePress shows a **setup
wizard**: name your site and choose a password. No default password ships —
the credential you create is yours alone.

Whoever sets that password becomes the **Owner**.

## 2. Accounts & roles

| Role | Who | Access |
| --- | --- | --- |
| **Owner** | The setup-wizard password holder | Everything: all tabs, team, audit log, Developer tab, backup, 2FA |
| **Team** | Users the Owner creates in **Security → Admin users** | Only the tabs the Owner allows (**Tab permissions**) |

- **Two-factor auth (2FA)** — Owner only. Enable in **Security → Two-factor
  authentication**: add the secret to any authenticator app, confirm a 6-digit
  code. Login then asks for a code after the password.
- `SUPERADMIN_PASSWORD` (env var, optional) — a platform-level master password
  for people managing many sites. If unset, it simply doesn't exist.
- Every sensitive action is recorded in the **Audit log** (Owner only).

## 3. The panel

The left sidebar groups everything:

- **Insights** — Dashboard, Copilot, Leads, Marketplace, Activity, Audit log
- **Content** — Pages, Menus, Blog, Collections, Forms, Media
- **Growth** — SEO, AI
- **Design & setup** — Appearance, Site info, Developer, Security, Help

## 4. Pages

Create from the **Pages** tab:

- **New page** — start blank. **Generate with AI** — describe it, get a full
  draft. **Import URL** — AI rebuilds any web page as editable blocks.
  **Import whole site** — enter a site's URL and EdgePress reads its
  `sitemap.xml` and rebuilds *every* page as a draft (batched + resumable;
  localized sitemaps are deduped). **Import screenshot** — rebuild from an
  image of a page. **Import HTML** — drop a `.html` file.

In the editor:

- **Blocks mode** (default): drag to reorder, edit fields per language, 18+
  block types (hero, cards, FAQ, gallery, contact form, custom HTML…).
- **Custom HTML mode**: switch *Page type* to **Custom HTML** and edit the
  page's full source in a **code editor** (line numbers, tab support) — the
  Blogger/WordPress "Edit HTML" experience. Switching a **block page** to HTML
  auto-converts its blocks to clean semantic HTML (the blocks are kept — switch
  back anytime). Full documents render isolated (own CSS/JS); *Standalone page*
  hides the site header/footer.
- **Autosave** + dirty tracking; **History** restores any earlier version.
- **Scheduled publishing**: on a draft, set *Publish automatically at* — the
  page goes live by itself once that time passes (no cron; evaluated at
  read time, so it works on the edge too). A **SCHEDULED** badge shows in
  the list.
- **Preview link**: share a signed URL that shows the draft to anyone —
  no login needed. The link stops working the moment the page is published.
- **Duplicate** any page as a new draft (`-copy` slug).
- **Trash**: deleting moves a page to the Trash (chip above the list) —
  restore it anytime, or *Delete forever*. Blog posts work the same way.
- **Translate** fills another language with AI (source text untouched).
- **A/B headline test**: in *Page settings*, enter 2+ headlines (one per
  line). Each visitor sees one at random; views and lead conversions are
  tracked per variant and the **winner** appears in the Report.
- Per-page **SEO**: share image, keywords, noindex.

Legal pages (**/privacy**, **/terms**) are seeded as editable system pages —
review and adapt the default copy to your business.

**Menus**: manage the site navigation under **Content → Menus** — bilingual
labels, page slugs or external URLs, reorder with arrows. **+ Add sub-link**
nests links one level under a parent (rendered as an indented group in the
site menu).

**Site search** is built in: every site serves `/en/search` (and each other
locale) — a search box over all live pages and posts, ranked by title >
description > body matches. The JSON endpoint is `GET /api/search?q=…&lang=…`
(rate-limited; drafts, scheduled-future and trashed content never appear).

## 5. Blog

- **New post** — write in the rich-text editor, per language. A **Visual/HTML**
  toggle above the body switches to a code editor for editing the post's exact
  HTML (Blogger-style source view).
- **Write with AI** — give a topic; AI drafts the full article (title,
  excerpt, body, keywords) as a draft post.
- **Bulk from CSV** — upload a CSV/text file of topics (one per line); AI
  drafts up to 3 articles per run (run again for more).

## 6. Collections (custom content types)

Model anything — products, team members, events, testimonials:

1. **Collections → New type**: name it and define typed fields (text,
   rich text, number, boolean, date, image, select, **relation**). Owner only.
2. Add entries (draft/published) in the schema-generated editor.
3. **Import CSV / Export CSV** — columns match field names; a `status`
   column is honored.

**Relations** link collections together (a *Book* points at an *Author*):
pick "relation" as the field type and choose the target collection; the
entry editor then offers a dropdown of that collection's entries. On the
Content API, add `?expand=1` to embed the full related entry in place of
its slug (published targets only — drafts never leak).

Every collection is automatically served by the **Content API** (see §12) —
EdgePress doubles as a headless CMS.

## 7. Forms

Build forms (contact, signup, survey…) in the **Forms** tab:

- Typed fields (text, email, tel, textarea, number, select, checkbox),
  custom submit label and success message.
- **Validation rules** per field: a regex *pattern*, min/max **value** for
  numbers, min/max **length** for text. Enforced on the server and mirrored
  as native HTML attributes in the embed snippet; email fields are
  format-checked automatically.
- **Per-form notifications**: set *Email new submissions to* and every
  (non-spam) submission is emailed there via Resend — leave blank to use
  the site-wide `LEAD_NOTIFY_TO`. Without an API key it logs instead of
  sending, so nothing breaks key-free.
- Submissions land in the panel — **spam is flagged automatically**
  (heuristic, never blocks) — and export to **CSV**.
- **Embed code**: copy a self-contained HTML snippet that posts to your
  form endpoint from anywhere — including external sites.
- Public endpoint: `POST /api/forms/<slug>` (rate-limited, honeypot).
- A `form.submitted` webhook fires on every submission (§12).

## 8. Media

- Drag & drop **images, videos, and audio** (8 / 90 / 25 MB).
- **Generate with AI** — describe an image; it's created (free, on-edge)
  and added to the library with the prompt as alt text.
- **AI alt text** — one click per image (vision model).
- **Transcribe** — audio (and video soundtrack-only files) to text with
  Whisper; the transcript is stored as the caption.
- **Semantic search** — search by meaning ("bright kitchen"), not just
  filename. Click **Build search index** once to embed existing media;
  new AI-captioned items are indexed automatically.
- **Background removal & 2× upscale** (BYOK, optional) — paste a
  [Replicate](https://replicate.com) API key under **AI → Your API keys**
  and every image gets **BG** / **2×** buttons; results are saved as new
  images. These two have no free on-edge model, so they're the only
  pay-per-use tools — everything else stays free.

## 9. Languages

- **Site info → Languages**: comma-separated locale codes (e.g.
  `en, fr, es, fa`). Every listed language gets its own URL (`/es/…`),
  the language switcher, and sitemap entries.
- Untranslated content **falls back to the default language** — adding a
  language never breaks pages.
- **RTL**: Arabic, Persian, Hebrew, Urdu… render right-to-left
  automatically. (The admin panel stays LTR.)
- **Whole-site translation** (AI tab): fill a language across every page
  in one click — additive, nothing overwritten.
- **Translation glossary** (AI tab): brand terms to keep consistent or
  untranslated, applied to every translation.
- **Outdated-translation flags**: if the source text changes after a
  translation, that language's tab shows an amber dot in the editor —
  re-translate to refresh.

## 10. Appearance

- **Presets** or fine-grained control: 12 colors, font pairs, corner
  radius, light/dark header — applied live, no redeploy.
- **Custom CSS**: site-wide CSS in a code editor, loaded on every page
  after the theme (override anything).
- **Custom code**: raw HTML injected before `</body>` on every page —
  analytics snippets, chat widgets, third-party embeds (scripts run
  normally). Site-verification metas live under **SEO**.
- **Custom header & footer** (Site info, advanced): raw HTML that fully
  replaces the built-in header/footer — total control of the site chrome.
  Leave empty to keep the standard nav + language switcher.

## 11. AI

Works **free out of the box** on Cloudflare Workers AI — no API key. Or
bring your own key (Anthropic / OpenAI / Google / local Ollama) under
**AI → Your API keys**; route each feature to a different provider/model.

- **Brand voice** — describe your tone once; all AI output matches it.
- **AI call budget** — a hard cap on total AI calls (0 = unlimited);
  guards against runaway usage.
- AI content always lands as a **draft** — nothing publishes itself.
- Usage table shows calls/tokens per feature.

**AI tools** (same tab):
- **A/B title ideas** — 6 headline variants for any topic.
- **Internal link suggestions** — paste content, get anchors linking to
  your existing pages.
- **Search-intent optimizer** — paste content + the intent it should
  satisfy; get gaps and concrete fixes.
- **Whole-site translation** — see §9.

**Visitor assistant** — a chat bubble on the live site answering from
your own published pages (RAG), multilingual. Toggle it in the AI tab.

**Manage from chat (MCP)** — enable the built-in MCP server, copy the
URL + token into Claude (or any MCP client), and manage the site by
chatting: list/create/translate/publish pages, read leads.

## 12. Developer (Owner only)

- **Content API** — every collection as JSON, CORS-enabled:
  - `GET /api/content/<type>` — published entries
  - `GET /api/content/<type>/<slug>` — one entry
  - `?expand=1` — embeds entries referenced by **relation** fields
    (published targets only).
  - `?status=all` with an **API key** (`Authorization: Bearer <key>`)
    includes drafts.
- **API keys** — created once, shown once, stored hashed; revoke anytime.
- **Webhooks** — register a URL + events (`entry.created/updated/deleted/
  published`, `lead.created`, `form.submitted`). Deliveries are signed
  (`x-edgepress-signature`, HMAC-SHA256 of the raw body) with a per-hook
  secret; a **Test** button sends a sample event.

## 13. SEO

- **Page health audit** — every published page scored with pass/fail
  checks per language.
- **AI meta** — one-click title + description.
- **Diagnose** — AI explains *why a page may not rank* and how to fix
  it (issue → action).
- **Content freshness** — pages not updated in 120+ days, with one-click
  edit links.
- **Keyword ideas** and content gaps for any topic.
- Automatic **sitemap** (all languages), **IndexNow** ping on publish,
  structured data (Organization/LocalBusiness), GA4/GTM/Meta Pixel tags.

## 14. Analytics & reports

- **Dashboard** — sessions, pageviews, leads, conversion; leads by
  city/type/status/day; top pages; funnel.
- **Ask about your data** — natural-language questions ("which page got
  the most leads?").
- **Anomaly alerts** — a "Heads up" banner when leads or traffic drop
  sharply week-over-week.
- **Report (PDF)** — a printable report (KPIs, breakdowns, recent leads,
  A/B test results with the winner) — print or save as PDF from the
  browser.
- **Weekly digest** — `GET /api/cron/digest?key=CRON_SECRET` emails a
  7-day summary to `LEAD_NOTIFY_TO`; wire it to any scheduler. A
  follow-up job (`/api/cron/followups`) nudges stale leads.

## 15. Leads / CRM

Every form/quote submission lands in **Leads**: status workflow, notes,
CSV export, **AI lead score** (0–100 + hot flag), **AI reply drafts** in
your brand voice, spam filtering, and notifications (email / Telegram /
SMS / WhatsApp / CRM webhook — set the env vars listed in Settings).

## 16. Backup & restore (Owner only)

**Security → Backup**: download every document (pages, posts,
collections, forms, leads, settings…) as one JSON file; restore it here
or on another EdgePress instance — works across storage backends (KV,
fs, SQLite, Postgres). Media binaries aren't included — copy those
separately if you migrate hosts.

## 17. Upgrading

Run `npx create-edgepress upgrade` inside your project, then reinstall and
redeploy. Your content, deploy config (`wrangler.jsonc`, `.env*`), data and
extra dependencies are preserved; core code is refreshed. The admin sidebar
shows your current version. Details: [DEPLOYMENT.md](DEPLOYMENT.md) §9.

## 18. Storage & hosting

The same app runs on:

| Where | Documents | Media |
| --- | --- | --- |
| Cloudflare Workers (free tier) | KV | R2 |
| Any Node server / Docker | JSON files, SQLite, or Postgres | files or any S3-compatible store |

Switch with `EDGEPRESS_STORAGE` / `EDGEPRESS_MEDIA`. Backup/restore moves
content between any of them.

📖 Full deployment walkthroughs — one-command Cloudflare wizard, custom
domains, several sites on one account, quotas, migration, self-host storage and
troubleshooting — live in [DEPLOYMENT.md](DEPLOYMENT.md).
