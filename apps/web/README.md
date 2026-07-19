# MapleSave Energy (temporary brand)

Bilingual (EN/FR) lead generator for Canadian energy incentives — federal and
provincial **loans, grants and rebates** — for both residential and commercial
properties. Built with Next.js 16 (App Router), React 19 and Tailwind v4.

## Run locally

```bash
npm install
npm run dev        # http://localhost:3000  (redirects to /en or /fr)
npm run build      # production build + typecheck
```

Copy `.env.example` to `.env.local` and fill in values as needed. The app runs
fully with **no keys** (mock address data, console email, admin password `admin`).

## What's included (Phase 1 MVP)

- **Home / Residential / Commercial / Programs** pages, fully bilingual (EN/FR)
  via `src/i18n` dictionaries and `/[lang]` routing (locale auto-redirect in
  `src/proxy.ts`).
- **Eligibility quiz** (`/[lang]/eligibility`): sector → upgrades → address
  autocomplete → building confirmation → contact details → personalized results
  with matched programs and an equipment cost estimate.
- **Lead capture**: stored via `src/lib/leads-store.ts` (JSON file under
  `data/leads.json`) + email notification (`src/lib/email.ts`).
- **Admin panel** (`/[lang]/admin`, password from `ADMIN_PASSWORD`): leads
  dashboard with metrics, search, status workflow, notes, and CSV export.
- **Incentive dataset** (`src/lib/programs-data.ts`): seed programs for all
  provinces/territories + federal, loan-focused. Equipment pricing in
  `src/lib/equipment-data.ts`.

## Connectors (swap mock → real with one file each)

- `src/lib/maps.ts` — address autocomplete + building view. Returns mock data
  until `GOOGLE_MAPS_API_KEY` is set, then uses Google (Street View photo now,
  3D Tiles / satellite ready to layer in). Falls back to the styled
  `SoftBuilding` illustration when no key.
- `src/lib/email.ts` — logs to console until `RESEND_API_KEY` + `LEAD_NOTIFY_TO`
  are set.
- `src/lib/leads-store.ts` — JSON file now; swap to Postgres/Supabase later
  without touching the rest of the app.

## Phase 2 (not yet built)

- Automated dataset refresh job (fetch official sources + AI extraction) with an
  admin review/approve step before publishing.
- Real Google Maps integration (3D building + satellite fallback) once billing
  is enabled.
- CRM integration (HubSpot / GoHighLevel) via the lead webhook.
- Blog / SEO content, soft-3D marketing illustrations.

## Notes

- Brand name, logo and colors are temporary (palette: Evergreen `#0E7C5A`,
  Aqua `#1FB6A6`, Solar amber `#F5A623`, Mint `#EAF6EF`, Deep ink `#10241D`).
- Program details are **seed data and must be verified**. The app shows a
  disclaimer; it is not financial advice and not a government service.
