# What & why

<!-- One paragraph: what changes, and the problem it solves. -->

## Merge gate (CONTRIBUTING.md — tests + docs, or no merge)

- [ ] **Tests**: unit (`tests/unit/`) and/or integration (`tests/integration/run.mjs`) cover this change — link the test:
- [ ] **Docs**: GUIDE.md / DEPLOYMENT.md / package README updated — link the section (or explain why a pure refactor needs none):
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm test` all pass locally
- [ ] No account-specific values (IDs, domains, tokens) — deploy config stays `*.example`
- [ ] Portable: works through the storage adapter, no direct host-SDK import inside `packages/`

## How I verified it

<!-- Commands you ran + what proved the behaviour. -->
