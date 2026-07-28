# Architecture: CMS vs. Theme (separation of concerns)

EdgePress follows the same content/presentation split every mature CMS uses
(WordPress themes, Ghost themes, Drupal, Astro layouts): **content is data, the
theme is presentation, and the two are managed independently.** This document
defines the standard role of each layer and the contract between them.

## The two roles

### 1. The CMS (content + engine)

The CMS owns everything that is **not** visual design:

- **Content** — pages, posts, media, menus, collections (custom types), forms,
  redirects, snippets. Content is *presentation-agnostic*: a page stores its
  headings, text, images and structure, never its colours or fonts.
- **Data & storage** — the KV/R2/SQL adapters, the append-logs, backups.
- **Admin & APIs** — the dashboard, auth (users/roles/2FA), the Content API,
  the MCP server, webhooks.

The CMS is the *engine*. Swapping the theme never touches it.

### 2. The Theme (presentation)

The theme owns **all** visual design and nothing else. It is expressed as a
single data object (`ThemeSettings`) plus optional author CSS — never hardcoded
into content:

| Token group | Fields |
|---|---|
| Brand      | `brand`, `brandDark`, `brandSoft` (dark-section backgrounds) |
| Accent     | `accent`, `accentDark`, `accentSoft`, `accentInk` (text ON accent) |
| **Surfaces** | `bg` (page canvas), `surface` (cards/panels/inputs) |
| Tints      | `sand`, `cream` (alternating section washes) |
| Text/lines | `heading`, `ink`, `inkSoft`, `line`, `lineDark` |
| Type       | `fontPair` |
| Shape      | `radius` |
| Header     | `headerStyle` |
| Escape hatch | `customCss` (site-wide), `customBodyHtml` (before `</body>`) |

The theme is a **portable, swappable unit**: export it to a
`*.edgepress-theme.json` file and import it onto another site (Appearance →
Export/Import theme). It contains design only — **zero content, zero business
info** — so sharing a theme never leaks a site's data.

## The contract between them

The single mechanism that connects the two layers is a set of **CSS custom
properties** on `:root`:

```
themeCss(theme)  →  :root:root { --color-brand; --color-accent;
                                 --color-bg; --color-surface; --color-ink;
                                 --font-display; --font-sans; --ui-radius; … }
```

- Served live at **`/theme.css`** (dynamic) and injected by the layout, so the
  Appearance panel drives the whole site with no rebuild.
- **All rendering consumes these variables, never literals.** Block components
  use `bg-surface` / `text-ink` / `bg-cream`, not `bg-white` / `#111`. The base
  stylesheet's `body`, `.card`, `.field` read `var(--color-bg)` /
  `var(--color-surface)`. That is why one theme change re-skins every page.
- **Custom-HTML pages** render in an isolated `<iframe srcDoc>` that can't see
  the parent stylesheet, so the renderer *injects* `themeCss(theme)` into each
  such document. A hand-built page references the CMS tokens
  (`--mint: var(--color-accent)`, `--bg: var(--color-bg)`), so even bespoke
  pages are theme-driven while keeping their exact markup.
- **The admin panel is not themeable.** `.admin-ui` re-declares the tokens to a
  fixed light workspace, so changing a *site* theme (even to full dark) never
  restyles the dashboard.

## What this buys you

- Change any colour/font/corner in **Appearance** → the whole public site
  updates; content is untouched.
- Build a fully **dark** site entirely from the CMS — `bg`/`surface`
  go dark, `ink` goes light — with no hand-edited stylesheet.
- **Reuse a design** across client sites: export the theme, import it, done.
- **Starter kits** (`create-edgepress --kit`, Settings → Developer) bundle a
  theme *and* seed content together for a fast project start — but the theme
  alone is independently portable.

## Migration status

| Concern | State |
|---|---|
| Colours, fonts, radius, header as tokens | ✅ done |
| Accent flows into Custom-HTML pages | ✅ 1.14.0 |
| **Surfaces (`bg`/`surface`) are tokens; blocks use `bg-surface`** | ✅ 1.15.0 |
| **Theme export/import as a portable file** | ✅ 1.15.0 |
| **Heading text split from `brand`; `accentInk` for text on accent** | ✅ 1.16.0 |
| **A dark theme is expressible from the panel alone (dark preset ships)** | ✅ 1.16.0 |
| Admin pinned independent of site theme | ✅ done |
| Shadow/elevation tokens (still literal `rgba(15,20,25,…)`) | ⏳ follow-up |
| Multiple installable theme *packages* (theme registry) | ⏳ roadmap |

The remaining items are refinements — the content/presentation boundary itself
is now clean and standard.
