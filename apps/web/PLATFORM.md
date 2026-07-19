# Platform coordination — READ THIS FIRST

This repo (`Mo-mac67/kingspro`) is the **Kingspro.ca** site AND currently the
home of the shared **Synergion CMS/CRM core** used across all client sites.

## What this is

Next.js 16 + Cloudflare Workers (KV `APP_KV` + R2 `MEDIA`), bilingual EN/FR,
on the **KINGSPRO Cloudflare account** (`kingsproca`, id
`e2fa9a6adaf69a6ca3015c24365d25b5`). Live at kingspro.kingsproca.workers.dev.

It is a full CMS/CRM: block-based pages, WordPress-like admin (Pages, Menus,
Blog, Media, Appearance/theme, SEO, Help, Leads/CRM), R2 media, template import.
See `src/lib/cms-*.ts`, `src/components/admin/*`, `src/components/blocks/*`,
`src/app/api/admin/*`.

## ⚠️ This repo is mirrored into the platform monorepo

A copy of this working tree also lives at **`E:/Synergion-Platform/apps/kingspro`**
(repo `Mo-mac67/synergion-platform`, private). That monorepo is where the CMS core
will eventually be extracted to `packages/core` and shared by every client site.

**Sync rule:** this standalone repo is the manual deploy source until CI secrets are
added to the monorepo. If you change code here, mirror it to
`E:/Synergion-Platform/apps/kingspro` (robocopy, excluding
`.git node_modules .next .open-next .wrangler data`) — and vice-versa. Don't diverge.

## Deploy

Manual: `npm run cf:build` then `npx opennextjs-cloudflare deploy` (needs Node ≥22;
a portable node lives in the session scratchpad, re-download from nodejs.org/dist if
wrangler says "requires Node 22"). Once monorepo CI secrets exist, push-to-deploy
takes over.

## Ops gotchas

- CMS seeds only apply when the KV doc is ABSENT. To roll out new seeds: prod
  `wrangler kv key delete cms-pages.json --namespace-id b17081e890f0436aada13f64cf67999b --remote`
  (+ nav/settings/theme keys), local `rm -rf .wrangler`.
- IndexNow key file must be `.txt` → `src/app/indexnow-key.txt/route.ts`.
- Client onboarding: add `ANTHROPIC_API_KEY` Worker secret (AI SEO meta), submit
  `/sitemap.xml` to Google Search Console, change the default admin password.

Full project history is in the session memory
(`.claude/projects/.../memory/kingspro-project.md`, `synergion-platform.md`).
