// Run: node --import ./scripts/register-ts.mjs --test scripts/tests/flagsmith.test.mjs
// No dependencies: node:test + Node's built-in TypeScript type stripping (Node >= 22.18).
//
// The fake server below mirrors Flagsmith/flagsmith main (SHA f6ecf07), not our own assumptions:
//  - option `key` is read-only on the nested create (features/multivariate/serializers.py) and only writable on
//    POST .../features/{id}/mv-options/, which rejects "control" and duplicate keys;
//  - feature names stay taken after archiving (the list returns archived features);
//  - experiments: create needs a MULTIVARIATE feature + experiment_rollout; complete needs a valid rollout_decision
//    (ExperimentRolloutDecisionSerializer) and moves the environment default to the decision;
//  - results/refresh: 400 before start, 429 within 5 minutes of the last request;
//  - results: {"results": null} or {"results": {as_of, payload: ResultsSummary}}, with srm_p_value null (Flagsmith reads
//    the expected split from the environment default, which is 0% per option for our experiments);
//  - experiment detail carries the read-only rollout_decision / rollout_variant (serializers.py ExperimentSerializer);
//  - experiment create resolves metric pks against non-deleted metrics (400 "Invalid pk" otherwise);
//  - featurestates: PUT applies value + writable-nested mv rows (ids update, missing ids create, absent rows delete);
//    PATCH drops mv values; both refuse with 400 under v2 versioning;
//  - identities: flags carry `variant` ("control" or the option key) and metadata.experiment;
//  - events: integer ms timestamps after 2020-01-01; `$flag_exposure` needs feature_name; nothing accepted -> 400.
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FlagsmithApiError,
  FlagsmithCompletedDifferently,
  FlagsmithInvalidInput,
  FlagsmithNotConfigured,
  FlagsmithPublishError,
  FlagsmithVersioningError,
  RefreshGuard,
  createFlagsmith,
  createMemoryStore,
  equalWeights,
  chiSquaredSurvival,
  eventsEndpoint,
  loadConfig,
  parseExperimentResults,
  parsePlatformFlags,
  rolloutDecisionFor,
  srmPValue,
  toFlagsmithResults,
  toStateValues,
  winnerTakesAll,
} from "../../src/lib/flagsmith/index.ts";
import { archiveOnFlagsmith, publishToFlagsmith } from "../../src/lib/decks/integration.ts";
import { decideDeck } from "../../src/lib/results/decision.ts";
import {
  SAMPLE_METRIC_IDS,
  SAMPLE_RESULTS_DECIDED,
  SAMPLE_RESULTS_MIDTEST,
  SAMPLE_RESULTS_PENDING,
  SAMPLE_RESULTS_SMALL,
  SAMPLE_RESULTS_SRM,
  SAMPLE_RESULTS_SRM_FROM_FLAGSMITH,
} from "../../src/fixtures/flagsmith-results-sample.ts";

const CONFIG = {
  apiUrl: "https://flagsmith.test",
  eventsUrl: "https://events.flagsmith.test",
  adminKey: "admin-secret",
  authScheme: "Api-Key",
  projectId: "7",
  environmentKey: "ENVKEY",
};
const ENV = "/api/v1/environments/ENVKEY";
const PROJECT = "/api/v1/projects/7";
const T0 = Date.UTC(2026, 10, 15, 12, 0, 0);
const MIN_TIMESTAMP_MS = 1_577_836_800_000;
const CARD_IDS = { A: "card-a", B: "card-b", C: "card-c" };

/* ------------------------------------------------------------------ */
/* Fake Flagsmith server                                                */
/* ------------------------------------------------------------------ */

function fakeFlagsmith(opts = {}) {
  const clock = { t: T0 };
  const calls = [];
  const db = {
    seq: 100,
    features: [], // {id, name, type, is_archived, multivariate_options: [{id, key, string_value, ...}]}
    states: [], // env default: {id, feature, enabled, feature_state_value, multivariate_feature_state_values: [{id, multivariate_feature_option, percentage_allocation}]}
    metrics: [...(opts.metrics ?? [])],
    experiments: [], // {id, feature, status, started_at, refreshRequestedAt}
    events: [],
    results: opts.results ?? SAMPLE_RESULTS_PENDING,
    v2: opts.v2 === true,
  };
  const nextId = () => ++db.seq;
  const fail = opts.fail ?? {}; // "METHOD /path-suffix" or "METHOD ~regex" -> forced status

  const json = (status, body) => ({ status, json: body });
  const feature = (id) => db.features.find((f) => f.id === Number(id));
  const stateFor = (fid) => db.states.find((s) => s.feature === Number(fid));
  const experiment = (id) => db.experiments.find((e) => e.id === Number(id));

  function route(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    const key = `${req.method} ${path}`;
    for (const [pattern, status] of Object.entries(fail)) {
      // "METHOD /path/suffix" (suffix match) or "METHOD ~regex".
      const [method, target] = pattern.split(" ");
      const hit = target.startsWith("~") ? new RegExp(target.slice(1)).test(path) : path.endsWith(target);
      if (req.method === method && hit) return json(status, { detail: `forced ${status}` });
    }

    if (url.origin === CONFIG.eventsUrl || path === "/api/v1/events/") {
      if (req.headers["X-Environment-Key"] !== "ENVKEY") return json(401, { detail: "bad key" });
      let accepted = 0;
      const rejected = [];
      (req.body?.events ?? []).forEach((e, index) => {
        const errors = {};
        if (!Number.isInteger(e.timestamp) || e.timestamp <= MIN_TIMESTAMP_MS) errors.timestamp = ["Timestamp must be after 2020-01-01."];
        if (e.event === "$flag_exposure" && (e.feature_name === undefined || e.feature_name === null)) {
          errors.feature_name = ["Required for $flag_exposure events."];
        }
        if (typeof e.event === "string" && e.event.startsWith("$") && e.event !== "$flag_exposure") errors.event = ["The `$` prefix is reserved."];
        if (Object.keys(errors).length) rejected.push({ index, errors });
        else {
          accepted++;
          db.events.push(e);
        }
      });
      return json(accepted ? 202 : 400, { accepted, rejected });
    }

    if (key === "POST /api/v1/identities/") {
      const flags = db.features
        .filter((f) => !f.is_archived)
        .map((f) => {
          const variant = opts.variantFor ? opts.variantFor(req.body.identifier, f) : "control";
          const exp = db.experiments.find((e) => e.feature === f.id && e.status === "running");
          const option = f.multivariate_options.find((o) => o.key === variant);
          return {
            feature: { id: f.id, name: f.name, type: f.type },
            enabled: true,
            feature_state_value: option ? option.string_value : stateFor(f.id)?.feature_state_value,
            variant,
            ...(exp ? { metadata: { experiment: { id: exp.id, name: "x", in_experiment: true } } } : {}),
          };
        });
      return json(200, { identifier: req.body.identifier, flags, traits: req.body.traits });
    }

    // ---- features ----
    if (key === `POST ${PROJECT}/features/`) {
      const name = req.body.name;
      if (db.features.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
        return json(400, { name: ["Feature with that name already exists for this project."] });
      }
      const f = { id: nextId(), name, type: req.body.type, is_archived: false, multivariate_options: [] };
      // Nested options are accepted but `key` is read-only there: created keyless.
      for (const o of req.body.multivariate_options ?? []) {
        f.multivariate_options.push({ id: nextId(), key: null, type: o.type, string_value: o.string_value, default_percentage_allocation: o.default_percentage_allocation });
      }
      db.features.push(f);
      db.states.push({
        id: nextId(),
        feature: f.id,
        enabled: req.body.default_enabled === true,
        feature_state_value: req.body.initial_value,
        multivariate_feature_state_values: f.multivariate_options.map((o) => ({ id: nextId(), multivariate_feature_option: o.id, percentage_allocation: 0 })),
      });
      return json(201, { ...f });
    }
    if (req.method === "GET" && path === `${PROJECT}/features/`) {
      const q = (url.searchParams.get("search") ?? "").toLowerCase();
      return json(200, { count: 0, next: null, results: db.features.filter((f) => f.name.toLowerCase().includes(q)).map((f) => ({ ...f })) });
    }
    let m = path.match(new RegExp(`^${PROJECT}/features/(\\d+)/mv-options/$`));
    if (m && req.method === "POST") {
      const f = feature(m[1]);
      if (!f) return json(404, { detail: "Not found." });
      const b = req.body;
      if (b.key === "control") return json(400, { key: ['"control" is a reserved variant key.'] });
      if (b.key && f.multivariate_options.some((o) => o.key === b.key)) {
        return json(400, { key: ["Multivariate option with this key already exists for the feature."] });
      }
      const o = { id: nextId(), key: b.key ?? null, type: b.type, string_value: b.string_value, default_percentage_allocation: b.default_percentage_allocation, feature: f.id };
      f.multivariate_options.push(o);
      stateFor(f.id).multivariate_feature_state_values.push({ id: nextId(), multivariate_feature_option: o.id, percentage_allocation: b.default_percentage_allocation });
      return json(201, o);
    }
    m = path.match(new RegExp(`^${PROJECT}/features/(\\d+)/$`));
    if (m) {
      const f = feature(m[1]);
      if (!f) return json(404, { detail: "Not found." });
      if (req.method === "GET") return json(200, { ...f });
      if (req.method === "PATCH") {
        if ("is_archived" in req.body) f.is_archived = req.body.is_archived;
        return json(200, { ...f });
      }
    }

    // ---- metrics ----
    if (path === `${ENV}/experiment-metrics/`) {
      if (req.method === "GET") {
        const q = (url.searchParams.get("q") ?? "").toLowerCase();
        return json(200, { results: db.metrics.filter((x) => x.name.toLowerCase().includes(q)) });
      }
      const metric = { id: nextId(), ...req.body };
      db.metrics.push(metric);
      return json(201, metric);
    }

    // ---- experiments ----
    if (key === `POST ${ENV}/experiments/`) {
      const f = feature(req.body.feature);
      if (!f || f.type !== "MULTIVARIATE") return json(400, { feature: ["Experiments can only be created for multivariate flags."] });
      if (!req.body.experiment_rollout) return json(400, { experiment_rollout: ["This field is required."] });
      if (db.experiments.some((e) => e.feature === f.id && e.status !== "completed")) return json(409, { detail: "exists" });
      // _EnvironmentScopedMetricField: pks resolve through Metric.objects (soft-deleted rows excluded).
      for (const m of req.body.metrics ?? []) {
        if (!db.metrics.some((x) => String(x.id) === String(m.metric))) {
          return json(400, { metrics: [{ metric: [`Invalid pk "${m.metric}" - object does not exist.`] }] });
        }
      }
      const e = { id: nextId(), feature: f.id, status: "created", started_at: null, refreshRequestedAt: null, body: req.body };
      db.experiments.push(e);
      return json(201, { id: e.id, feature: f.id, status: e.status });
    }
    m = path.match(new RegExp(`^${ENV}/experiments/(\\d+)/(start/|complete/|results/refresh/|results/)?$`));
    if (m) {
      const e = experiment(m[1]);
      if (!e) return json(404, { detail: "Not found." });
      const action = m[2] ?? "";
      if (action === "" && req.method === "GET") {
        return json(200, {
          id: e.id,
          feature: e.feature,
          status: e.status,
          rollout_decision: e.decision?.rollout_decision ?? null,
          rollout_variant: e.decision?.rollout_variant ?? null,
        });
      }
      if (action === "start/") {
        if (e.status !== "created" && e.status !== "paused") return json(400, { detail: "Unable to transition experiment status." });
        e.status = "running";
        e.started_at = clock.t;
        // The start happened on the server but the response was lost (gateway timeout).
        if (opts.startTimesOut) return json(504, { detail: "Gateway timeout" });
        return json(200, { id: e.id, status: e.status });
      }
      if (action === "complete/") {
        const d = req.body ?? {};
        if (!["control", "variant", "disable"].includes(d.rollout_decision)) return json(400, { rollout_decision: ["This field is required."] });
        const f = feature(e.feature);
        if (d.rollout_decision === "variant") {
          if (d.rollout_variant === undefined) return json(400, { rollout_variant: ["Required when rolling out a variant."] });
          if (!f.multivariate_options.some((o) => o.id === d.rollout_variant)) return json(400, { rollout_variant: ["Variant not found for the experiment's feature."] });
        } else if (d.rollout_variant !== undefined) return json(400, { rollout_variant: ["Only allowed when rolling out a variant."] });
        if (e.status !== "running" && e.status !== "paused") return json(400, { detail: "Unable to transition experiment status." });
        e.status = "completed";
        e.decision = d;
        const st = stateFor(f.id);
        for (const row of st.multivariate_feature_state_values) {
          row.percentage_allocation = d.rollout_decision === "variant" && row.multivariate_feature_option === d.rollout_variant ? 100 : 0;
        }
        return json(200, { id: e.id, status: e.status, rollout_decision: d.rollout_decision });
      }
      if (action === "results/refresh/") {
        if (!e.started_at) return json(400, { detail: "Cannot refresh results before the experiment starts." });
        if (e.refreshRequestedAt !== null && clock.t - e.refreshRequestedAt < 5 * 60 * 1000) {
          return json(429, { detail: "A refresh was requested recently. Try again later." });
        }
        e.refreshRequestedAt = clock.t;
        return json(202, null);
      }
      if (action === "results/") return json(200, db.results);
    }

    // ---- feature states ----
    if (req.method === "GET" && path === `${ENV}/featurestates/`) {
      const st = stateFor(url.searchParams.get("feature"));
      return json(200, { results: st ? [structuredClone(st)] : [] });
    }
    m = path.match(new RegExp(`^${ENV}/featurestates/(\\d+)/$`));
    if (m) {
      const st = db.states.find((s) => s.id === Number(m[1]));
      if (!st) return json(404, { detail: "Not found." });
      if (db.v2) {
        return json(400, { detail: "This environment uses v2 feature versioning. Use the environment feature version endpoint instead." });
      }
      const b = req.body;
      if ("enabled" in b) st.enabled = b.enabled;
      if ("feature_state_value" in b) st.feature_state_value = b.feature_state_value;
      if (req.method === "PUT" && Array.isArray(b.multivariate_feature_state_values)) {
        // drf-writable-nested: ids update in place, missing ids create, rows left out are deleted.
        st.multivariate_feature_state_values = b.multivariate_feature_state_values.map((row) => {
          const existing = row.id !== undefined ? st.multivariate_feature_state_values.find((r) => r.id === row.id) : undefined;
          return existing ? { ...existing, ...row } : { ...row, id: nextId() };
        });
      }
      // PATCH: FeatureStateSerializerCreate has fields (feature, enabled) only; mv values are silently dropped.
      return json(200, structuredClone(st));
    }

    return json(404, { detail: `no route ${key}` });
  }

  const http = async (req) => {
    const url = new URL(req.url);
    calls.push({ method: req.method, url: req.url, path: url.pathname + url.search, headers: req.headers, body: structuredClone(req.body) });
    return route(req);
  };
  return { http, calls, db, clock };
}

function setup(opts = {}, config = CONFIG) {
  const server = fakeFlagsmith(opts);
  const fs = createFlagsmith({ config, http: server.http, store: createMemoryStore(), now: () => server.clock.t });
  return { ...fs, ...server };
}

const called = (calls, method, pathPart) => calls.filter((c) => c.method === method && c.path.includes(pathPart));
const quiet = { info() {}, warn() {}, error() {} };
const recorder = () => {
  const lines = [];
  return { lines, info: (...a) => lines.push(["info", ...a]), warn: (...a) => lines.push(["warn", ...a]), error: (...a) => lines.push(["error", ...a]) };
};

const INPUT = {
  deckId: "x",
  flagName: "deck_x",
  variantKeys: ["A", "B", "C"],
  variantValues: { A: "Speak your sales", B: "Your ledger, by voice", C: "Talk. Done." },
};

/** Publish through the real wrapper against the fake server: returns the experiment plus server handles. */
async function published(opts = {}) {
  const s = setup(opts);
  const out = await s.admin.launchDeckExperiment(INPUT);
  return { ...s, out };
}

/* ------------------------------------------------------------------ */

describe("config", () => {
  it("events go to the events host by default, ms timestamps only (no unit option)", () => {
    const c = loadConfig({});
    assert.equal(c.eventsUrl, "https://events.api.flagsmith.com");
    assert.equal("timestampUnit" in c, false);
    assert.equal(eventsEndpoint(c), "https://events.api.flagsmith.com/v1/events");
    assert.equal(eventsEndpoint(loadConfig({ FLAGSMITH_EVENTS_URL: "https://e.example/" })), "https://e.example/v1/events");
  });

  it("FLAGSMITH_EVENTS_URL equal to the core API URL uses the core /api/v1/events/ route", () => {
    const c = loadConfig({ FLAGSMITH_API_URL: "https://fs.example", FLAGSMITH_EVENTS_URL: "https://fs.example/" });
    assert.equal(eventsEndpoint(c), "https://fs.example/api/v1/events/");
  });

  it("a self-hosted FLAGSMITH_API_URL without FLAGSMITH_EVENTS_URL posts events to its own core route, not Cloud", () => {
    const self = loadConfig({ FLAGSMITH_API_URL: "https://flagsmith.corp.example/" });
    assert.equal(self.eventsUrl, "https://flagsmith.corp.example");
    assert.equal(eventsEndpoint(self), "https://flagsmith.corp.example/api/v1/events/");
    // Cloud hosts (regional or not) keep the dedicated events host.
    for (const api of ["https://api.flagsmith.com", "https://edge.api.flagsmith.com/"]) {
      assert.equal(eventsEndpoint(loadConfig({ FLAGSMITH_API_URL: api })), "https://events.api.flagsmith.com/v1/events", api);
    }
    // An explicit FLAGSMITH_EVENTS_URL always wins.
    const explicit = loadConfig({ FLAGSMITH_API_URL: "https://flagsmith.corp.example", FLAGSMITH_EVENTS_URL: "https://ev.corp.example" });
    assert.equal(eventsEndpoint(explicit), "https://ev.corp.example/v1/events");
  });
});

describe("not configured", () => {
  it("admin methods throw FlagsmithNotConfigured when the admin key is unset", async () => {
    const { admin, calls } = setup({}, { ...CONFIG, adminKey: undefined });
    await assert.rejects(() => admin.startExperiment("1"), FlagsmithNotConfigured);
    await assert.rejects(
      () => admin.createDeckExperiment(INPUT),
      (e) => e instanceof FlagsmithNotConfigured && e.missing.includes("FLAGSMITH_ADMIN_API_KEY"),
    );
    assert.equal(calls.length, 0);
  });

  it("client methods throw when the environment key is unset", async () => {
    const { client } = setup({}, { ...CONFIG, environmentKey: undefined });
    await assert.rejects(() => client.getPlatformFlags(), FlagsmithNotConfigured);
  });
});

describe("weights", () => {
  it("equalWeights sums to 100 with control taking the remainder", () => {
    assert.deepEqual(equalWeights(["A", "B", "C"]), { B: 33.33, C: 33.33, A: 33.34 });
    assert.deepEqual(equalWeights(["A", "B"]), { B: 50, A: 50 });
  });

  it("winnerTakesAll gives 100/0 and rejects unknown keys", () => {
    assert.deepEqual(winnerTakesAll(["A", "B", "C"], "B"), { A: 0, B: 100, C: 0 });
    assert.throws(() => winnerTakesAll(["A", "B"], "Z"), FlagsmithInvalidInput);
  });

  it("toStateValues lists every non-control option, carries row ids, and validates the sum", () => {
    const values = toStateValues({ B: 101, C: 102 }, "A", { A: 0, B: 100, C: 0 }, { 101: 9001 });
    assert.deepEqual(values, [
      { id: 9001, multivariate_feature_option: 101, percentage_allocation: 100 },
      { multivariate_feature_option: 102, percentage_allocation: 0 },
    ]);
    assert.throws(() => toStateValues({ B: 101 }, "A", { A: 10, B: 10 }), FlagsmithInvalidInput);
    assert.throws(() => toStateValues({ B: 101 }, "A", { B: 100 }), FlagsmithInvalidInput);
  });

  it("rolloutDecisionFor: control -> control; a challenger -> variant + its option id", () => {
    assert.deepEqual(rolloutDecisionFor("A", "A", { B: 1 }), { rollout_decision: "control" });
    assert.deepEqual(rolloutDecisionFor("A", "B", { B: 1 }), { rollout_decision: "variant", rollout_variant: 1 });
    assert.throws(() => rolloutDecisionFor("A", "C", { B: 1 }), FlagsmithInvalidInput);
  });
});

describe("results parser (real ResultsSummary shape)", () => {
  it("a card missing from the payload (no exposures) is 0 identities, so the deck is still collecting", () => {
    const decided = structuredClone(SAMPLE_RESULTS_DECIDED);
    delete decided.results.payload.metrics[0].variants.C;
    delete decided.results.payload.metrics[0].inference.C;
    const results = toFlagsmithResults(parseExperimentResults("5", decided, { metricId: "3" }), {
      flagName: "deck_x",
      cardIds: CARD_IDS,
      controlKey: "A",
    });
    assert.deepEqual(results.cards.find((c) => c.variantKey === "C"), { cardId: "card-c", variantKey: "C", identities: 0, chanceToBeatControl: 0 });
    assert.equal(decideDeck(results, "A").status, "collecting");
  });

  it("returns null until computed", () => {
    assert.equal(parseExperimentResults("5", SAMPLE_RESULTS_PENDING), null);
    assert.equal(parseExperimentResults("5", null), null);
    assert.equal(parseExperimentResults("5", "x"), null);
  });

  it("selects the metric by metric_id (not position) and reads n, sum and inference", () => {
    const parsed = parseExperimentResults("5", SAMPLE_RESULTS_MIDTEST, { metricId: String(SAMPLE_METRIC_IDS.reward_claim) });
    assert.equal(parsed.metricId, String(SAMPLE_METRIC_IDS.reward_claim));
    assert.deepEqual(parsed.variants.map((v) => v.key), ["control", "B", "C"]);
    const b = parsed.variants.find((v) => v.key === "B");
    assert.deepEqual([b.identities, b.conversions, b.chanceToBeatControl, b.lift], [71, 14, 0.91, 0.61]);
    assert.deepEqual(b.credibleInterval, [-0.04, 1.4]);
    const control = parsed.variants[0];
    assert.equal(control.isControl, true);
    assert.equal(control.chanceToBeatControl, null);
    assert.equal(parsed.srmWarning, false);
    assert.equal(parsed.computedAt.toISOString(), "2026-11-15T13:10:00.000Z");
    // The other metric would give a different answer: proves selection by id.
    const other = parseExperimentResults("5", SAMPLE_RESULTS_MIDTEST, { metricId: String(SAMPLE_METRIC_IDS.answer_positive) });
    assert.equal(other.variants.find((v) => v.key === "B").chanceToBeatControl, 0.7);
    assert.equal(parseExperimentResults("5", SAMPLE_RESULTS_MIDTEST, { metricId: "999" }), null);
  });

  it("chi-square survival matches the 0.001 critical values for df 1 to 3 (stats.py port)", () => {
    for (const [stat, df] of [[10.828, 1], [13.816, 2], [16.266, 3]]) {
      assert.ok(Math.abs(chiSquaredSurvival(stat, df) - 0.001) < 2e-5, `df ${df}: ${chiSquaredSurvival(stat, df)}`);
    }
    assert.ok(Math.abs(chiSquaredSurvival(3.841, 1) - 0.05) < 1e-4);
    assert.ok(Math.abs(chiSquaredSurvival(5.991, 2) - 0.05) < 1e-4);
    assert.equal(chiSquaredSurvival(0, 2), 1);
    assert.equal(srmPValue({ control: 10, B: 10 }, { control: 0, B: 1 }), null, "a share <= 0 gives null, as upstream");
    assert.equal(srmPValue({}, { control: 1, B: 1 }), null);
  });

  it("SRM: Flagsmith reports srm_p_value null for our experiments, so the split is checked locally from n", () => {
    const srm = parseExperimentResults("5", SAMPLE_RESULTS_SRM, { metricId: "3" });
    assert.equal(SAMPLE_RESULTS_SRM.results.payload.srm_p_value, null);
    assert.equal(srm.srmWarning, true);
    assert.equal(srm.srmSource, "local");
    assert.ok(srm.srmPValue < 1e-9);
    // Balanced samples do not trip it; too little data (< 100 identities) is never judged.
    for (const ok of [SAMPLE_RESULTS_DECIDED, SAMPLE_RESULTS_MIDTEST]) {
      const p = parseExperimentResults("5", ok, { metricId: "3" });
      assert.equal(p.srmWarning, false);
      assert.equal(p.srmSource, "local");
    }
    const small = parseExperimentResults("5", SAMPLE_RESULTS_SMALL, { metricId: "3" });
    assert.deepEqual([small.srmWarning, small.srmPValue, small.srmSource], [false, null, null]);
  });

  it("SRM: a card with no exposures at all counts as 0 against the configured split", () => {
    const missing = structuredClone(SAMPLE_RESULTS_DECIDED);
    missing.results.payload.metrics[0].variants = { control: { n: 70, sum: 8, sum_squares: 8 }, B: { n: 66, sum: 21, sum_squares: 21 } };
    const shares = { control: 1, B: 1, C: 1 };
    assert.equal(parseExperimentResults("5", missing, { metricId: "3", expectedShares: shares }).srmWarning, true);
    // Without the configured split only the payload's keys are compared, which looks balanced.
    assert.equal(parseExperimentResults("5", missing, { metricId: "3" }).srmWarning, false);
  });

  it("SRM: a non-null srm_p_value from Flagsmith is honoured", () => {
    const srm = parseExperimentResults("5", SAMPLE_RESULTS_SRM_FROM_FLAGSMITH, { metricId: "3" });
    assert.deepEqual([srm.srmWarning, srm.srmPValue, srm.srmSource], [true, 0.0002, "flagsmith"]);
  });

  it("maps 'control' to the control card (variantKey and cardId)", () => {
    const parsed = parseExperimentResults("5", SAMPLE_RESULTS_DECIDED, { metricId: "3" });
    const results = toFlagsmithResults(parsed, { flagName: "deck_x", cardIds: CARD_IDS, controlKey: "A" });
    assert.deepEqual(
      results.cards.map((c) => [c.variantKey, c.cardId, c.identities, c.chanceToBeatControl]),
      [["A", "card-a", 64, 0], ["B", "card-b", 66, 0.972], ["C", "card-c", 61, 0.41]],
    );
    // Without an explicit control key, the first card key in sort order is control.
    assert.equal(toFlagsmithResults(parsed, { flagName: "f", cardIds: { B: "b", A: "a" } }).cards[0].variantKey, "A");
  });
});

describe("decision uses the shared rules on Flagsmith's numbers", () => {
  const ctx = { flagName: "deck_x", cardIds: CARD_IDS, controlKey: "A" };
  const decide = (payload) => decideDeck(toFlagsmithResults(parseExperimentResults("5", payload, { metricId: "3" }), ctx), "A");

  it("decided at >=95%, >=50 identities, no SRM", () => {
    const d = decide(SAMPLE_RESULTS_DECIDED);
    assert.equal(d.status, "decided");
    assert.equal(d.winner.variantKey, "B");
    assert.equal(d.winner.cardId, "card-b");
  });
  it("SRM blocks a result (local check; it can only block, never call a winner)", () => assert.equal(decide(SAMPLE_RESULTS_SRM).status, "too_close"));
  it("91% is too close to call", () => assert.equal(decide(SAMPLE_RESULTS_MIDTEST).status, "too_close"));
  it("under 50 identities (no inference yet) is collecting", () => assert.equal(decide(SAMPLE_RESULTS_SMALL).status, "collecting"));
});

describe("results refresh", () => {
  it("refreshes at most once per 5 minutes per experiment, then reads results", async () => {
    const { admin, calls, clock, out, db } = await published({ results: SAMPLE_RESULTS_DECIDED });
    db.metrics.find((x) => x.name === "reward_claim").id = 3; // the sample payload's metric id
    const ctx = { flagName: "deck_x", cardIds: CARD_IDS, controlKey: "A", rewardMetricId: "3" };
    const first = await admin.getExperimentResults(out.experimentId, ctx);
    assert.equal(first.refreshed, true);
    assert.equal(first.results.cards.find((c) => c.variantKey === "B").cardId, "card-b");

    clock.t += 4 * 60 * 1000;
    const second = await admin.getExperimentResults(out.experimentId, ctx);
    assert.equal(second.refreshed, false);
    assert.equal(second.refreshSkipped, "guard");
    assert.equal(second.nextRefreshAt.getTime(), T0 + 5 * 60 * 1000);
    assert.equal(called(calls, "POST", "/results/refresh/").length, 1);
  });

  it("a 429 (Flagsmith's own throttle) and a 400 (not started) are non-fatal: the GET still runs", async () => {
    const { admin, out } = await published({ results: SAMPLE_RESULTS_DECIDED });
    const ctx = { flagName: "deck_x", cardIds: CARD_IDS, controlKey: "A", rewardMetricId: "3", force: true };
    await admin.getExperimentResults(out.experimentId, ctx);
    const throttled = await admin.getExperimentResults(out.experimentId, ctx);
    assert.equal(throttled.refreshed, false);
    assert.equal(throttled.refreshSkipped, "429");
    assert.ok(throttled.results, "still reads the last computed results");

    const s = setup({ results: SAMPLE_RESULTS_PENDING });
    const created = await s.admin.createDeckExperiment(INPUT); // not started
    const early = await s.admin.getExperimentResults(created.experimentId, { ...ctx, rewardMetricId: undefined });
    assert.equal(early.refreshSkipped, "400");
    assert.equal(early.results, null);
  });

  it("getExperimentResults checks SRM against every card of the deck (fake server: srm_p_value null)", async () => {
    const missing = structuredClone(SAMPLE_RESULTS_DECIDED);
    delete missing.results.payload.metrics[0].variants.C;
    missing.results.payload.metrics[0].variants.control.n = 120;
    missing.results.payload.metrics[0].variants.B.n = 118;
    const { admin, out } = await published({ results: missing });
    const ctx = { flagName: "deck_x", cardIds: CARD_IDS, controlKey: "A", rewardMetricId: "3", force: true };
    const r = await admin.getExperimentResults(out.experimentId, ctx);
    assert.equal(r.parsed.srmWarning, true, "C got nothing on a 3-way split");
    assert.equal(r.results.srmWarning, true);
  });

  it("a 5xx on refresh is still an error", async () => {
    const { admin, out } = await published({ fail: { "POST /results/refresh/": 503 } });
    await assert.rejects(() => admin.getExperimentResults(out.experimentId, { flagName: "deck_x", cardIds: CARD_IDS, force: true }), FlagsmithApiError);
  });

  it("without a stored metric id, reward_claim's id is looked up by event (read only, nothing created)", async () => {
    const { out, db, http, calls, clock } = await published({ results: SAMPLE_RESULTS_MIDTEST });
    db.metrics.find((x) => x.name === "reward_claim").id = SAMPLE_METRIC_IDS.reward_claim;
    db.metrics.find((x) => x.name === "answer_positive").id = SAMPLE_METRIC_IDS.answer_positive;
    // A fresh process: no cached metric ids.
    const { admin } = createFlagsmith({ config: CONFIG, http, store: createMemoryStore(), now: () => clock.t });
    const before = db.metrics.length;
    const r = await admin.getExperimentResults(out.experimentId, { flagName: "deck_x", cardIds: CARD_IDS, controlKey: "A", force: true });
    assert.equal(r.parsed.metricId, String(SAMPLE_METRIC_IDS.reward_claim));
    assert.equal(r.results.cards.find((c) => c.variantKey === "B").chanceToBeatControl, 0.91);
    assert.equal(db.metrics.length, before);
    assert.ok(called(calls, "GET", "/experiment-metrics/?q=reward_claim").length >= 1);
  });

  it("guard is per experiment", async () => {
    const guard = new RefreshGuard(createMemoryStore(), 1000, () => 0);
    await guard.mark("a");
    assert.equal((await guard.check("a")).allowed, false);
    assert.equal((await guard.check("b")).allowed, true);
  });
});

describe("publish: create flag, keyed options, metrics, experiment, start", () => {
  it("creates the flag WITHOUT nested options, then one keyed mv-option per challenger", async () => {
    const { calls, out, db } = await published();
    const create = called(calls, "POST", `${PROJECT}/features/`).find((c) => c.path === `${PROJECT}/features/`);
    assert.equal(create.body.initial_value, "Speak your sales");
    assert.equal(create.body.type, "MULTIVARIATE");
    assert.equal("multivariate_options" in create.body, false);

    const options = called(calls, "POST", "/mv-options/");
    assert.deepEqual(options.map((c) => [c.body.key, c.body.string_value, c.body.type, c.body.default_percentage_allocation]), [
      ["B", "Your ledger, by voice", "unicode", 0],
      ["C", "Talk. Done.", "unicode", 0],
    ]);
    const f = db.features.find((x) => x.name === "deck_x");
    assert.deepEqual(f.multivariate_options.map((o) => o.key), ["B", "C"], "keys exist on the server");
    assert.deepEqual(out.optionIds, Object.fromEntries(f.multivariate_options.map((o) => [o.key, o.id])));
    assert.ok(calls.every((c) => c.headers.Authorization === "Api-Key admin-secret"));
  });

  it("creates the metrics, the experiment at 100% rollout with an equal split, and starts it", async () => {
    const { calls, out, db } = await published();
    assert.deepEqual(db.metrics.map((x) => [x.name, x.aggregation, x.direction, x.definition.event]), [
      ["reward_claim", "occurrence", "up", "reward_claim"],
      ["answer_positive", "occurrence", "up", "answer_positive"],
    ]);
    const exp = called(calls, "POST", `${ENV}/experiments/`).find((c) => c.path === `${ENV}/experiments/`).body;
    assert.equal(exp.experiment_rollout.rollout_percentage, 100);
    assert.deepEqual(exp.experiment_rollout.feature_state_value, { type: "string", value: "Speak your sales" });
    assert.deepEqual(
      exp.experiment_rollout.multivariate_feature_state_values.map((v) => [v.multivariate_feature_option, v.percentage_allocation]),
      [[out.optionIds.B, 33.33], [out.optionIds.C, 33.33]],
    );
    assert.deepEqual(exp.metrics.map((x) => x.expected_direction), ["increase", "increase"]);
    assert.equal(exp.metrics[0].metric, Number(out.rewardMetricId));
    assert.equal(db.experiments[0].status, "running");
    assert.equal(out.experimentId, String(db.experiments[0].id));
    assert.equal(out.flagName, "deck_x");
  });

  it("reuses existing metrics (matched by definition.event)", async () => {
    const { out, db } = await published({
      metrics: [{ id: 3, name: "reward_claim", aggregation: "occurrence", direction: "up", definition: { version: 1, event: "reward_claim" } }],
    });
    assert.equal(out.rewardMetricId, "3");
    assert.equal(db.metrics.filter((x) => x.name === "reward_claim").length, 1);
  });

  it("rejects bad variant sets before any network call (2 to 4 cards, 'control' reserved)", async () => {
    const { admin, calls } = setup();
    for (const variantKeys of [["A"], ["A", "A"], ["A", "B C"], ["A", "B", "C", "D", "E"], ["A", "control"]]) {
      await assert.rejects(() => admin.createDeckExperiment({ ...INPUT, variantKeys }), FlagsmithInvalidInput);
    }
    assert.equal(calls.length, 0);
    // Four price cards are allowed.
    const four = await setup().admin.launchDeckExperiment({ ...INPUT, variantKeys: ["A", "B", "C", "D"], variantValues: undefined });
    assert.deepEqual(Object.keys(four.optionIds), ["B", "C", "D"]);
  });

  it("any failure archives the half-made flag and says where it failed", async () => {
    for (const [pattern, step] of [
      ["POST /mv-options/", "adding the card options"],
      ["POST /experiment-metrics/", "setting up the metrics"],
      [`POST ${ENV}/experiments/`, "creating the experiment"],
      ["POST /start/", "starting the experiment"],
    ]) {
      const s = setup({ fail: { [pattern]: 403 } });
      const error = await s.admin.launchDeckExperiment(INPUT).then(
        () => null,
        (e) => e,
      );
      assert.ok(error instanceof FlagsmithPublishError, pattern);
      assert.equal(error.step, step);
      assert.equal(error.cleanedUp, true);
      assert.equal(error.safeReason, `Flagsmith failed while ${step} (HTTP 403)`);
      assert.deepEqual(s.db.features.map((f) => [f.name, f.is_archived]), [["deck_x", true]], pattern);
    }
  });

  it("a start whose response was lost but which ran on the server is a success (no orphaned running experiment)", async () => {
    const s = setup({ startTimesOut: true });
    const out = await s.admin.launchDeckExperiment(INPUT);
    assert.equal(s.db.experiments[0].status, "running");
    assert.equal(s.db.features[0].is_archived, false);
    assert.equal(out.experimentId, String(s.db.experiments[0].id));
  });

  it("when the cleanup archive also fails, the error carries the orphaned feature id", async () => {
    const s = setup({ fail: { "POST /mv-options/": 403, "PATCH ~/features/[0-9]+/$": 500 } });
    const error = await s.admin.launchDeckExperiment(INPUT).then(() => null, (e) => e);
    assert.ok(error instanceof FlagsmithPublishError);
    assert.equal(error.cleanedUp, false);
    assert.equal(error.orphanFeatureId, s.db.features[0].id);
  });

  it("metric ids are not cached: a metric deleted in the dashboard is re-created on the next publish", async () => {
    const s = setup();
    await s.admin.launchDeckExperiment(INPUT);
    s.db.metrics.length = 0; // soft-deleted in the dashboard
    const out = await s.admin.launchDeckExperiment({ ...INPUT, flagName: "deck_y" });
    assert.equal(out.flagName, "deck_y");
    assert.ok(s.db.metrics.some((m) => String(m.id) === out.rewardMetricId));
  });

  it("a retry after a failed attempt archives the old flag and uses a fresh name: no live duplicates", async () => {
    const s = setup({ fail: { "POST /start/": 500 } });
    await assert.rejects(() => s.admin.launchDeckExperiment(INPUT), FlagsmithPublishError);
    // Second attempt on the same server, start works now.
    const ok = setup();
    ok.db.features.push(...s.db.features);
    ok.db.states.push(...s.db.states);
    ok.db.seq = s.db.seq;
    const out = await ok.admin.launchDeckExperiment(INPUT);
    assert.match(out.flagName, /^deck_x_r[0-9a-z]+$/);
    const live = ok.db.features.filter((f) => !f.is_archived);
    assert.deepEqual(live.map((f) => f.name), [out.flagName]);

    // A leftover that is still live (e.g. the deck save failed after a successful publish) is archived too.
    const leftover = setup();
    await leftover.admin.launchDeckExperiment(INPUT);
    const again = await leftover.admin.launchDeckExperiment(INPUT);
    assert.notEqual(again.flagName, "deck_x");
    assert.equal(leftover.db.features.filter((f) => !f.is_archived).length, 1);
  });
});

describe("deck hooks (src/lib/decks/integration.ts)", () => {
  const deck = {
    _id: "d1",
    flagName: "deck_x",
    // Input order is not control-first; the hook sorts by variant key.
    cards: [
      { variantKey: "C", value: "Talk. Done." },
      { variantKey: "A", value: "Speak your sales" },
      { variantKey: "B", value: { name: "logo", src: "/x.png" } },
    ],
  };

  it("configured + ok: returns the ids to store on the deck", async () => {
    const s = setup();
    const out = await publishToFlagsmith(deck, { demo: false, flagsmith: s.admin, log: quiet });
    assert.equal(out.flagsmithError, undefined);
    assert.equal(out.experimentId, String(s.db.experiments[0].id));
    assert.deepEqual(Object.keys(out.optionIds), ["B", "C"]);
    assert.ok(out.featureId && out.rewardMetricId);
    assert.equal(out.flagName, undefined, "same name: nothing to rename");
    // Control is A (sorted), object values are served as their variant key.
    assert.equal(called(s.calls, "POST", `${PROJECT}/features/`)[0].body.initial_value, "Speak your sales");
    assert.deepEqual(called(s.calls, "POST", "/mv-options/").map((c) => c.body.string_value), ["B", "Talk. Done."]);
  });

  it("configured + failing: flag archived, reason logged, deck still goes live with a safe reason", async () => {
    const s = setup({ fail: { [`POST ${ENV}/experiments/`]: 403 } });
    const log = recorder();
    const out = await publishToFlagsmith(deck, { demo: false, flagsmith: s.admin, log });
    assert.deepEqual(out, { flagsmithError: "Flagsmith failed while creating the experiment (HTTP 403)" });
    assert.equal(s.db.features[0].is_archived, true);
    assert.ok(log.lines.some(([level, msg]) => level === "error" && /local split/.test(msg)));
  });

  it("failing + cleanup failing: returns the orphan feature id; archiving the deck later archives it", async () => {
    const s = setup({ fail: { "POST /mv-options/": 403, "PATCH ~/features/[0-9]+/$": 500 } });
    const out = await publishToFlagsmith(deck, { demo: false, flagsmith: s.admin, log: quiet });
    assert.equal(out.orphanFeatureId, s.db.features[0].id);
    assert.equal(out.experimentId, undefined);
    // The deck stores it as featureId (service.ts); archive then reaches it once Flagsmith answers again.
    const ok = setup();
    ok.db.features.push(...s.db.features);
    await archiveOnFlagsmith({ ...deck, status: "live", featureId: out.orphanFeatureId }, { demo: false, flagsmith: ok.admin, log: quiet });
    assert.equal(ok.db.features[0].is_archived, true);
  });

  it("archive keeps the flag of a shipped deck or a completed experiment (it serves the winner / control)", async () => {
    const s = setup();
    const out = await publishToFlagsmith(deck, { demo: false, flagsmith: s.admin, log: quiet });
    await archiveOnFlagsmith({ ...deck, ...out, status: "shipped" }, { demo: false, flagsmith: s.admin, log: quiet });
    assert.equal(s.db.features[0].is_archived, false);
    assert.equal(called(s.calls, "PATCH", "/features/").length, 0);
    // Undone ship: deck back to "decided", experiment completed -> still kept.
    s.db.experiments[0].status = "completed";
    await archiveOnFlagsmith({ ...deck, ...out, status: "decided" }, { demo: false, flagsmith: s.admin, log: quiet });
    assert.equal(s.db.features[0].is_archived, false);
  });

  it("archive fails closed: when the experiment cannot be read, the flag is kept and the failure logged", async () => {
    const s = setup({ fail: { "GET ~/experiments/[0-9]+/$": 503 } });
    const out = await publishToFlagsmith(deck, { demo: false, flagsmith: s.admin, log: quiet });
    assert.ok(out.experimentId);
    const log = recorder();
    await archiveOnFlagsmith({ ...deck, ...out, status: "decided" }, { demo: false, flagsmith: s.admin, log });
    assert.equal(s.db.features[0].is_archived, false);
    assert.equal(called(s.calls, "PATCH", "/features/").length, 0);
    assert.ok(log.lines.some(([level, msg]) => level === "error" && /NOT archived/.test(msg)));
  });

  it("demo mode and not configured never call Flagsmith", async () => {
    const s = setup();
    assert.deepEqual(await publishToFlagsmith(deck, { demo: true, flagsmith: s.admin }), {});
    assert.deepEqual(await publishToFlagsmith(deck, { demo: false, flagsmith: null }), {});
    await archiveOnFlagsmith({ ...deck, experimentId: "1", featureId: 5 }, { demo: true, flagsmith: s.admin });
    assert.equal(s.calls.length, 0);
  });

  it("archive: PATCH is_archived by feature id, leaves the experiment, and never throws", async () => {
    const s = setup();
    const out = await publishToFlagsmith(deck, { demo: false, flagsmith: s.admin, log: quiet });
    await archiveOnFlagsmith({ ...deck, ...out, status: "live" }, { demo: false, flagsmith: s.admin, log: quiet });
    assert.equal(s.db.features[0].is_archived, true);
    assert.equal(s.db.experiments[0].status, "running");

    const broken = setup({ fail: { "PATCH ~/features/[0-9]+/$": 500 } });
    const brokenOut = await publishToFlagsmith(deck, { demo: false, flagsmith: broken.admin, log: quiet });
    const log = recorder();
    await archiveOnFlagsmith({ ...deck, ...brokenOut, status: "live" }, { demo: false, flagsmith: broken.admin, log });
    assert.ok(log.lines.some(([level, msg]) => level === "error" && /could not archive/.test(msg)));

    const none = setup();
    await archiveOnFlagsmith(deck, { demo: false, flagsmith: none.admin }); // local split: no flag
    assert.equal(none.calls.length, 0);
  });
});

describe("ship winner and undo", () => {
  it("snapshots, completes with {rollout_decision: variant, rollout_variant}, then PUTs the winning text with row ids", async () => {
    const { admin, calls, db, out } = await published();
    const before = structuredClone(db.states[0].multivariate_feature_state_values);
    const { snapshot, weights, complete } = await admin.shipWinner({
      flagName: "deck_x",
      experimentId: out.experimentId,
      variantKeys: ["A", "B", "C"],
      winnerKey: "B",
      winnerValue: "Your ledger, by voice",
      optionIds: out.optionIds,
    });
    assert.deepEqual(weights, { A: 0, B: 100, C: 0 });
    assert.equal(complete.alreadyCompleted, false);
    assert.equal(snapshot.featureStateValue, "Speak your sales");
    assert.deepEqual(snapshot.multivariate, before);

    const completeCall = called(calls, "POST", "/complete/")[0];
    assert.deepEqual(completeCall.body, { rollout_decision: "variant", rollout_variant: out.optionIds.B });
    assert.equal(db.experiments[0].status, "completed");

    assert.equal(called(calls, "PATCH", "/featurestates/").length, 0, "PATCH would drop the mv values");
    const put = called(calls, "PUT", "/featurestates/")[0];
    assert.equal(put.body.feature_state_value, "Your ledger, by voice");
    assert.deepEqual(
      put.body.multivariate_feature_state_values.map((r) => [r.id, r.multivariate_feature_option, r.percentage_allocation]),
      before.map((r) => [r.id, r.multivariate_feature_option, r.multivariate_feature_option === out.optionIds.B ? 100 : 0]),
    );
    // Rows were updated in place, not duplicated.
    assert.deepEqual(db.states[0].multivariate_feature_state_values.map((r) => r.id), before.map((r) => r.id));
    assert.equal(db.states[0].feature_state_value, "Your ledger, by voice");
  });

  it("winner = control sends {rollout_decision: control} and sets every option to 0", async () => {
    const { admin, calls, db, out } = await published();
    await admin.shipWinner({ flagName: "deck_x", experimentId: out.experimentId, variantKeys: ["A", "B", "C"], winnerKey: "A" });
    assert.deepEqual(called(calls, "POST", "/complete/")[0].body, { rollout_decision: "control" });
    assert.deepEqual(db.states[0].multivariate_feature_state_values.map((r) => r.percentage_allocation), [0, 0]);
  });

  it("complete without a decision is refused before any call; a 400 counts only when already completed", async () => {
    const { admin, calls, out } = await published();
    await assert.rejects(() => admin.completeExperiment(out.experimentId), FlagsmithInvalidInput);
    await assert.rejects(() => admin.completeExperiment(out.experimentId, { rollout_decision: "variant" }), FlagsmithInvalidInput);
    assert.equal(called(calls, "POST", "/complete/").length, 0);

    // Wrong option id: Flagsmith answers 400 and the experiment is still running -> error.
    await assert.rejects(
      () => admin.completeExperiment(out.experimentId, { rollout_decision: "variant", rollout_variant: 999999 }),
      (e) => e instanceof FlagsmithApiError && e.status === 400,
    );
    const done = await admin.completeExperiment(out.experimentId, { rollout_decision: "control" });
    assert.equal(done.alreadyCompleted, false);
    // Second complete: 400 from Flagsmith, but GET shows completed -> tolerated.
    const again = await admin.completeExperiment(out.experimentId, { rollout_decision: "control" });
    assert.equal(again.alreadyCompleted, true);
  });

  it("completed in the dashboard with another decision: refused (FlagsmithCompletedDifferently), flag untouched", async () => {
    const { admin, calls, db, out } = await published();
    const e = db.experiments[0];
    e.status = "completed";
    e.decision = { rollout_decision: "disable" };
    db.states[0].enabled = false;
    const ship = { flagName: "deck_x", experimentId: out.experimentId, variantKeys: ["A", "B", "C"], winnerKey: "B", optionIds: out.optionIds };
    await assert.rejects(
      () => admin.shipWinner(ship),
      (err) => err instanceof FlagsmithCompletedDifferently && err.rolloutDecision === "disable" && /flag turned off/.test(err.message),
    );
    assert.equal(called(calls, "PUT", "/featurestates/").length, 0);
    // Another variant than ours is refused too; the same variant is "already completed".
    e.decision = { rollout_decision: "variant", rollout_variant: out.optionIds.C };
    await assert.rejects(
      () => admin.completeExperiment(out.experimentId, { rollout_decision: "variant", rollout_variant: out.optionIds.B }),
      FlagsmithCompletedDifferently,
    );
    const same = await admin.completeExperiment(out.experimentId, { rollout_decision: "variant", rollout_variant: out.optionIds.C });
    assert.equal(same.alreadyCompleted, true);
  });

  it("ship always writes enabled: true, so a flag left disabled serves the winner", async () => {
    const { admin, calls, db, out } = await published();
    db.states[0].enabled = false;
    const ship = { flagName: "deck_x", experimentId: out.experimentId, variantKeys: ["A", "B", "C"], winnerKey: "B", winnerValue: "W", optionIds: out.optionIds };
    await admin.shipWinner(ship);
    assert.equal(called(calls, "PUT", "/featurestates/")[0].body.enabled, true);
    assert.equal(db.states[0].enabled, true);
    db.states[0].enabled = false;
    await admin.setFlagWeights("deck_x", "A", { A: 0, B: 100, C: 0 }, { optionIds: out.optionIds, enabled: true });
    assert.equal(called(calls, "PUT", "/featurestates/")[1].body.enabled, true);
  });

  it("undo writes the stored snapshot back with a PUT, then forgets it", async () => {
    const { admin, calls, db, out } = await published();
    const before = structuredClone(db.states[0]);
    await admin.shipWinner({ flagName: "deck_x", experimentId: out.experimentId, variantKeys: ["A", "B", "C"], winnerKey: "B", winnerValue: "New" });
    await admin.undoShip("deck_x");
    const puts = called(calls, "PUT", "/featurestates/");
    assert.equal(puts.length, 2);
    assert.equal(db.states[0].feature_state_value, before.feature_state_value);
    assert.deepEqual(db.states[0].multivariate_feature_state_values, before.multivariate_feature_state_values);
    // What undo restores is the CONTROL card for everyone (the default kept 0% per option while the test ran),
    // not the test split, and the experiment stays completed.
    assert.equal(db.states[0].feature_state_value, "Speak your sales");
    assert.ok(db.states[0].multivariate_feature_state_values.every((r) => r.percentage_allocation === 0));
    assert.equal(db.experiments[0].status, "completed");
    await assert.rejects(() => admin.undoShip("deck_x"), FlagsmithInvalidInput);
  });

  it("undo serves control even from a snapshot taken AFTER completion (a retried ship after a lost complete response)", async () => {
    const { admin, calls, db, out } = await published();
    // Attempt 1: complete applied on the server, response lost. Attempt 2 snapshots the completed state: B at 100%.
    await admin.completeExperiment(out.experimentId, { rollout_decision: "variant", rollout_variant: out.optionIds.B });
    db.states[0].enabled = false;
    const late = await admin.snapshotFlag("deck_x");
    assert.ok(late.multivariate.some((r) => r.percentage_allocation === 100), "the late snapshot holds the winner at 100%");
    await admin.undoShip("deck_x", late);
    const put = called(calls, "PUT", "/featurestates/").at(-1);
    assert.equal(put.body.enabled, true);
    assert.equal(put.body.feature_state_value, "Speak your sales");
    assert.ok(put.body.multivariate_feature_state_values.every((r) => r.percentage_allocation === 0));
    assert.ok(db.states[0].multivariate_feature_state_values.every((r) => r.percentage_allocation === 0));
  });

  it("v2 feature versioning surfaces as a clear FlagsmithVersioningError", async () => {
    const { admin, out, db } = await published();
    db.v2 = true;
    await assert.rejects(
      () => admin.setFlagWeights("deck_x", "A", { A: 0, B: 100, C: 0 }, { optionIds: out.optionIds }),
      (e) => e instanceof FlagsmithVersioningError && /v2 feature versioning/.test(e.message),
    );
  });

  it("does not touch the flag when the winner key is unknown", async () => {
    const { admin, calls } = setup();
    await assert.rejects(
      () => admin.shipWinner({ flagName: "deck_x", experimentId: "55", variantKeys: ["A", "B"], winnerKey: "Z" }),
      FlagsmithInvalidInput,
    );
    assert.equal(calls.length, 0);
  });
});

describe("client: identities, events, exposures, platform flags", () => {
  it("assign sends <deckId>:<guid> with the source trait and reads variant + experiment metadata", async () => {
    const s = await published({ variantFor: (identifier) => (identifier.endsWith("guid-1") ? "C" : "control") });
    const out = await s.client.assign("deckX", "guid-1", "deck_x", "link");
    assert.equal(out.identifier, "deckX:guid-1");
    assert.equal(out.variant, "C");
    assert.equal(out.value, "Talk. Done.");
    assert.equal(out.inExperiment, true);
    assert.equal(out.experimentId, s.out.experimentId);
    const call = called(s.calls, "POST", "/api/v1/identities/")[0];
    assert.deepEqual(call.body, { identifier: "deckX:guid-1", traits: [{ trait_key: "source", trait_value: "link" }] });
    assert.equal(call.headers["X-Environment-Key"], "ENVKEY");
    assert.equal(call.headers.Authorization, undefined);
    assert.equal((await s.client.assign("deckX", "guid-2", "deck_x", "feed")).variant, "control");
    assert.equal((await s.client.assign("deckX", "guid-2", "missing_flag", "feed")).variant, null);
  });

  it("trackEvent posts integer ms to the events host and never sends uncounted swipes", async () => {
    const { client, calls, db } = setup();
    const base = { deckId: "deckX", swiperGuid: "g", flagName: "deck_x", event: "reward_claim", source: "feed" };
    assert.deepEqual(await client.trackEvent({ ...base, counted: false }), { sent: false, accepted: 0, rejected: [] });
    assert.equal(calls.length, 0);

    const out = await client.trackEvent({ ...base, counted: true });
    assert.equal(out.accepted, 1);
    assert.equal(calls[0].url, "https://events.flagsmith.test/v1/events");
    assert.equal(calls[0].headers["X-Environment-Key"], "ENVKEY");
    assert.deepEqual(db.events[0], { event: "reward_claim", timestamp: T0, identifier: "deckX:g", feature_name: "deck_x", traits: { source: "feed" } });
    assert.ok(Number.isInteger(db.events[0].timestamp) && db.events[0].timestamp > MIN_TIMESTAMP_MS);
  });

  it("trackExposure sends $flag_exposure with the variant key and metadata.experiment_id", async () => {
    const { client, db } = setup();
    const out = await client.trackExposure({ deckId: "deckX", swiperGuid: "g", flagName: "deck_x", variant: "control", source: "link", experimentId: "57", counted: true });
    assert.equal(out.accepted, 1);
    assert.deepEqual(db.events[0], {
      event: "$flag_exposure",
      timestamp: T0,
      identifier: "deckX:g",
      feature_name: "deck_x",
      value: "control",
      traits: { source: "link" },
      metadata: { experiment_id: 57 },
    });
    const skipped = await client.trackExposure({ deckId: "d", swiperGuid: "g", flagName: "f", variant: "B", source: "feed", counted: false });
    assert.equal(skipped.sent, false);
  });

  it("a batch with nothing accepted returns the rejections (HTTP 400 body) instead of throwing", async () => {
    const s = setup();
    s.clock.t = 1_700_000; // seconds-sized timestamp: rejected by Flagsmith
    const out = await s.client.trackEvent({ deckId: "d", swiperGuid: "g", flagName: "f", event: "answer_positive", source: "feed", counted: true });
    assert.equal(out.accepted, 0);
    assert.equal(out.rejected.length, 1);
    assert.deepEqual(Object.keys(out.rejected[0].errors), ["timestamp"]);
  });

  it("a 2xx without a numeric `accepted` counts as accepted (never suppresses the conversions)", async () => {
    const calls = [];
    const http = async (req) => (calls.push(req), { status: 202, json: { ok: true } });
    const { client } = createFlagsmith({ config: CONFIG, http, store: createMemoryStore(), now: () => T0 });
    const out = await client.trackExposure({ deckId: "d", swiperGuid: "g", flagName: "f", variant: "B", source: "feed", counted: true });
    assert.deepEqual(out, { sent: true, accepted: 1, rejected: [] });
    const empty = createFlagsmith({ config: CONFIG, http: async () => ({ status: 202, json: null }), store: createMemoryStore(), now: () => T0 });
    assert.equal((await empty.client.trackEvent({ deckId: "d", swiperGuid: "g", flagName: "f", event: "reward_claim", source: "feed", counted: true })).accepted, 1);
    const down = createFlagsmith({ config: CONFIG, http: async () => ({ status: 503, json: null }), store: createMemoryStore(), now: () => T0 });
    await assert.rejects(() => down.client.trackEvent({ deckId: "d", swiperGuid: "g", flagName: "f", event: "reward_claim", source: "feed", counted: true }), FlagsmithApiError);
  });

  it("FLAGSMITH_EVENTS_URL = core API URL posts to /api/v1/events/", async () => {
    const { client, calls } = setup({}, { ...CONFIG, eventsUrl: CONFIG.apiUrl });
    await client.trackEvent({ deckId: "d", swiperGuid: "g", flagName: "f", event: "answer_positive", source: "feed", counted: true });
    assert.equal(calls[0].url, "https://flagsmith.test/api/v1/events/");
  });

  it("parsePlatformFlags maps flags and remote config with defaults", () => {
    const flags = parsePlatformFlags([
      { feature: { name: "paid_swiping" }, enabled: false },
      { feature: { name: "boost_enabled" }, enabled: true },
      { feature: { name: "check_card_rate" }, enabled: true, feature_state_value: "10" },
    ]);
    assert.deepEqual(flags, { paid_swiping: false, boost_enabled: true, language_cards: true, assistant_ship: true, check_card_rate: 10 });
    assert.equal(parsePlatformFlags(null).check_card_rate, 20);
  });
});
