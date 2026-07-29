# Running several sites

If you build sites for clients, each one is its own EdgePress install with its
own admin panel. The console puts them in one table: which version each is on,
whether any are down, and where a lead is sitting unread.

**Your sites** in the admin sidebar. Owner only, because it holds the keys to
other installs.

## Adding a site

On the site you want to add:

1. **Developer → API keys → create a key.** Copy it (it's shown once).

On the console site:

2. **Your sites → Add a site.** Paste the address and the key.

That's it — the row fills in immediately. The key is stored on the console
install and never sent back to the browser; revoking it on the client site cuts
the console off instantly.

Sites must be reachable over **https** (localhost excepted, for development).
An API key sent over plain http is a key given away in transit, so plain http is
refused rather than warned about.

## What the console can see

Counts and timestamps, never content:

- version, and whether a newer release exists
- published and total pages and posts
- how many leads, and how many are unread — **not who they are**
- when the newest lead arrived, and when the site last answered
- which storage backend it uses

A client's contact details stay on the client's site. That's deliberate: if the
console could read them, one leaked key would be a data breach across every site
you run instead of a nuisance on one.

## When a site doesn't answer

The console reports it rather than failing. You'll see one of:

| Message | Means |
|---|---|
| Could not reach the site | DNS, hosting, or the site is genuinely down |
| Timed out | It answered too slowly (10s limit) — often a cold start |
| The API key was rejected | The key was revoked or replaced |
| No status endpoint | That install is older than 2.2 — upgrade it |

**Check all** re-polls every site. It goes one at a time on purpose: each check
is an outbound request and hosts cap how many one request may make, so firing
twenty at once would exhaust the budget and report false failures.

## What this is not, yet

The console reads. It doesn't yet push — no bulk updates, no pushing a theme to
every site at once. Those need a write path on the client side and deserve their
own thinking; reading first makes the rest safe to design.
