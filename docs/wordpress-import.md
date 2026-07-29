# Moving a WordPress site in

EdgePress reads the file WordPress itself produces, so you don't need a plugin
on the old site or database access.

**Pages → Import → From WordPress.** Owner only.

## In WordPress

Tools → Export → **All content** → Download Export File. You get a `.xml`
(a WXR file). Keep it under 20 MB; for a bigger site export Posts and Pages
separately and import each file.

## What comes across

| WordPress | Becomes |
|---|---|
| Pages | Pages, keeping the original HTML exactly as-is |
| Posts | Blog posts, with their date, author, categories and tags |
| Draft / pending / private | Drafts — nothing goes live that wasn't live |
| Media in the library | Re-hosted into your own storage, links rewritten |
| Old URLs | **301 redirects**, so your rankings and inbound links survive |

Pages keep their WordPress markup rather than being guessed into blocks. A
migration where the layout shifts isn't a migration; you can convert any page to
blocks later from the editor.

Menus, revisions and anything in the trash are skipped, and the importer tells
you how many of each it left behind — nothing disappears without a count.

## Addresses that are already taken

Every WordPress site has an `/about`, and so does a fresh EdgePress install. The
first run **keeps what you already have** and lists the clashes; you're then
asked whether to replace those with the WordPress versions. Nothing is
overwritten silently, and running the import twice changes nothing the second
time.

## Media

Media is fetched **after** the content, in small batches, because each file is
an outbound request and hosts cap how many one request may make. Leave the tab
open until it finishes. Until a file is re-hosted, the imported page still
points at the old domain — the importer rewrites those links as each batch
lands, so the new site never ends up hotlinking the old one permanently.

Files the old host no longer serves are reported and skipped rather than
failing the whole import.

## After importing

1. Skim the imported pages — WordPress themes sometimes leave shortcodes
   (`[gallery]`) in the HTML, which EdgePress renders literally. Delete them.
2. Check Redirects (SEO → Redirects) and point your domain at the new site.
3. Themes are separate from content here: pick one in Appearance and the whole
   site restyles without touching what you just imported.
