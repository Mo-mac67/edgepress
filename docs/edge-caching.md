# Edge caching (optional)

EdgePress renders CMS pages **dynamically** on purpose: an edit in the admin is
live on the next request, with no rebuild. That immediacy is a core promise, so
EdgePress does **not** cache public pages by default.

For a high-traffic site where you want to shave Worker CPU, you can add edge
caching **at the platform level** — this is safer and more effective than a
blanket `Cache-Control` in app code (on Cloudflare Workers, a response header
alone doesn't populate the edge cache; a Cache Rule does), and it keeps the
admin and signed-in requests uncached.

## Recommended: a Cloudflare Cache Rule (per site, opt-in)

Dashboard → your domain → **Caching → Cache Rules → Create rule**:

1. **When incoming requests match** (so only anonymous public GETs are cached):
   - `URI Path` does **not** start with `/api`
   - **and** `URI Path` does **not** start with `/<your-admin-path>` (default `/admin`)
   - **and** Cookie does **not** contain `ms_admin` (skips signed-in admins)
   - **and** Request Method equals `GET`
2. **Then**:
   - **Eligible for cache**
   - **Edge TTL:** Override to e.g. **60 seconds** (your tolerance for how long an
     edit may take to appear for anonymous visitors)
   - **Browser TTL:** Respect origin / a small value

## Trade-off

Any TTL means an edit can take up to that long to show for anonymous visitors
(signed-in admins always see it immediately via the excluded cookie). Keep the
TTL small (30–60s) unless the site changes rarely. To purge instantly after a
big edit, use **Caching → Configuration → Purge Everything**, or a
cache-tag/URL purge.

## Why not a code default?

- It would delay the live-edit behaviour for everyone, which is the opposite of
  what most EdgePress sites want.
- On Workers, `s-maxage` on the Worker response is not automatically honored by
  the edge cache without a Cache Rule / the Cache API, so it wouldn't actually
  cache — it would just add a misleading header.
- A Cache Rule can reliably exclude `/admin` and the auth cookie; a blanket code
  header risks caching authenticated or preview responses.
