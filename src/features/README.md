# src/features

One folder per product feature. `src/app` holds routes only and imports from here; code used by several features lives in `src/shared`.

```
<feature>/
  *.ts        pure domain code: rules, types, validation, store ports (no React, no database)
  ui/         React components, hooks, client fetch helpers      (never imports ../server)
  server/     MongoDB stores, services, mailers, admin, cron, env-reading code
  tests/      all tests: *.test.ts / *.test.mjs, found automatically by scripts/run-tests.mjs
```

Rules
- `ui/` must not import `server/` (any feature). ESLint fails the build if it does (`no-restricted-imports`).
- Cross-feature imports go through `@/features/<other>/...` (root or `ui/`); never reach into another feature's `server/` from a `ui/` file.
- Put a file in `shared/` only when two or more features need it.
- New feature: create only the folders it needs, add its tests under `tests/`; `npm test` picks them up.

See docs/ARCHITECTURE.md for the full map.
