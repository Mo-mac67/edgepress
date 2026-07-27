# Scheduled backups

EdgePress runs on Cloudflare Workers, where the app worker only handles HTTP —
there's no always-on process to run a cron inside it. So scheduled backups work
by having **any external scheduler call the backup endpoint on a timer**. One
call archives a full JSON backup (pages, posts, collections, forms, leads,
settings — everything except R2 media files) off-site to your R2 bucket.

## 1. Set a backup token

Add a secret to the site so a scheduler can authenticate without a login:

```bash
npx wrangler secret put EDGEPRESS_BACKUP_TOKEN
# paste a long random string
```

(Or add `EDGEPRESS_BACKUP_TOKEN` to `.env.production` / the Worker's vars.)

## 2. The endpoint

- **Download** (owner, in the browser): `GET /api/admin/backup`
- **Headless archive to R2**: `GET /api/admin/backup?token=<TOKEN>&archive=1`
  → writes `backups/edgepress-<timestamp>.json` into your R2 bucket and returns
  `{ ok: true, archivedTo, docs }`.
- **Headless download**: `GET /api/admin/backup?token=<TOKEN>` returns the JSON.

The token is only accepted when `EDGEPRESS_BACKUP_TOKEN` is set, and it's checked
length-first then by value.

## 3. Pick a scheduler

### GitHub Actions (free)

Add this to the site's repo as `.github/workflows/backup.yml` and set repo
secrets `SITE_URL` and `BACKUP_TOKEN`:

```yaml
name: Daily backup
on:
  schedule:
    - cron: "17 4 * * *" # 04:17 UTC daily
  workflow_dispatch:
jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - name: Archive backup to R2
        run: |
          curl -fsS "${{ secrets.SITE_URL }}/api/admin/backup?archive=1&token=${{ secrets.BACKUP_TOKEN }}"
```

### cron-job.org / any uptime cron

Point it at `https://your-site/api/admin/backup?token=<TOKEN>&archive=1` on a
daily schedule.

### Cloudflare Cron (separate tiny worker)

If you prefer to stay on Cloudflare, deploy a 10-line companion worker with a
`scheduled()` handler that `fetch()`es the archive URL — the app worker itself
can't take a cron trigger because OpenNext owns its entrypoint.

## 4. Restore

Download any archived JSON from R2 (or the browser) and use **Settings →
Developer → Backup & restore → Restore from file**.
