# Private-beta runbook — moving production sites onto EdgePress

Operational checklist for migrating a small fleet of live sites (the private
beta) onto EdgePress, one at a time. It composes the careful path from
[ADOPTING-FOR-A-SITE.md](ADOPTING-FOR-A-SITE.md) with hard go/no-go gates.

**Rules of engagement**

- One site per session. Never batch, never unattended, owner watching.
- The live site is never touched until the final DNS/domain step.
- Every step below is per-site; repeat the whole file for the next site.

## 0. Inventory (5 min, read-only)

- [ ] Current host/worker name, DNS records, and domain registrar access.
- [ ] Traffic sources that must keep working: forms (where do submissions
      go?), analytics, any API consumers, RSS/sitemap subscribers.
- [ ] Languages in use, page count (from `sitemap.xml`), media volume.
- [ ] Pick the storage pair for the new instance: its **own** KV namespace +
      R2 bucket (never shared with another site).

## 1. Staging instance

- [ ] `npx create-edgepress <site> --cloudflare` → deploys a fresh worker on a
      `*.workers.dev` staging URL with its own KV/R2. Set `ADMIN_SECRET`,
      strong owner password via the setup wizard, and `SITE_URL` to the
      final domain (metadata/sitemap URLs render correctly on cutover).
- [ ] Panel reachable, version footer shows the expected release.

## 2. Content in

- [ ] `Pages → Import whole site` with the live URL — every sitemap page lands
      as an editable draft. Redo stragglers with `Import URL` / screenshot.
- [ ] Blog: import posts (whole-site import covers them if they're in the
      sitemap; otherwise Import URL per post).
- [ ] Media: re-upload key images to the instance's R2 so nothing hotlinks
      the old host.
- [ ] Forms: rebuild each form in the Forms tab; set per-form
      **Email new submissions to** so notifications match the old behaviour.
- [ ] Menus (including sub-links), legal pages, locales + translations.

## 3. Fidelity gate (go/no-go)

- [ ] Theme matched in Appearance (+ Custom CSS where needed).
- [ ] Side-by-side pass over EVERY page vs the live site — content, titles,
      meta descriptions, images, links.
- [ ] `/{lang}/search`, forms (test submission end-to-end, notification
      received), 404 behaviour, RTL if applicable.
- [ ] SEO tab audit run; sitemap.xml on staging lists exactly the published
      pages; robots.txt correct.
- [ ] Lighthouse/manual mobile check on the 3 most-visited pages.
- **No-go** if anything above fails — fix on staging, re-run the gate.

## 4. Cutover (minutes, reversible)

- [ ] Fresh backup of the OLD site (whatever its host offers) + note its
      worker/deploy so it can be re-pointed instantly.
- [ ] `Settings → Backup` on the NEW instance — download the JSON.
- [ ] Move the custom domain to the EdgePress worker (dashboard → Workers &
      Pages → Settings → Domains & Routes). TTL is Cloudflare-internal, so
      propagation is immediate.
- [ ] Smoke on the real domain: home, one inner page per locale, blog index,
      a form submission, `/sitemap.xml`, `/robots.txt`, admin login + 2FA.

## 5. Rollback (keep armed for 2 weeks)

Point the domain back at the old worker — that's the whole procedure. Keep the
old deployment untouched for at least two weeks of stable traffic.

## 6. Post-cutover

- [ ] IndexNow ping fires on the next publish (SEO tab shows it).
- [ ] Watch analytics + form submissions for 48h against old baselines.
- [ ] Schedule a weekly `Settings → Backup` download until cron backup ships.
- [ ] Log migration friction in the beta notes — each papercut becomes an
      issue; the beta exists to find them.
