# Theme gallery

Every theme EdgePress ships, as a portable file. These are **generated** from
the gallery in `packages/core/src/types.ts` — don't edit them by hand; run
`node scripts/export-themes.mjs` and commit the result (CI fails on drift).

## Use one

- **In the admin:** Appearance → Theme gallery → click a theme → *Save & apply*.
- **From a file:** Appearance → *Import theme* → pick any `.json` here. Same
  format you get from *Export theme*, so a design you build yourself travels
  the same way.

A theme is design only — palette, typography, corners, header style. It carries
**no content and no business information**, so applying one never touches your
pages, and sharing one never leaks your data.

## What's in the box

| Theme | For |
|---|---|
| Slate & Indigo | Clean developer-product default |
| Stone & Mint | Warm, calm, editorial |
| Mint & Ink | Crisp and understated |
| Graphite & Gold | Restrained luxury |
| Navy & Gold | Trust and heritage — law, finance |
| Forest & Copper | Natural and grounded |
| Charcoal & Red | Loud and confident |
| Slate & Sky | Friendly and open — SaaS |
| Midnight & Mint | Fully dark, mint accent |
| Espresso & Cream | Soft and appetising |
| Paper & Ink | Long-form reading — blogs, essays |
| Studio Noir | Dark portfolio; let the work glow |
| Clinic Blue | Calm and clinical — health, services |
| Terracotta | Warm hospitality — food, travel |

Every one is checked in CI for WCAG AA contrast on body text, headings and the
primary button — see `apps/web/tests/unit/theme-css.test.ts`.
