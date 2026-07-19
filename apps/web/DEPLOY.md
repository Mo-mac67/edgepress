# Deploying MapleSave

The app stores data in JSON files under `DATA_DIR` (default `./data`). Set
`DATA_DIR` to a writable path for your host.

## Option A — Quick online preview (Vercel) — view on your phone

Best for **showing** the site. Serverless filesystem is read-only except
`/tmp`, so set `DATA_DIR=/tmp/data`. Collected leads/analytics are **temporary**
(reset on each deploy) — fine for a demo, not for production lead capture.

1. Go to vercel.com → New Project → import `Mo-mac67/maplesave`.
2. Framework preset: Next.js (auto-detected). No build changes needed.
3. Environment variables:
   - `DATA_DIR=/tmp/data`
   - `SITE_URL=https://<your-app>.vercel.app`
   - `SUPERADMIN_PASSWORD=Mhb123654`
   - `ADMIN_SECRET=<long random string>`
   - (optional) `RESEND_API_KEY`, `GOOGLE_MAPS_API_KEY`, etc.
4. Deploy → open the `*.vercel.app` URL on your phone.

## Option B — Production with persistent data (Railway / Render)

Keeps leads forever via a mounted disk. Uses the included `Dockerfile`
(`DATA_DIR=/data`).

**Railway:** New Project → Deploy from GitHub → select the repo. Add a Volume
mounted at `/data`. Set the env vars above (with `DATA_DIR=/data`).

**Render:** New → Web Service → from repo → Runtime: Docker. Add a Disk mounted
at `/data`. Set env vars (`DATA_DIR=/data`).

After launch, back up data with `npm run backup` (or snapshot the volume), and
wire scheduled follow-ups by pinging `GET /api/cron/followups?key=$CRON_SECRET`.

## Admin

`/<locale>/admin` — client password `ADMIN_PASSWORD` (default `admin`),
super-admin `SUPERADMIN_PASSWORD`. Change/reset from the Settings tab.
