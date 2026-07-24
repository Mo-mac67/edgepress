# RFC-002 — EdgePress plugins (declarative, edge-safe, AI-skill-native)

Status: **accepted, v1 shipped** (2026-07-23)

## Problem

Owners want plugins — the single biggest reason WordPress wins. But EdgePress
runs on the Cloudflare Workers edge, where **arbitrary third-party code cannot
be loaded at request time**. A WordPress-style "drop in a PHP file that hooks
the runtime" model is architecturally impossible here (and a security liability
anywhere). So a naïve port is off the table. The question is: what is the
*honest* plugin surface for an edge-native CMS?

## Principle

A plugin **composes capabilities EdgePress already renders safely** rather than
executing new code. Three layers, in order of shipping:

1. **Declarative manifest (v1 — this RFC).** A plugin is a JSON manifest
   bundling: reusable **snippets** (`[snippet name]` HTML), a **settings** bag,
   and an optional **`skill`** (Markdown that teaches an AI agent how to use the
   plugin). Installing registers the snippets site-wide; uninstalling removes
   exactly them. No code runs — safe, portable, reversible.
2. **Service plugins (v2, planned).** A plugin points at the owner's **own**
   HTTPS endpoint; EdgePress calls it via signed webhooks / the Content API and
   renders the response. Real code, but in the developer's own runtime — never
   in yours.
3. **AI-skill-native (built into v1).** Every plugin can ship a `skill`. The MCP
   server folds installed skills into its `initialize` instructions, so an
   agent connected to the site immediately knows how to drive the plugin. This
   is the differentiator WordPress has no answer for: **installing a plugin also
   installs the skill to operate it.**

## Manifest (v1)

```json
{
  "id": "testimonials-pack",
  "name": "Testimonials Pack",
  "version": "1.0.0",
  "description": "Styled customer quotes.",
  "author": "Acme",
  "homepage": "https://example.com",
  "snippets": [
    { "name": "quote", "html": "<blockquote class=\"tp-quote\">…</blockquote>" }
  ],
  "settings": { "accent": "#4f46e5" },
  "skill": "Use [snippet testimonials-pack-quote] to drop a styled quote block on any page."
}
```

- `id`/`name` required. Snippet names are namespaced to `<id>-<name>` so two
  plugins never collide and uninstall is exact.
- Installed from **Developer → Plugins** (owner only), or via the API
  (`POST /api/admin/plugins`). Cap: 50 plugins, snippet HTML ≤ 50 KB, skill
  ≤ 20 KB. Manifest is validated + normalized server-side (`validatePluginManifest`).

## Security

- No code execution: snippets render through the same sanitized path as the
  built-in snippet feature; settings are scalars shown read-only.
- Owner-only install (a plugin registers site-wide content + an agent skill).
- Uninstall is exact and reversible (owned-snippet tracking).

## Not in v1

Service plugins (v2), a public plugin registry, and per-plugin custom block
*types* in the block picker (v1 uses snippets, which already drop into any
page, Custom-HTML block, or rich text).
