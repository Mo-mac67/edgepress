# Adopting EdgePress for an existing site

> ⚠️ **Never alter a live site's existing public pages or design during
> adoption. Additive only.** Do each live-site migration deliberately, with the
> owner watching — not in a batch, not unattended.

There are two ways to run a site on EdgePress:

## A. New site — just use EdgePress

Deploy EdgePress, run the setup wizard, and build the site in the panel (or let
the AI site builder draft it from a one-line description). This is the intended
path.

## B. Move an existing site onto EdgePress (careful path)

For a site that already has its own design/pages you must preserve:

1. **Stand up EdgePress on a staging URL** (separate KV/R2 or a separate `data/`
   dir). Never point it at the live domain yet.
2. **Bring the content in** without recreating the design by hand:
   `Pages → Import URL` on each live page → the AI rebuilds it as editable blocks
   (draft).
3. **Match the theme** in Appearance.
4. **Review every page as a draft**, fix content, translate, then publish on the
   staging instance.
5. **Compare staging vs live** side by side. Only when it matches (or is a
   deliberate, approved redesign) do you switch the domain — one site at a time.
6. Keep the old deployment recoverable (`wrangler rollback`, or a fresh backup
   via Settings → Backup) until the new one is confirmed live and correct.
