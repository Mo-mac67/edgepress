# Adopting EdgePress for an existing site

> ⚠️ **Never alter a live site's existing public pages or design during
> adoption. Additive only.** (Hard-won rule from the Synergion platform work.)
> Do each live-site migration deliberately, with the owner watching — not in a
> batch, not unattended.

There are two ways to run a site on EdgePress:

## A. New site — just use EdgePress

Deploy EdgePress, run the setup wizard, and build the site in the panel (or let
the AI site builder draft it). This is the intended path and is fully proven on
the private dev instance.

## B. Move an existing site onto EdgePress (careful path)

For a site that already has its own design/pages you must preserve:

1. **Stand up EdgePress on a staging URL** (separate KV/R2). Never point it at
   the live domain yet.
2. **Bring the content in** without recreating the design by hand:
   - `Pages → Import URL` on each live page → AI rebuilds it as editable blocks
     (draft), or
   - the Python template importer (`tools/template-importer` in the platform
     repo) for a whole HTML template → theme + blocks.
3. **Match the theme** in Appearance (or let the importer set it).
4. **Review every page as a draft**, fix content, translate, then publish on the
   staging instance.
5. **Compare staging vs live** side by side. Only when it matches (or is a
   deliberate, approved redesign) do you switch the domain — one site at a time.
6. Keep the old deployment recoverable (`wrangler rollback`) until the new one is
   confirmed live and correct.

## The 4 Synergion sites (Kingspro, Synergion, ChargeReady, MapleSave)

These are **live production sites** (Kingspro is a paying client's). They already
run the earlier per-site CMS from the Synergion platform. Moving them to
EdgePress is optional and must be done **one at a time, with explicit sign-off**,
following path B — not as an automated batch. The private EdgePress dev instance
already validates the product end to end; adopting it for the live sites is a
business decision, not a prerequisite for launch.
