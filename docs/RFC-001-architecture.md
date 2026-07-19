# RFC-001 — EdgePress Architecture

**Status:** Accepted · **License:** MIT · **Shape:** Hybrid (standalone-first + Content API)
**Positioning:** *The AI-native CMS that runs free on the edge.* WordPress bolted AI on with plugins; EdgePress is AI-native from day one — and its default deployment costs $0 (Cloudflare Workers free tier), while still running anywhere (Docker/Node/Vercel).

---

## 1. Product shape

Hybrid, standalone-first:

- **Standalone:** installing EdgePress gives you a real website immediately — themes, block
  builder, blog, forms, admin panel. The WordPress 5-minute experience.
- **Headless:** every piece of content is also served by a **Content API** (REST, token-auth),
  so any external frontend can consume EdgePress as a pure content backend.
- One deployable app provides: public site renderer + admin panel + APIs.

## 2. Repository layout (npm workspaces)

```
edgepress/
├── apps/web/                # the product: Next.js app = site + admin + API
├── packages/core/           # (phase 3) extracted engine: content model, adapters, modules
├── packages/ai/             # (phase 3) provider-agnostic AI layer + features
├── packages/create-edgepress/  # (phase 6) installer CLI
├── docs/                    # RFCs, guides; later the docs site
└── .github/workflows/       # CI: typecheck, build, (later) e2e + deploy previews
```

Rule learned from the predecessor platform: code starts in `apps/web` and is **extracted into
packages only when the second consumer exists**. No premature abstraction; no sync-copy scripts.

## 3. Storage & media adapters

All persistence goes through two interfaces; the app never touches a backend directly.

```ts
interface StorageAdapter {           // JSON documents (pages, settings, leads, …)
  get<T>(key: string): Promise<T | null>;
  put(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
}
interface MediaAdapter {             // binary blobs (images, video)
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<{ bytes: Uint8Array; contentType: string } | null>;
  delete(key: string): Promise<void>;
}
```

| Adapter | v1 | Notes |
|---|---|---|
| `fs` (JSON files / local blobs) | ✅ | zero-config default for Docker/Node/dev |
| `cloudflare-kv` + `r2` | ✅ | the $0 edge deployment |
| `sqlite` (better-sqlite3 / D1) | v1.x | single-file durability |
| `postgres`, `s3` | v1.x | teams / existing infra |

Selection is config/env (`EDGEPRESS_STORAGE=fs|kv`, `EDGEPRESS_MEDIA=fs|r2`), resolved once in
`lib/adapters.ts`. The proven predecessor `storage.ts` (KV-with-fs-fallback) is the seed of this.

## 4. Module system

Every optional capability is a **module**: `auth`, `blog`, `forms-crm`, `seo`, `analytics`,
`marketplace`, `ai-*`. Modules declare:

```ts
interface ModuleDef {
  id: string; label: string; description: string;
  defaultEnabled: boolean;
  adminTabs?: AdminTab[];        // panel surfaces
  blocks?: BlockType[];          // page-builder blocks it contributes
  settingsFields?: FieldDef[];   // config UI auto-generated in admin → Modules
}
```

Enabled-state and per-module settings live in one document (`ep-modules.json`) editable in the
admin **Modules** screen — this is the "security/auth can be toggled" requirement generalized:
`auth` off ⇒ admin binds to localhost/dev only + Content API becomes public-read; the setup
wizard turns it on by default and forces a real password (no more admin/admin).

## 5. AI layer (`packages/ai`)

**Provider-agnostic + BYOK.** EdgePress ships with no keys; users bring their own or use free
local/edge options.

```ts
interface AIProvider {
  id: "anthropic" | "openai" | "google" | "workers-ai" | "ollama";
  complete(req: { system?, messages, model?, maxTokens?, json? }): Promise<AIResult>;
  embed?(texts: string[]): Promise<number[][]>;
  image?(prompt: string): Promise<Uint8Array>;
}
```

- **Model routing per feature** (`ai-config`): cheap model for alt-text, strong model for page
  generation; user-editable table in admin → AI.
- **Cost controls:** monthly budget, per-feature usage metering, response cache.
- **Safety:** every AI output lands as **draft**; AI action log; approve-first mode. AI never
  publishes without an explicit human click.
- **MCP server (flagship):** EdgePress exposes its admin API as MCP tools so Claude/agents can
  manage the site conversationally from outside.

### AI feature clusters (v1 matrix)

1. **Content Studio** — prompt→full block page; blog writer (outline→article+meta+images);
   brand-voice profile; rewrite/tone/expand per field; bulk drafts from CSV; image gen + alt.
2. **Translation** — one-click whole-site translation to any locale; stale-translation flags;
   glossary; cultural adaptation; RTL.
3. **SEO** — (port existing audit/IndexNow/meta-writer) + keyword & content-gap research,
   internal-link suggestions, freshness agent, auto-alt.
4. **AI Site Builder** — conversational onboarding interview → complete site; template importer
   v2 (URL/screenshot → theme+blocks via LLM); theme designer ("feel like a luxury spa").
5. **CRM** — lead scoring + intent summary; drafted replies in brand voice; follow-up sequences;
   spam filter; weekly digest.
6. **Visitor Assistant** — RAG chat over site content, multilingual, captures leads into CRM.
7. **Admin Copilot** — chat sidebar driving the CMS via tool-calls (preview + confirm).
8. **Analytics** — NL queries over stats/leads; scheduled reports; anomaly alerts; A/B titles.
9. **Smart Media** — semantic search, auto-tag/alt, background removal, smart crop, captions.

## 6. Content model (ported, proven)

Block-based pages (18+ block types), localized fields, themes-as-tokens (colors/fonts/radius →
CSS variables), blog, media, menus, settings, SEO per page. Upgrades over the predecessor:

- **N-locale i18n** (locales configurable at setup; `Localized` becomes `Record<locale,string>`).
- **Revisions:** every save stores a version (`ep-rev:<pageId>:<n>`), one-click restore.
- **Custom Content Types** (v1.x): user-defined collections with the same field schema the block
  editor already uses.
- Editor maturity: Tiptap rich text, dnd-kit drag-and-drop, autosave + dirty guard, command
  palette, zero `window.prompt/alert` anywhere.

## 7. Auth module

Providers: `none` (dev), `password` (argon2/scrypt via WebCrypto, sessions, roles
admin/editor/author, TOTP 2FA), `oauth` (v1.x). Setup wizard creates the first admin. Rate-limited
login, session list/revoke, full audit trail.

## 8. Install experience (phase 6)

- `npx create-edgepress my-site` → scaffold + browser **setup wizard** (locales, admin user,
  storage choice, starter theme or AI interview).
- `docker run edgepress/edgepress` (fs adapter, volume-mounted data).
- **Deploy-to-Cloudflare button**: provisions KV+R2, deploys the worker, $0/month.
- Every install path ends at the same wizard.

## 9. Delivery phases

| # | Phase | Exit test |
|---|---|---|
| 1 | Clean private repo, RFC, skeleton, ported baseline app (branding, generic seed, fs+kv adapters), CI, dev deploy | build green, admin CRUD works on dev deploy |
| 2 | Editor maturity: Tiptap, dnd-kit, autosave, revisions, modals/toasts (no prompts), media manager v2 | e2e: create→edit→restore revision→publish |
| 3 | AI layer: provider abstraction (Anthropic/OpenAI/Workers-AI/Ollama), AI config UI, clusters 1–3 | translate page, generate page, SEO agent on dev |
| 4 | Site Builder interview + importer v2 + Admin Copilot + MCP server | new site from interview in <5 min |
| 5 | Clusters 5–9 (CRM AI, visitor assistant, analytics, media AI) | assistant answers from site content; lead scored |
| 6 | Auth module full (roles/2FA/wizard) + N-locale generalization | wizard-first-run; second locale added live |
| 7 | Installers: create-edgepress, Docker, deploy buttons | fresh machine → running site in 5 min, all 3 paths |
| 8 | Private beta: EdgePress powers the 4 existing client sites | parity checklist per site |
| 9 | Docs site + live demo + hardening (rate limits, CSP, dependency audit) | security checklist green |
| 🚀 | **Public launch** (only on owner's explicit go) | — |

Quality gate per phase: typecheck + build + smoke tests green, deployed to the private dev
instance, verified, committed. No phase starts before the previous one's gate passes.

## 10. Non-goals for v1

E-commerce checkout, multisite-in-one-instance, plugin marketplace with third-party code
execution, WYSIWYG in-place front-end editing. All are v2 candidates.

## 11. Naming & distribution

- GitHub: `edgepress` (**private until owner's explicit go**). npm: `edgepress`,
  `create-edgepress` (verified free 2026-07; publish only at launch). Domain suggestion:
  edgepress.dev.
- Tagline: **"The AI-native CMS that runs free on the edge."**
