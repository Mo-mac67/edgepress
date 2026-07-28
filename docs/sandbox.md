# Public sandbox

A sandbox is an EdgePress instance anyone can sign into and change, which puts
itself back on a schedule. It's how you let people try the admin panel without
installing anything — and how you demo the product without handing over a site
that slowly fills with other people's test content.

Off by default. A normal install is completely unaffected by everything here.

## Turn it on

```bash
EDGEPRESS_SANDBOX=1                  # enables sandbox mode
EDGEPRESS_SANDBOX_RESET_MINUTES=60   # what the banner tells visitors (default 60)
CRON_SECRET=<a long random string>   # protects the reset endpoint
```

Then:

1. Deploy, and set the site up the way you want visitors to find it — pages,
   theme, a few leads, whatever tells your story.
2. **Settings → Sandbox → Capture snapshot.** This freezes the current content
   as the state every reset returns to.
3. Point a schedule at the reset endpoint:

   ```
   GET /api/cron/sandbox-reset?key=$CRON_SECRET
   ```

   On Cloudflare, uncomment the `triggers.crons` block in `wrangler.jsonc`
   (`"0 * * * *"` is hourly). Any external pinger works too.

Publish the sign-in details somewhere obvious — the point is that people get in.

## What visitors can and can't do

Everything about *building a site* stays fully editable: pages, blocks, theme,
media, collections, forms, menus, AI features. That's the product; hiding it
would defeat the exercise.

Refused while `EDGEPRESS_SANDBOX=1`:

| Blocked | Why |
|---|---|
| Sending email | Nobody's inbox should be reachable from a public demo |
| Outbound webhooks | Otherwise the demo becomes someone's traffic generator |
| Changing the password / username / admin URL | Would lock the next visitor out |
| Sign out everywhere | Same |
| Turning on 2FA | Same |
| Restoring a backup | That's how you'd replace the sandbox wholesale |

Email is contained by withholding the API key, which is the same path every
sender already takes when no key is configured — it logs what it would have
sent and moves on. A sender added later inherits that for free.

## Resetting

- `resetSandbox()` restores the snapshot over the current content.
- **With no snapshot, a reset does nothing.** Restoring "nothing" would mean
  deleting everything, so a cron that fires before you've captured one is a
  no-op rather than a wipe.
- Media in R2 is not part of the snapshot (backups carry the media *index*, not
  the binaries). Uploads accumulate; clear the bucket occasionally if that
  matters to you.
- Reset count and last-reset time are visible in Settings → Sandbox.
