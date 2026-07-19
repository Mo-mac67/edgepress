# EdgePress — User Guide

Everything you can do from the admin panel at `/admin` (or `/en/admin`).

## First run

On the first visit to `/admin`, EdgePress shows a **setup wizard**: name your
site and choose an admin password. No password ships by default. After setup you
land in the panel.

## The panel

The left sidebar groups everything:

**Insights** — Dashboard (traffic + leads, plus an "ask about your data" AI
box), Copilot (chat that proposes actions), Leads (CRM inbox), Activity, Audit
log (super only).

**Content** — Pages, Menus, Blog, Media.

**Growth** — SEO, AI.

**Design & setup** — Appearance, Site info, Security, Help.

## Pages

- **New page** — start blank. **Generate with AI** — describe a page and get a
  full draft. **Import URL** — rebuild any web page as editable blocks. **Import
  HTML** — drop a `.html` file.
- Open a page to edit it: drag blocks to reorder, edit fields, add blocks, and
  watch the live preview. Changes **autosave**; **History** restores any earlier
  version. **Translate** fills another language with AI.
- 18+ block types: hero, header, text (rich editor), cards, stats, steps,
  gallery, before/after, testimonials, FAQ, CTA, contact form, image, video,
  social embed, custom HTML, spacer.

## Design (Appearance)

Recolor and restyle the whole site from one screen — 12 colors, font pairs,
corner radius, light/dark header — or apply a preset. Save applies site-wide.

## AI

EdgePress works with a **free** on-edge model (Cloudflare Workers AI) out of the
box, or your own Anthropic / OpenAI / Google key (paste it under **AI**). Set a
**brand voice** so everything sounds like you. AI content is always created as a
**draft** — nothing is published without you.

- **Content**: generate pages, rewrite/expand/shorten text, translate.
- **Site builder**: describe your business in the Copilot and get a themed,
  multi-page draft site.
- **CRM**: score a lead and draft a reply in your brand voice.
- **Visitor assistant**: a chat bubble on your live site that answers from your
  own pages (toggle it on under **AI**).
- **SEO**: page audits, AI titles/descriptions, keyword ideas.
- **Media**: one-click AI alt-text for images.

## Manage from chat (MCP)

Under **AI → Manage from chat**, enable the MCP server and copy the URL + token
into Claude (or any MCP client). You can then create pages, translate, publish
and read leads by chatting with your site.

## SEO

Automatic sitemap, instant indexing (IndexNow) on publish, structured data, and
tracking tags (GA4 / GTM / Meta Pixel) — just paste your IDs. The **Page health**
list scores every page and shows what to fix.

## Leads / CRM

Every form submission lands in **Leads** with status, notes, AI score and
one-click reply drafts. Export to CSV anytime.

## Security

Change your password, and (super-admin) manage which tabs each admin user can
see. Set `SUPERADMIN_PASSWORD` in the environment to enable a super account.
