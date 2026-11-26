# Flagsmith wrapper (WP6)

`src/lib/flagsmith/` is the only code that talks to Flagsmith. It is server-only, apart from the public environment key.

Every call shape below was reconciled against Flagsmith/flagsmith `main` at SHA `f6ecf07` (`api/experimentation/`, `api/features/`) and against flagsmith-js-client `event-processor.ts`. Which version Flagsmith Cloud runs is unknown, so see "Still unverifiable" at the end.

| File | Purpose |
|---|---|
| `admin.ts` | Flag and experiment lifecycle: publish (create and start), results, complete with a rollout decision, ship (text and 100/0), undo, archive |
| `client.ts` | Identities (`<deckId>:<guid>` plus a `source` trait, read `variant`), events (`$flag_exposure`, `reward_claim`, `answer_positive`), platform flags |
| `results.ts` | Parser for the real results payload (`ResultsSummary`). Maps `"control"` to the control card. |
| `weights.ts`, `state.ts` | Pure weight maths (rows carry their ids); refresh guard (5 minutes per experiment) and snapshot store |
| `mongo-store.ts` | Durable store (collection `flagsmith_state`), used automatically when `MONGODB_URI` is set |
| `../decks/integration.ts` | Publish and archive hooks: demo, not configured, configured-ok and configured-failing behaviour |
| `../results/decision.ts` | "Test decided" using `rules.ts` (95%, at least 50 identities per card, no SRM) on Flagsmith's numbers |

## Environment variables

Required:
- `FLAGSMITH_ADMIN_API_KEY`
- `FLAGSMITH_PROJECT_ID`
- `NEXT_PUBLIC_FLAGSMITH_ENV_KEY`, which is also the `{env}` in admin paths

Optional:
- `FLAGSMITH_API_URL`
- `FLAGSMITH_ADMIN_AUTH_SCHEME`: `Api-Key` by default, or `Token`
- `FLAGSMITH_EVENTS_URL`: on Flagsmith Cloud (`FLAGSMITH_API_URL` unset or a `*.flagsmith.com` host) defaults to `https://events.api.flagsmith.com`, with path `/v1/events`. With a self-hosted `FLAGSMITH_API_URL` it defaults to that URL, i.e. the core `/api/v1/events/` (Cloud's events host cannot take a self-hosted environment key). Set it to the same value as `FLAGSMITH_API_URL` to force the core route. The core route 404s unless the environment's warehouse is the Flagsmith database.

Event timestamps are always integer milliseconds; Flagsmith rejects anything before 2020-01-01 in ms, so seconds never work. The old `FLAGSMITH_EVENT_TIMESTAMP_UNIT` option is gone.

When the admin key is unset, every admin method throws `FlagsmithNotConfigured` (check with `isNotConfigured(e)` or `isAdminConfigured(loadConfig())`), and `GET /api/flags` falls back to defaults.

## Flow and the call each step sends

**1. Publish** (`launchDeckExperiment`, called from `onDeckPublished`):
- The deck service first claims the draft atomically (`publishingAt`, a conditional store update). A second publish of the same deck (double click, retry, another tab) gets 409 and never reaches Flagsmith; card edits and delete are refused while the claim is held. A claim older than 5 minutes counts as abandoned.
- If a flag with the deck's name already exists (an earlier failed attempt), it is archived and the new flag gets a fresh `_r<base36>` suffix. Archived names stay taken. The deck stores the name actually used.
- `POST projects/{p}/features/` `{name, type: "MULTIVARIATE", default_enabled: true, initial_value: <control text>}`, with no options. Nested option keys are read-only and would be created keyless.
- One `POST projects/{p}/features/{f}/mv-options/` per challenger: `{feature, type: "unicode", string_value, default_percentage_allocation: 0, key}`. The option ids come back on these responses.
- `GET environments/{e}/experiment-metrics/?q=<event>` (matched on `definition.event`), or `POST` `{name, aggregation: "occurrence", direction: "up", definition: {version: 1, event}}`, for `reward_claim` and `answer_positive`. Metric ids are looked up on every publish, never cached: a metric deleted in the dashboard would otherwise make every later experiment create fail with 400 "Invalid pk".
- `POST environments/{e}/experiments/` `{feature, name, hypothesis, metrics: [{metric, expected_direction: "increase"}], experiment_rollout: {enabled: true, rollout_percentage: 100, feature_state_value: {type: "string", value}, multivariate_feature_state_values: [...]}}`, then `POST .../{id}/start/`. If start errors (e.g. a timeout) but `GET .../{id}/` shows `running`, the start did happen and the publish counts as a success.
- The deck stores `experimentId`, `featureId`, `optionIds` and `rewardMetricId`.
- On any failure the flag is archived (`PATCH features/{f}/ {is_archived: true}`), the reason is logged, and the deck goes live anyway on a local split with `flagsmithError` set. The Results page then says "Local split: not running on Flagsmith (...)" and never calls a winner. If that cleanup archive fails too, the flag's id is kept on the deck as `featureId` (with no `experimentId`), so archiving the deck archives it later.

**2. Assign** (`assign`): `POST /api/v1/identities/` `{identifier, traits: [{trait_key: "source", trait_value}]}`.
- The flag's `variant` is `"control"` (meaning `cards[0]`) or the option key (meaning the card with that `variantKey`).
- When `variant` matches nothing, the card is matched on the served value; when that fails or Flagsmith errors, `localCard` is used.
- Only decks with an `experimentId` are assigned this way. Local-split decks and not-counted feed swipers use `localCard` and make no Flagsmith call.

**3. Exposure and conversions** go to `eventsEndpoint(config)` with `X-Environment-Key`, as `{events: [{event, timestamp (ms), identifier, feature_name, value?, traits: {source}, metadata?}]}`.
- `$flag_exposure` carries `value: "control" | <key>` and `metadata.experiment_id`.
- The exposure is sent only for valid and counted answers on a live deck with an `experimentId`, whether positive or negative, at the same gate as `answer_positive`. An accepted exposure is recorded on the response (`exposedToFlagsmith`). `answer_positive` is sent only after an accepted exposure, and `reward_claim` only for a response with `exposedToFlagsmith`. Exposures and conversions therefore count the same population, and invalid swipes never reach Flagsmith.
- A batch with nothing accepted comes back as HTTP 400 `{accepted: 0, rejected}`, from both the core view and the ingestion server (`ingest.rs`). The wrapper returns it, and the server wiring treats it as not sent. A 2xx without a numeric `accepted` counts as accepted.
- How Flagsmith counts these (`experimentation/results_query.py`):
  - exposures are keyed by `feature_name` and `identifier`, with `value` as the variant;
  - an identity with two different exposure values is quarantined;
  - a conversion counts only when it matches the identifier and event name and its `timestamp >= first_exposure`;
  - `feature_name` on conversions and `metadata.experiment_id` are not used for matching.

  We send the exposure first, then the conversion, so the order always holds.

**4. Results** (`getExperimentResults`):
- `POST .../{id}/results/refresh/` runs at most every 5 minutes (our guard). A 400 (not started, or final) or 429 (Flagsmith's throttle) is non-fatal.
- `GET .../{id}/results/` returns `{results: null}` or `{results: {as_of, is_final, payload: {srm_p_value, metrics: [{metric_id, variants: {k: {n, sum, sum_squares}}, inference: {k: {lift, ci_low, ci_high, chance_to_win} | null}}]}}}`.
- The parser picks `metric_id == rewardMetricId`; without one, the id is looked up by event, read only. It reads:
  - identities from `n`
  - conversions from `sum`
  - chance from `chance_to_win`, with 0 when inference is null
  - SRM as `srm_p_value < 0.001` when Flagsmith reports one; otherwise a local chi-square on `n` (see below)
  - computedAt from `as_of`
- SRM: at SHA `f6ecf07`, `services.py _expected_variant_shares` builds the expected split from the environment default (a TODO says it should read the rollout override), and `stats.py srm_p_value` returns None when any share is 0. Our options keep a 0% default (the split lives in the rollout override), so Flagsmith's `srm_p_value` is always null for our experiments. `results.ts` ports `srm_p_value` / `_chi_squared_survival` and tests `n` per variant against the split we configured (equal, every card of the deck, a card missing from the payload counts as 0), from 100 identities. A p-value below 0.001 blocks a winner call; the local check can never call one.
- `"control"` becomes the control card's key and id.

**5. Ship** (`shipWinner`, or `assistant/ship.ts` through the same calls):
- Snapshot the environment default (`GET featurestates/?feature=`, rows with ids).
- `POST .../{id}/complete/` sends `{rollout_decision: "control"}` or `{rollout_decision: "variant", rollout_variant: <option id>}`. A 400/409 is tolerated only when `GET .../{id}/` then shows `status: "completed"` WITH the same `rollout_decision` / `rollout_variant` (read-only fields of `ExperimentSerializer`). Completed with another decision (e.g. "disable" in the dashboard) throws `FlagsmithCompletedDifferently`: the ship is refused with a 409 and the flag is not touched.
- `PUT featurestates/{id}/` `{feature, enabled: true, feature_state_value: <winning text>, multivariate_feature_state_values: [{id, multivariate_feature_option, percentage_allocation}]}`, so anonymous readers get the winner too, even if the flag had been left disabled.
  - The row ids come from a fresh read.
  - PATCH would silently drop the mv values.
  - Under v2 feature versioning this is refused, and `FlagsmithVersioningError` explains why. The ship still stands, because complete already applied the decision, and the shipped screen shows the error.
  - Any other write error is stored and shown as a safe summary ("Flagsmith did not accept the new text (HTTP n)"); the raw error goes to the server log only.

**6. Undo**: PUT the pre-ship snapshot of the environment default back. That is NOT the test split: while an experiment runs Flagsmith keeps every option's default at 0% (`_reset_default_allocations_to_control`) and the split lives in the rollout override, which complete deletes (`_delete_experiment_rollout_override`). So undo serves the CONTROL card to everyone. There is no undo endpoint, and a completed experiment cannot restart; testing again needs a new deck. The review steps and the shipped screen say so. Under v2 versioning the undo route answers 409 with the `FlagsmithVersioningError` message.

**7. Archive** (`onDeckArchived`, given the deck as it was before archiving): `PATCH features/{f}/ {is_archived: true}`. A running experiment is left as it is. The flag is kept when the deck was shipped, or when `GET .../{id}/` shows the experiment completed (e.g. after an undo): it is the flag serving the winning or control text to the share link and the founder's website. Errors are logged and never thrown into the founder's archive action.

Keep change requests OFF and v2 feature versioning OFF for the PitchSwipe environment.

## Unit tests

```
npm test -- flagsmith
```

`scripts/tests/flagsmith.test.mjs` runs against a fake Flagsmith server that mirrors the real one:
- `key` is read-only on nested options;
- `mv-options` returns ids;
- archived names stay taken;
- complete needs a valid `rollout_decision`; the experiment detail returns `rollout_decision` / `rollout_variant`;
- experiment create rejects metric ids that no longer exist;
- results carry `srm_p_value: null`, as the real server does for our experiments;
- refresh returns 400 before start and 429 within 5 minutes;
- PUT applies nested rows while PATCH drops them;
- v2 versioning returns 400;
- identities carry `variant`;
- events need integer ms and `feature_name` for `$flag_exposure`.

The tests also cover publish success, failure cleanup at every step, retry naming, the deck hooks, assignment mapping, results parsing, and the ship and undo bodies. The `swipe`, `claims`, `decks` and `assistant` suites cover the gates and the service wiring.

## Live smoke test (needs real keys)

```
node --env-file=.env.local --import ./scripts/register-ts.mjs scripts/flagsmith-lifecycle.mjs --yes --traffic 12
```

Use a test environment, never production.

What it changes in Flagsmith:
- one throwaway `deck_lifecycle_<timestamp>` flag and its experiment, archived at the end;
- the two metrics, only if they are missing;
- a few events for that flag.

It runs the exact app code path and prints PASS, FAIL, PENDING or INFO for each step: config, publish, assignment, exposures, conversions, anonymous read, results (it records Flagsmith's own `srm_p_value` next to the local one), ship B (checks the stored `rollout_decision` / `rollout_variant`), a refused second complete (same decision tolerated, a different one refused; read only), who sees the winner (flag enabled), undo (control for everyone) and archive. Results can stay PENDING for hours while the warehouse catches up. It writes `scripts/recorded/flagsmith-lifecycle-<timestamp>.json`, which contains no keys; review it before committing. After a successful run, add the recorded results payload next to the demo samples in `src/fixtures/flagsmith-results-sample.ts`.

## Still unverifiable without a live account

- The Flagsmith Cloud version, and whether experimentation (beta) is enabled for the organisation.
- The warehouse type, and so which events host accepts events. A FAIL on the exposure step points here.
- Whether the Edge API returns `variant` and `metadata`.
- The environment's `use_v2_feature_versioning`.
- What anonymous `/flags/` readers see after complete plus the PUT.
- Writable-nested row behaviour on PUT. We always send ids.
- Whether feature-state writes are blocked while an experiment runs.
- Whether Flagsmith Cloud's `srm_p_value` is really always null for our setup (the lifecycle script records it).
- Whether SDK and Edge reads still return an archived feature. We never archive a shipped deck's flag, so the share link does not depend on it.
