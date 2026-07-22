# Security Policy

## Supported versions

The latest release on `main` is supported with security fixes.

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Instead, use
GitHub's private **"Report a vulnerability"** (Security → Advisories) on this
repository. You'll get an acknowledgement within a few days.

Include what you can: affected route/module, reproduction steps, and impact.

## Deployment hardening (self-hosters)

- Set a long random `ADMIN_SECRET` — it salts session/password hashes. Never
  ship the default.
- The setup wizard runs once; complete it immediately after deploying so nobody
  else can claim the Owner account.
- Enable 2FA (Settings → Two-factor) for the Owner.
- Keep `SUPERADMIN_PASSWORD` unset unless you operate many sites and need a
  platform master key.
- API keys grant read access to draft content — rotate them if leaked
  (Developer → API keys → Revoke).
- Webhook payloads are HMAC-SHA256 signed (`x-edgepress-signature`) — always
  verify the signature on your receiving endpoint.
