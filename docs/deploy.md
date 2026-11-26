# Deploying PitchSwipe

Target stack (spec `docs/spec/06`): Vercel (Next.js app and crons), MongoDB Atlas, Firebase Authentication, Flagsmith. Nothing here has been run against real accounts by the repo's authors; the repo only provides the plumbing listed under "What the repo does".

## What the repo does, and what you do

| Repo (already in git) | You, in dashboards or a terminal |
| --- | --- |
| `vercel.json`: two cron schedules | Create the Vercel project, set env vars, choose a plan |
| `.github/workflows/ci.yml`: typecheck, lint, build, tests on every push and PR | Turn on branch protection if you want CI to gate merges |
| `npm run db:sync-indexes`: builds the unique indexes | Create the Atlas cluster and database user, allow Vercel's IPs, run the script once |
| `scripts/flagsmith-lifecycle.mjs`: checks the Flagsmith lifecycle end to end | Create the Flagsmith project, environment and keys; connect the warehouse |
| `capacitor.config.ts`: reads `CAP_SERVER_URL` | Deploy first, then build the mobile shell against the https URL |
| `.env.example`: the full variable list | Put real values into Vercel (never into git) |

## 1. Vercel project

1. In Vercel choose Add New, Project, import the GitHub repository. Framework preset: Next.js (detected). Keep the default build command (`next build`) and install command (`npm ci` is used automatically with `package-lock.json`).
2. Set the Node.js version to 22.x in Project Settings, General (the repo needs Node 22; see `engines` in `package.json` and the CI file).
3. Set the production branch to the branch you deploy from (the repo's default branch).
4. Add the environment variables from section 2 before the first production deploy. A deployment captures the variables when it builds, so changing one later needs a redeploy.
5. `next build` itself needs no environment variables (verified locally with none set), so the first build succeeds even before you fill them in; the running app will refuse to serve until storage and Firebase are configured.

## 2. Environment variables

Values come from `.env.example`. "Server only" values must never get a `NEXT_PUBLIC_` prefix. "Public" values are inlined into the browser bundle at build time, so they are not secrets, but changing them needs a new build.

| Variable | Kind | Required for production | Notes |
| --- | --- | --- | --- |
| `MONGODB_URI` | server only | yes | Atlas connection string. Without it (and without `PITCHSWIPE_DEMO=1`) production returns 503. |
| `SWIPE_SIGNING_SECRET` | server only | yes | 16+ random characters. Signs the served-card token that binds dwell time and card to each swipe. `/api/responses/next` refuses to serve (503) without it in production. Generate one, for example `openssl rand -base64 32`. |
| `CRON_SECRET` | server only | yes, for crons | Random string of 16+ letters and digits (header-safe characters only, no spaces or line breaks). Both cron routes return 503 without it and 401 for a wrong header. See section 3. |
| `PITCHSWIPE_DEMO` | server only | no | Set to `1` only to run demo mode (fixtures, in-memory stores) in a production build. Leave it unset for a real deployment. |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | public | yes | Firebase web app config. |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | public | yes | Firebase web app config. |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | public | yes | Firebase web app config. |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | public | yes | Firebase web app config. |
| `FIREBASE_ADMIN_PROJECT_ID` | server only | yes | From a Firebase service account. |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | server only | yes | From the same service account. |
| `FIREBASE_ADMIN_PRIVATE_KEY` | server only | yes | The service-account private key. Paste it in double quotes with literal `\n` for newlines, as `.env.example` says. |
| `NEXT_PUBLIC_FLAGSMITH_ENV_KEY` | public | yes | Flagsmith client-side environment key. The only Flagsmith key the browser may see. |
| `FLAGSMITH_ADMIN_API_KEY` | server only | yes | Flagsmith admin API key (organisation level). |
| `FLAGSMITH_PROJECT_ID` | server only | yes | Numeric project id from Flagsmith. |
| `FLAGSMITH_ORG_ID`, `FLAGSMITH_ENVIRONMENT_ID` | server only | not read by code today | Listed in `.env.example`; the Flagsmith wrapper currently uses the project id and the environment key. Setting them is harmless. |
| `FLAGSMITH_API_URL`, `FLAGSMITH_ADMIN_AUTH_SCHEME`, `FLAGSMITH_EVENTS_URL` | server only | no | Overrides, only if the day-1 check (section 6) shows the defaults are wrong or you self-host Flagsmith. `FLAGSMITH_EVENTS_URL` defaults to `https://events.api.flagsmith.com` on Flagsmith Cloud and to `FLAGSMITH_API_URL` (the core `/api/v1/events/` route) when `FLAGSMITH_API_URL` is a self-hosted host; set it explicitly to override either. |
| `LLM_API_KEY` | server only | no | Without it a deterministic mock writes drafts and insights. |
| `LLM_MODEL`, `LLM_BASE_URL` | server only | no | Provider overrides. |
| `LLM_TRANSLATE_MODEL` | server only | no | A cheaper Claude model for translating voice notes to English. Unset, the translation uses `LLM_MODEL`. Speech becomes text in the swiper's browser, so voice notes need no key of their own; without `LLM_API_KEY` the swiper types the English. |
| `RESEND_API_KEY` | server only | no | Without it nothing is emailed. |
| `RESEND_FROM_EMAIL`, `EXPORT_FROM_EMAIL` | server only | no | Senders for the Test decided alert and for emailed exports. They need a sender your Resend account is allowed to use. |
| `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SITE_URL` | public | recommended | The deployed https origin, used in share and email links. |
| `APP_URL` | server only | no | Server-side fallback for the same link. |

Set each variable for the Production environment (and Preview if you want preview deployments to work; note crons only run on production).

## 3. Cron jobs

`vercel.json` registers two crons:

| Path | Schedule | What it does |
| --- | --- | --- |
| `/api/cron/assistant` | `*/5 * * * *` (every 5 minutes) | Checks live decks and raises or withdraws the "Test decided" alert. It never ships or changes a test. |
| `/api/cron/audio-cleanup` | `0 3 * * *` (daily, 03:00 UTC) | Clears voice-note audio older than 30 days. The transcript and English text stay. |

Authentication: when the project has an environment variable named `CRON_SECRET`, Vercel sends `Authorization: Bearer <CRON_SECRET>` on each cron request. Both routes accept exactly that form: they build `Bearer ${CRON_SECRET}` and compare it in constant time (`src/app/api/cron/assistant/route.ts`, and `cronAuth` in `src/lib/claims/cron.ts` for audio cleanup). Both accept GET, which is what Vercel uses. Nothing secret is in `vercel.json`. You can test by hand:

```
curl -i -H "Authorization: Bearer $CRON_SECRET" https://<your-deployment>/api/cron/assistant
```

Vercel sends the secret captured by the deployment serving production, so after rotating `CRON_SECRET` redeploy before expecting the new value to work.

### Hobby plan limitation (read before choosing a plan)

According to Vercel's cron documentation (checked while writing this file), Hobby projects may only run cron jobs once per day, and a Hobby cron may fire anywhere within its scheduled hour. An expression that would run more than once a day, such as `*/5 * * * *`, makes the deployment fail with a message that Hobby accounts are limited to daily cron jobs. Pro and Enterprise allow once per minute with per-minute precision. Plan terms change, so confirm on Vercel's pricing and limits pages.

What that means here:

- The 5-minute assistant watcher needs the Pro plan (or higher). The committed `vercel.json` is written for that.
- On Hobby, change `/api/cron/assistant` to a daily expression such as `0 4 * * *` before deploying. The "Test decided" alert then appears up to a day late, and within the hour at best. Alternatively remove the assistant entry from `vercel.json` and call the route every 5 minutes from an external scheduler that can send the `Authorization: Bearer <CRON_SECRET>` header (for example a GitHub Actions schedule, which this repo does not include). That scheduler setup is untested.
- Daily audio cleanup works on Hobby.
- Crons run only on the production deployment, not on previews.

## 4. MongoDB Atlas

1. Create a cluster, a database, and a database user with read and write on that database. Put the connection string in `MONGODB_URI`, including the database name in the path.
2. Network Access: Vercel functions do not have fixed IP addresses on standard plans, so the common setup is to allow `0.0.0.0/0` and rely on the strong database user password. A tighter allowlist needs Vercel's static IPs or a private connection, which depend on your plan; check Vercel's documentation. Without an allowlist entry the app cannot connect and requests fail.
3. Run the index sync once (section 5) before real traffic.

## 5. Build the indexes: `npm run db:sync-indexes`

The app never creates indexes by itself. The unique indexes make writes atomic: one response per swiper per deck (`responses`: `deckId` + `swiperId`) and one claim per email per deck (`claims`: `deckId` + `email`), plus the unique `slug`, `flagName`, `firebaseUid` and `email` indexes.

From your machine, with the production (or staging) `MONGODB_URI` in the environment:

```
# bash
MONGODB_URI='<your connection string>' npm run db:sync-indexes -- --yes
# PowerShell
$env:MONGODB_URI = '<your connection string>'; npm run db:sync-indexes -- --yes
```

It refuses to run without `--yes` and without `MONGODB_URI`, prints the database name (never the URI), and calls `syncIndexes()` for every model. Note that `syncIndexes()` also drops indexes on those collections that the schemas no longer declare. If a unique index cannot be built because duplicate documents already exist, it prints the duplicate groups it found (key values and document ids), exits 1, and leaves it to you to merge or remove them. Re-run after deploys that change an index in `src/models/index.ts`.

Optionally seed demo data into a throwaway database with `npm run seed -- --yes` (same `MONGODB_URI` rules). Do not seed production.

## 6. Firebase

1. Create a Firebase project and a Web app; copy its config into the four `NEXT_PUBLIC_FIREBASE_*` variables.
2. Authentication: enable the Email/Password sign-in method (the app uses sign-up, sign-in and email verification).
3. Authentication, Settings, Authorized domains: add your Vercel production domain and any custom domain. Sign-in from a domain that is not listed fails. `localhost` is listed by default for development.
4. Project settings, Service accounts: generate a private key and copy the project id, client email and private key into the three `FIREBASE_ADMIN_*` variables.

## 7. Flagsmith

1. Create a Flagsmith project and an environment for production. Copy the client-side environment key into `NEXT_PUBLIC_FLAGSMITH_ENV_KEY`, the project id into `FLAGSMITH_PROJECT_ID`, and create an admin API key for `FLAGSMITH_ADMIN_API_KEY`.
2. Keep change requests OFF and feature versioning (v2) OFF for the PitchSwipe environment. Shipping writes the winning text to the flag with a direct feature-state PUT, which Flagsmith refuses under v2 versioning (the shipped screen then says so).
3. Each deck creates a `deck_<id>` flag. It is multivariate, one variant per card; the repo creates it through the Admin API, so you do not create flags by hand.
4. Experiments and results need Flagsmith's experimentation feature and a connected data warehouse. Per the spec, experimentation is a beta and results can stay empty for hours after the first events while the warehouse catches up. Set the warehouse up before launching a real test, otherwise "Test decided" never fires.
5. Day 1, with real keys, run the lifecycle check against a test environment (never production). It creates one `deck_lifecycle_<timestamp>` flag and experiment (plus the two metrics if they do not exist yet), sends a few events, ships and undoes, then archives the flag, printing PASS / FAIL / PENDING per step:

   ```
   node --env-file=.env.local --import ./scripts/register-ts.mjs scripts/flagsmith-lifecycle.mjs --yes
   ```

   It writes `scripts/recorded/flagsmith-lifecycle-<timestamp>.json` (review it before committing anything). A FAIL on the event steps usually means the events host is wrong for your warehouse (see `FLAGSMITH_EVENTS_URL`); results can stay PENDING for hours. `src/lib/flagsmith/README.md` lists what is still unverified and what to change.

## 8. Mobile shell (Capacitor)

The Android and iOS apps are a thin shell that loads the deployed web app, so they need a live https URL. After the Vercel deployment works:

```
# bash
CAP_SERVER_URL=https://<your-production-domain> npm run cap:sync
# PowerShell
$env:CAP_SERVER_URL = "https://<your-production-domain>"; npm run cap:sync
```

`CAP_SERVER_URL` must be `https://` (see `capacitor.config.ts` and `docs/mobile.md`); it is baked in at sync time, so re-sync after changing it. Add the same domain to Firebase authorized domains. The mobile projects have not been verified on a device by the repo's authors.

## 9. CI

`.github/workflows/ci.yml` runs on pushes and pull requests to the default branch: Node 22.18, `npm ci`, `npx tsc --noEmit`, `npx eslint src scripts`, `npm run build` (no secrets or environment needed), and `npm test` (`scripts/run-tests.mjs`, one process per suite, non-zero exit if any suite fails or reports no tests; run one suite with `npm test -- ratelimit`). Node 22.18 is the lowest version that fits every dependency (firebase-admin and the Capacitor CLI need 22 or later, ESLint needs 22.13 or later) and the tests rely on Node's built-in TypeScript type stripping, enabled by default from 22.18.

The Mongo store adapters (publish claim, edit lock, conditional delete, new deck/response fields) have an opt-in integration test against a real server, not run by CI or `npm test`: `MONGODB_TEST_URI=mongodb://127.0.0.1:27017/pitchswipe_it_local npm run test:mongo`, or in PowerShell `$env:MONGODB_TEST_URI="mongodb://127.0.0.1:27017/pitchswipe_it_local"; npm run test:mongo` (it skips without the variable, refuses any database not named `pitchswipe_it_*`, and drops that database when done).

`.gitattributes` forces LF line endings. Without it a Windows checkout with `core.autocrlf=true` converts files such as `docs/marketing/demo-site/voice-khata/index.html` to CRLF and the sites snippet-equality test fails.

## 10. First deploy checklist

1. Env vars set in Vercel (section 2), Pro plan or daily assistant cron (section 3).
2. Atlas reachable; `npm run db:sync-indexes -- --yes` run against it.
3. Firebase authorized domain added.
4. Flagsmith project, warehouse and day-1 lifecycle check done.
5. Deploy; check the Cron Jobs tab (Project, Settings or Schedules, Cron Jobs) lists both jobs and that the first invocations return 2xx.
6. Optionally run `npm run cap:sync` with `CAP_SERVER_URL`.
