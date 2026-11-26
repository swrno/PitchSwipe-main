# Architecture map

Short orientation. The product spec is the source of truth: start at `docs/spec/README.md`; work packages are in `docs/spec/BUILD_PLAN.md`. This describes the repo as found on disk and may lag other work in progress.

## Stack

One responsive Next.js (App Router) app, TypeScript, Tailwind, Framer Motion. MongoDB via Mongoose. Firebase Authentication. Flagsmith for assignment, events, experiments and results.

## Folders

| Path | What it holds | Work package |
|---|---|---|
| `docs/spec/`, `docs/designs/` | Spec and build plan, designs | n/a |
| `src/app/` | Routes: `(auth)` login, signup, verify; `(shell)` decks, products, swipe, wallet, profile; `d/[slug]`, `practice`, landing, `api/*` | WP0, WP1-WP16 |
| `src/types/` | Types mirroring the data model | WP0 |
| `src/models/` | Mongoose models (no connection on import) | WP0 |
| `src/fixtures/` | Demo numbers from `docs/spec/08` | WP0 |
| `src/lib/lists.ts` | Standard roles, industries, states, test types (no free text) | WP0 |
| `src/lib/db.ts` | `connectDb()`, server only, needs `MONGODB_URI` | WP0 |
| `src/lib/auth`, `firebase` | Firebase sign-in and server verification | WP1 |
| `src/lib/quality`, `src/components/quality` | 30-card quality check and score | WP2 |
| `src/lib/swipe`, `claims`, `src/components/swipe`, `claim` | Feed, card, claim, voice comment, wallet | WP3, WP4 |
| `src/lib/decks`, `src/components/decks` | Products and decks, one-variable rule, locking | WP5 |
| `src/lib/flagsmith/` | The only module that talks to Flagsmith (see its README) | WP6 |
| `src/lib/results`, `src/components/results` | Results rules, who swiped | WP7 |
| `src/lib/assistant` | "Test decided" watcher, approve and ship | WP8 |
| `src/lib/demand-curve` | Price demand curve | WP10 |
| `src/lib/export`, `src/components/export` | Download results | WP11 |
| `src/lib/ai/engine/` | Framework-agnostic AI services and rules engine (plain ESM JavaScript, own tests) | WP12 |
| `src/lib/ai` | App-side AI provider and tool loop | WP12 |
| `src/lib/ask`, `src/components/ask` | Ask your results chat | WP13 |
| `src/lib/share`, `src/components/share` | Sharing and audience UI | WP14 |
| `scripts/` | Flagsmith lifecycle script, TS test loader, `seed/` demo seed | WP6, WP17 |
| `docs/` | Dogfood, demo script, blog draft, this file | WP17 |

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
- Earnings are "Demo earnings"; no real money moves.
- Voice notes: the browser's Web Speech API turns speech into text (`src/lib/claims/dictation.ts`, the swiper picks the language). `POST /api/voice/transcribe` receives text only and returns the English (`src/lib/claims/voice-text.ts`: English passes through; other languages go to Claude and must keep every figure, else the swiper types the English). Audio leaves the browser only with the "Let the founder play" tick and is deleted after 30 days. Voice notes need a signed-in, verified email (the comment route refuses a voice note otherwise; typed comments need neither), and in the Capacitor app, whose WebView has no recognizer, the phone's own speech service listens instead through `@capacitor-community/speech-recognition` (`src/lib/claims/native-dictation.ts`; Android only for now, no audio kept; see docs/mobile.md). The translation call runs at low effort with a 2,500-token cap and an 11 s timeout (the browser waits 16 s, token refresh included), and is limited to 5 a minute and 60 a day per user (in-memory, per instance). The model copies a number said in words as spoken, in its own script, and the swiper is asked to write it in English; a translation that changes a figure or writes a number in English words is dropped ("two-wheeler" and "five-star" are not numbers). If the voice route refuses the swiper (sign-in or a verified email), the words move to the typed comment.

## Environment variables (`.env.example`)

Server only: `MONGODB_URI`, `FLAGSMITH_ADMIN_API_KEY`, `FLAGSMITH_ORG_ID`, `FLAGSMITH_PROJECT_ID`, `FLAGSMITH_ENVIRONMENT_ID`, `LLM_API_KEY`, optional `LLM_TRANSLATE_MODEL`, `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY`, `CRON_SECRET` (the cron route returns 503 without it), optional `RESEND_API_KEY`, `RESEND_FROM_EMAIL`.

Public: `NEXT_PUBLIC_FLAGSMITH_ENV_KEY`, `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`, `NEXT_PUBLIC_APP_URL`.

Copy `.env.example` to `.env.local`; never commit real values. Other agents may add variables (for example `LLM_MODEL`, `LLM_BASE_URL`); check the file.

## Scripts and tests

`package.json` scripts: `dev`, `build`, `start`, `lint`, `typecheck`, `test` (runs every suite via `scripts/run-tests.mjs`; `npm test -- seed` runs one), `test:flagsmith`, `test:seed`, `seed`, `db:sync-indexes`. Deploy steps are in `docs/deploy.md`. Tests use `node:test`; TypeScript tests need the loader in `scripts/register-ts.mjs`.

```
node --import ./scripts/register-ts.mjs --test scripts/tests/flagsmith.test.mjs
node --import ./scripts/register-ts.mjs --test scripts/seed/seed.test.mjs
node --import ./scripts/register-ts.mjs --test src/lib/ai/ai.test.ts src/lib/ask/ask.test.ts
node --import ./scripts/register-ts.mjs --test src/lib/assistant/tests/assistant.test.ts
node --import ./scripts/register-ts.mjs --test src/lib/demand-curve/demand-curve.test.ts
node --import ./scripts/register-ts.mjs --test src/lib/export/export.test.ts
node --import ./scripts/register-ts.mjs --test src/lib/results/results.test.ts
node --import ./scripts/register-ts.mjs --test src/lib/claims/tests/claims.test.mjs
node --import ./scripts/register-ts.mjs --test src/lib/quality/tests/quality.test.mjs
node --import ./scripts/register-ts.mjs --test src/lib/share/tests/share.test.mjs
node --import ./scripts/register-ts.mjs --test src/lib/swipe/tests/swipe.test.mjs
(cd src/lib/ai/engine && node --test)
```

`src/lib/decks/tests/` has its own hooks (`hooks.mjs`, `register.mjs`); see that folder before running `decks.test.mjs` and `service.test.mjs`. Some of these files depend on other branches being merged, so a failure may mean a missing dependency. Checks: `npm run typecheck`, `npm run lint`.

## Demo seed

`scripts/seed/seed.mjs` upserts demo data (Arjun Sen, Voice Khata, QueueLess, LoadMate, Priya Nair, wallet Rs 46.75, headline test numbers from `docs/spec/08`). It refuses to run without `--yes`, needs `MONGODB_URI` in the environment, and prints the target database name before writing:

```
MONGODB_URI=... node scripts/seed/seed.mjs --yes
```

Point it at a throwaway database. Seed assumptions are marked in `scripts/seed/seed-data.mjs`.

The seed is demo data end to end. Its waitlist split follows `src/fixtures` (headline 26, Product UI 11, Price 76 as 29 / 29 / 13 / 5 on Rs 99 / 199 / 299 / 399, Launch reward 5; total 118). Only the headline and price figures come from the spec or designs; Product UI 11 and Launch reward 5 are demo-only.

## Demo data rules

- **Real mode** (`MONGODB_URI` set, or production without `PITCHSWIPE_DEMO=1`): every number shown is computed from real data. If there is not enough data the element is removed or shows an honest empty state. No fixture number is ever substituted. `src/lib/fixtures-imports.test.ts` fails CI if a file outside its allowlist imports `@/fixtures`.
- **Demo mode**: numbers come from `src/fixtures` only, and every screen or export that shows numbers not printed in `docs/spec/08` or a design carries a "Demo data" label (`src/components/ui/demo-badge.tsx` on screens, a first-row note in CSV/Excel/PDF exports).
- **One source for the Voice Khata deck counts**: `VOICE_KHATA_DECK_COUNTS`, `PRICE_TEST_ARMS` and `PRODUCT_TOTALS` in `src/fixtures/index.ts`. Headline 214, Product UI 224, Price 480, Launch reward 120 swipers. The product total of **612 counts distinct people** (one swiper can answer several decks), so it is not the sum of the deck rows. The waitlist 118 is a sum (26 + 11 + 76 + 5). Insights "Decks 1 and 2 · 438 swipers" is 214 + 224.
- **Pinned design values**: the price test counts compute to 89% and "about 90 more swipers"; web 17 prints 88% and "about 40". Demo mode pins the printed values (`PRICE_TEST_DESIGN_VALUES`) and says so on the results screen.
- Headline deck status: "Leading" (91%) on My decks, Results and the deck switcher (web 03, web 24, spec/08 13.1); it becomes "Won" only after Approve and ship. The decided state (256 valid swipers, B 96%) is a later snapshot; its per-card identities split 256 in the proportions of 72 / 71 / 71.
- **The designs contradict themselves on the headline deck, on purpose of the story, not by a bug**: Results (web 16, phone 14) is the earlier check (214 swipers, B 91% / A 8% / C 1%), while the alert and the ship sheet (web 19 and 20, phone 17 and 18) are the assistant's later check (256 valid swipers, B 96% / A 3% / C 1%). Web 20 even shows the 96% sheet over a page that still reads 214 and 91%. Both sets live in `src/fixtures` (`HEADLINE_FLAGSMITH_RESULTS`, `DECIDED_HEADLINE_TEST`) and the demo ship sheet says so in a "Demo data" line (`demoReviewNote` in `src/lib/assistant/sources.ts`).
- **Demo-only swiper profile**: `/swipe?demo=notcounted` (and `?demo=counting` to undo) makes the fixture swiper "not counting yet" so the "Not counted yet" banner and pill can be seen (`src/lib/swipe/demo-profile.ts`). It is a cookie the server reads only where it already invents the fixture swiper (no Firebase Admin, or no database); it can only lower what the demo swiper gets and is ignored for verified users.
