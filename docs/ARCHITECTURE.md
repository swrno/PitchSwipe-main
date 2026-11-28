# Architecture map

Short orientation. The product spec is the source of truth: start at `docs/spec/README.md`; work packages are in `docs/spec/BUILD_PLAN.md`. This describes the repo as found on disk and may lag other work in progress.

## Stack

One responsive Next.js (App Router) app, TypeScript, Tailwind, Framer Motion. MongoDB via Mongoose. Firebase Authentication. Flagsmith for assignment, events, experiments and results.

## Folders

```
src/
  app/        Routes only (pages, layouts, api/*/route.ts). Thin: parse the request, call a feature, respond.
  features/   One folder per product feature (below). Everything about a feature lives together.
  shared/     Code used by more than one feature: ui/ (buttons, cards), shell/ (nav, top bar, PWA, sign-in gate),
              lib/ (db, config, plans, nav, lists, ratelimit, firebase, feel, ai provider layer + engine, testing helpers)
  models/     Mongoose models (no connection on import)       types/  Types mirroring the data model
scripts/      Flagsmith lifecycle, doctor, seed/, db/, TS test loader, run-tests.mjs
docs/         Spec, designs, deploy, mobile, archive/ (see docs/README.md)
infra/vm/     Server scripts.  mobile/  Capacitor android/ios/www.  public/  static assets
```

Inside `src/features/<feature>/`:

| Folder | Holds | May import |
|---|---|---|
| (root) | Pure domain code: rules, types, validation, view builders, store ports | other features' roots, `shared` |
| `ui/` | React components, hooks, client fetch helpers (`api.ts`, `client.ts`) | its root, `shared`, other features' `ui/` and roots; never `server/` (ESLint enforces it) |
| `server/` | MongoDB stores, services, mailers, admin clients, cron, env-reading code | anything; never imported by `ui/` |
| `tests/` | Every test for the feature: `*.test.ts` or `*.test.mjs` | anything |

Features: `ask` (Ask your results chat, WP13), `assistant` (test-decided watcher, ship, WP8), `auth` (Firebase sign-in, WP1), `claims` (claims, voice comment, wallet, WP3-4), `decks` (products, decks, wizard, one-variable rule, WP5), `demand-curve` (WP10), `export` (WP11), `flagsmith` (the only module that talks to Flagsmith, see its README, WP6), `founder` (founder overview pages), `insights` (WP15), `landing`, `profile`, `quality` (30-card quality check, WP2), `results` (WP7), `share` (WP14), `sites` (ship to website, WP9), `swipe` (feed, card, WP3).

Routes in `src/app` import from features (`@/features/<f>/...`) and `@/shared/...`. Features never import from `src/app`. Add a new feature by creating `src/features/<name>/` with only the folders it needs. `src/shared/lib/ai/engine/` is a standalone ESM JavaScript package with its own tests.

Some WPs (for example the product insights page, WP15, and ship to website, WP9) may not have code on disk yet; check the folders.

## Rules that must hold

- **Flagsmith only decides.** The winner is decided by Flagsmith results on `reward_claim`: 95% chance to beat control, at least 50 identities per card, no SRM warning, else "Too close to call". It ships only after the founder taps Approve and ship. AI writes and explains; it never decides, ships or changes a flag, and every number in AI text is filled by code from real data.
- Invalid swipes (under 2 s on screen) and not-counted swipes (quality score under 70) never reach Flagsmith and are never paid. No lockout.
- One variable per deck; cards are immutable after publish.

## Privacy rules

- Founders see aggregates only; groups under 10 are shown as "Other".
- Emails are shared only on an explicit claim tap.
- Raw IP is never shown (the `ip` field is `select: false`).
- Secrets are server-side. The only Flagsmith key the browser may see is `NEXT_PUBLIC_FLAGSMITH_ENV_KEY`.
- Payouts are not live yet; no real money moves.
- Voice notes: the browser's Web Speech API turns speech into text (`src/features/claims/ui/dictation.ts`, the swiper picks the language). `POST /api/voice/transcribe` receives text only and returns the English (`src/features/claims/voice-text.ts`: English passes through; other languages go to Claude and must keep every figure, else the swiper types the English). Audio leaves the browser only with the "Let the founder play" tick and is deleted after 30 days. Voice notes need a signed-in, verified email (the comment route refuses a voice note otherwise; typed comments need neither), and in the Capacitor app, whose WebView has no recognizer, the phone's own speech service listens instead through `@capacitor-community/speech-recognition` (`src/features/claims/native-dictation.ts`; Android only for now, no audio kept; see docs/mobile.md). The translation call runs at low effort with a 2,500-token cap and an 11 s timeout (the browser waits 16 s, token refresh included), and is limited to 5 a minute and 60 a day per user (in-memory, per instance). The model copies a number said in words as spoken, in its own script, and the swiper is asked to write it in English; a translation that changes a figure or writes a number in English words is dropped ("two-wheeler" and "five-star" are not numbers). If the voice route refuses the swiper (sign-in or a verified email), the words move to the typed comment.

## Environment variables (`.env.example`)

Server only: `MONGODB_URI`, `FLAGSMITH_ADMIN_API_KEY`, `FLAGSMITH_ORG_ID`, `FLAGSMITH_PROJECT_ID`, `FLAGSMITH_ENVIRONMENT_ID`, `LLM_API_KEY`, optional `LLM_TRANSLATE_MODEL`, `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY`, `CRON_SECRET` (the cron route returns 503 without it), optional `RESEND_API_KEY`, `RESEND_FROM_EMAIL`.

Public: `NEXT_PUBLIC_FLAGSMITH_ENV_KEY`, `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`, `NEXT_PUBLIC_APP_URL`.

Copy `.env.example` to `.env.local`; never commit real values. Other agents may add variables (for example `LLM_MODEL`, `LLM_BASE_URL`); check the file.

## Scripts and tests

`package.json` scripts: `dev`, `build`, `start`, `lint`, `typecheck`, `test` (runs every suite via `scripts/run-tests.mjs`; `npm test -- seed` runs one), `test:flagsmith`, `test:seed`, `seed`, `db:sync-indexes`. Deploy steps are in `docs/deploy.md`. Tests use `node:test`; TypeScript tests need the loader in `scripts/register-ts.mjs`.

Test rule: every test lives in `<feature>/tests/` (or `src/shared/lib/<x>/tests/`) and is named `*.test.ts` or `*.test.mjs`. `scripts/run-tests.mjs` discovers each `tests/` folder as one suite named after its parent (no file lists to maintain); script tests sit beside their script (`scripts/seed`, `scripts/db`, `scripts/tests`). Run one suite with `npm test -- swipe`. Hand-run: `node --import ./scripts/register-ts.mjs --test src/features/<f>/tests/<file>`; `src/features/decks/tests/*.test.mjs` need `--import ./src/features/decks/tests/register.mjs` instead.

Checks: `npm run typecheck`, `npm run lint`.

## No demo mode

Storage is always MongoDB and sign-in is always Firebase. When `MONGODB_URI` or the Firebase Admin keys are missing, API routes answer 503 (`Server not configured: set MONGODB_URI and the Firebase keys in .env`) and pages show that message; nothing falls back to sample data. Signed-out visitors see a sign-in card on /wallet, /profile, /decks/** and /products/**. Tests use empty in-memory stores as doubles (`createMemoryStore`, `createMemorySwipeStore`, `createMemoryClaimsStore`) and hand-built inputs from `src/shared/lib/testing/`.
