# Public sandbox

A sandbox is an EdgePress instance anyone can sign into and change, which puts
itself back on a schedule. It's how you let people try the admin panel without
installing anything — and how you demo the product without handing over a site
that slowly fills with other people's test content.

Off by default. A normal install is completely unaffected by everything here.

## Turn it on

```bash
EDGEPRESS_SANDBOX=1                  # enables sandbox mode
EDGEPRESS_SANDBOX_RESET_MINUTES=60   # how often it resets (default 60)
EDGEPRESS_SANDBOX_LOGIN="sandbox / sandbox"  # shown in the banner so people can get in
CRON_SECRET=<a long random string>   # protects the reset endpoint
```

Then:

1. Deploy, and set the site up the way you want visitors to find it — pages,
   theme, a few leads, whatever tells your story.
2. **Settings → Sandbox → Capture snapshot.** This freezes the current content
   as the state every reset returns to.
3. That's it — resets happen **at request time**. On the first page view after
   the interval has elapsed, the sandbox restores itself.

   > Cloudflare cron triggers are deliberately not used here: a trigger invokes
   > a `scheduled` handler, which the OpenNext worker doesn't export, so it
   > would silently never fire. Request-time is also how scheduled publishing
   > already works in EdgePress, and it behaves identically on Workers, Docker
   > and plain Node. A sandbox nobody is visiting doesn't need resetting.

   To force one from outside (an uptime pinger, a deploy hook):

   ```
   GET /api/cron/sandbox-reset?key=$CRON_SECRET
   ```

Set EDGEPRESS_SANDBOX_LOGIN and the banner advertises the credentials itself —
the point of a sandbox is that people get in.

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

- A reset restores every document in the snapshot **and deletes any that aren't
  in it**. Overwriting alone isn't enough: the leads, form submissions and
  collections visitors create are new documents, and they'd survive every reset
  and pile up forever. Restoring a state means ending at that state.
- **With no snapshot, a reset does nothing.** Restoring "nothing" would mean
  deleting everything, so a reset that fires before you've captured one is a
  no-op rather than a wipe.
- Media in R2 is not part of the snapshot (backups carry the media *index*, not
  the binaries). Uploads accumulate; clear the bucket occasionally if that
  matters to you.
- Reset count and last-reset time are visible in Settings → Sandbox.
