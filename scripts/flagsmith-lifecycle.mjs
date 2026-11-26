// Live smoke test of the PitchSwipe <-> Flagsmith flow against a REAL Flagsmith environment.
//
//   node --env-file=.env.local --import ./scripts/register-ts.mjs scripts/flagsmith-lifecycle.mjs --yes [--traffic 12]
//
// Needs FLAGSMITH_ADMIN_API_KEY, FLAGSMITH_PROJECT_ID, NEXT_PUBLIC_FLAGSMITH_ENV_KEY; optional FLAGSMITH_API_URL,
// FLAGSMITH_EVENTS_URL (see .env.example). Use a test environment, never production.
//
// What it writes in Flagsmith (everything else is read only):
//  - ONE throwaway flag `deck_lifecycle_<timestamp>` with its options and experiment, archived at the end;
//  - the environment metrics `reward_claim` / `answer_positive`, ONLY if they do not exist yet (the app creates
//    them on the first real publish anyway; they are reused, never duplicated);
//  - a few events for identities `deck_lifecycle_<timestamp>:lifecycle-<n>` on that flag.
//
// It runs the exact code path the app uses (src/lib/flagsmith): publish (flag, keyed mv-options, metrics,
// experiment, start) -> identity assignment (variant) -> $flag_exposure + conversions -> results refresh/read ->
// ship B (complete with rollout_decision, PUT text + weights + enabled) -> a refused second complete (same decision
// tolerated, a different one refused) -> undo (control for everyone) -> archive, printing PASS / FAIL / PENDING / INFO
// per step. Output: scripts/recorded/flagsmith-lifecycle-<timestamp>.json (no keys in it; review before committing).
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  FlagsmithApiError,
  FlagsmithCompletedDifferently,
  FlagsmithPublishError,
  FlagsmithVersioningError,
  createFlagsmith,
  eventsEndpoint,
  isAdminConfigured,
  loadConfig,
} from "../src/lib/flagsmith/index.ts";

const args = process.argv.slice(2);
const traffic = Number(args[args.indexOf("--traffic") + 1]) || 12;

if (!args.includes("--yes")) {
  console.error(
    "This creates ONE throwaway flag + experiment in the configured Flagsmith environment (and the two metrics if missing),\n" +
      "sends a few events for it, ships and undoes it, then archives the flag. Re-run with --yes to proceed.",
  );
  process.exit(2);
}

const config = loadConfig();
const { admin, client } = createFlagsmith({ config });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const flagName = `deck_lifecycle_${Date.now()}`;
const variantKeys = ["A", "B", "C"];
const variantValues = { A: "Control headline", B: "Challenger headline B", C: "Challenger headline C" };
const record = { startedAt: new Date().toISOString(), flagName, eventsEndpoint: eventsEndpoint(config), steps: {}, summary: {} };
const results = [];

function detail(error) {
  if (error instanceof FlagsmithPublishError) {
    return { step: error.step, cleanedUp: error.cleanedUp, orphanFeatureId: error.orphanFeatureId ?? null, cause: detail(error.original) };
  }
  if (error instanceof FlagsmithApiError) return { status: error.status, path: error.path, body: error.body };
  if (error instanceof FlagsmithVersioningError) return { message: error.message, body: error.body };
  return { message: String(error?.message ?? error) };
}

/** Run one step. `fn` returns {verdict?: "PASS"|"FAIL"|"PENDING"|"INFO", note?, ...data}; a throw is FAIL. */
async function step(name, fn, { fatal = true } = {}) {
  let out;
  try {
    out = (await fn()) ?? {};
  } catch (error) {
    out = { verdict: "FAIL", error: detail(error) };
  }
  const verdict = out.verdict ?? "PASS";
  record.steps[name] = { ...out, verdict };
  results.push([verdict, name]);
  const note = out.note ? `  ${out.note}` : out.error ? `  ${JSON.stringify(out.error).slice(0, 400)}` : "";
  console.log(`${verdict.padEnd(7)} ${name}${note}`);
  if (verdict === "FAIL" && fatal) throw new Error(`step failed: ${name}`);
  return out;
}

async function anonymousFlagValue() {
  const res = await fetch(`${config.apiUrl}/api/v1/flags/`, { headers: { "X-Environment-Key": config.environmentKey } });
  const flags = await res.json();
  const f = Array.isArray(flags) ? flags.find((x) => x.feature?.name === created.flagName) : undefined;
  return f ? { value: f.feature_state_value, enabled: f.enabled } : null;
}

let created;
let exitCode = 0;
try {
  await step("config", async () => {
    if (!isAdminConfigured(config)) {
      return { verdict: "FAIL", note: "set FLAGSMITH_ADMIN_API_KEY, FLAGSMITH_PROJECT_ID, NEXT_PUBLIC_FLAGSMITH_ENV_KEY" };
    }
    return { note: `api ${config.apiUrl}, events ${eventsEndpoint(config)}` };
  });

  await step("publish: flag, keyed options, metrics, experiment, start", async () => {
    created = await admin.launchDeckExperiment({ deckId: flagName, flagName, variantKeys, variantValues });
    const keys = await admin.optionIdsForFlag(created.flagName, created.featureId);
    const keyed = keys.B === created.optionIds.B && keys.C === created.optionIds.C;
    const exp = await admin.getExperiment(created.experimentId);
    const running = exp.status === "running";
    return {
      verdict: keyed && running ? "PASS" : "FAIL",
      note: `experiment ${created.experimentId} status=${exp.status}, option keys ${keyed ? "set" : "MISSING"}`,
      created,
      experiment: exp.raw,
    };
  });

  const assigned = await step(`assignment: ${traffic} identities get a variant`, async () => {
    const seen = {};
    const rows = [];
    for (let i = 0; i < traffic; i++) {
      const a = await client.assign(flagName, `lifecycle-${i}`, created.flagName, i % 2 ? "link" : "feed");
      seen[String(a.variant)] = (seen[String(a.variant)] ?? 0) + 1;
      rows.push({ guid: `lifecycle-${i}`, variant: a.variant, value: a.value, inExperiment: a.inExperiment, experimentId: a.experimentId });
    }
    const valid = rows.every((r) => r.variant === "control" || r.variant === "B" || r.variant === "C");
    const enrolled = rows.every((r) => r.inExperiment === true);
    return {
      verdict: valid ? "PASS" : "FAIL",
      note: `variants ${JSON.stringify(seen)}; metadata.in_experiment ${enrolled ? "true for all" : "NOT true for all (check rollout)"}`,
      rows,
    };
  });

  await step("events: $flag_exposure per identity", async () => {
    let accepted = 0;
    const rejected = [];
    for (const r of assigned.rows) {
      const t = await client.trackExposure({
        deckId: flagName,
        swiperGuid: r.guid,
        flagName: created.flagName,
        variant: r.variant ?? "control",
        source: "feed",
        experimentId: created.experimentId,
        counted: true,
      });
      accepted += t.accepted;
      rejected.push(...t.rejected);
    }
    return {
      verdict: accepted === assigned.rows.length ? "PASS" : "FAIL",
      note: `${accepted}/${assigned.rows.length} accepted at ${eventsEndpoint(config)}`,
      rejected,
    };
  }, { fatal: false });

  await step("events: answer_positive + reward_claim", async () => {
    let accepted = 0;
    let sent = 0;
    const rejected = [];
    for (const [i, r] of assigned.rows.entries()) {
      for (const event of i % 3 === 0 ? ["answer_positive", "reward_claim"] : i % 2 === 0 ? ["answer_positive"] : []) {
        const t = await client.trackEvent({ deckId: flagName, swiperGuid: r.guid, flagName: created.flagName, event, source: "feed", counted: true });
        sent++;
        accepted += t.accepted;
        rejected.push(...t.rejected);
      }
    }
    return { verdict: accepted === sent ? "PASS" : "FAIL", note: `${accepted}/${sent} accepted`, rejected };
  }, { fatal: false });

  await step("anonymous read during the test", async () => ({ verdict: "INFO", anonymous: await anonymousFlagValue() }), { fatal: false });

  await step("results: refresh (400/429 non-fatal) + read", async () => {
    const out = await admin.getExperimentResults(created.experimentId, {
      flagName: created.flagName,
      cardIds: { A: "A", B: "B", C: "C" },
      controlKey: "A",
      rewardMetricId: created.rewardMetricId,
      force: true,
    });
    // Results can stay null for a while (warehouse delivery); that is PENDING, not a failure.
    // flagsmithSrm records Flagsmith's own srm_p_value: expected to be null for experiments we create (the expected
    // split is read from the 0%-per-option environment default), which is why the app checks SRM locally.
    const flagsmithSrm = out.parsed?.raw?.results?.payload?.srm_p_value ?? null;
    return {
      verdict: out.parsed ? "PASS" : "PENDING",
      note: out.parsed
        ? `n per variant ${JSON.stringify(Object.fromEntries(out.parsed.variants.map((v) => [v.key, v.identities])))}, ` +
          `srm=${out.parsed.srmPValue} (${out.parsed.srmSource ?? "too little data"}), Flagsmith srm_p_value=${flagsmithSrm}`
        : `no results yet (refresh ${out.refreshed ? "accepted" : `skipped: ${out.refreshSkipped}`}); re-read later in the dashboard`,
      flagsmithSrm,
      refreshed: out.refreshed,
      refreshSkipped: out.refreshSkipped ?? null,
      parsed: out.parsed,
      rawResultsPayload: out.parsed?.raw ?? null,
    };
  }, { fatal: false });

  const shipped = await step("ship B: complete {rollout_decision: variant} + PUT winning text", async () => {
    const out = await admin.shipWinner({
      flagName: created.flagName,
      experimentId: created.experimentId,
      variantKeys,
      winnerKey: "B",
      winnerValue: variantValues.B,
      optionIds: created.optionIds,
    });
    const exp = await admin.getExperiment(created.experimentId);
    const decisionOk = exp.rolloutDecision === "variant" && exp.rolloutVariant === created.optionIds.B;
    return {
      verdict: exp.status === "completed" && decisionOk ? "PASS" : "FAIL",
      note:
        `experiment status=${exp.status}, rollout_decision=${exp.rolloutDecision}, rollout_variant=${exp.rolloutVariant}` +
        `${out.complete.alreadyCompleted ? " (was already completed)" : ""}`,
      snapshot: out.snapshot,
      completeResponse: out.complete.response,
    };
  }, { fatal: false });

  if (shipped.verdict === "PASS") {
    // Read-only on the server: complete on a completed experiment is refused (400) and changes nothing.
    await step("complete again: same decision tolerated, a different one refused", async () => {
      const same = await admin.completeExperiment(created.experimentId, { rollout_decision: "variant", rollout_variant: created.optionIds.B });
      const other = await admin.completeExperiment(created.experimentId, { rollout_decision: "control" }).then(
        () => "accepted",
        (e) => (e instanceof FlagsmithCompletedDifferently ? "refused" : `error: ${e?.message ?? e}`),
      );
      return {
        verdict: same.alreadyCompleted && other === "refused" ? "PASS" : "FAIL",
        note: `same decision alreadyCompleted=${same.alreadyCompleted}; control instead -> ${other}`,
        refusedBody: same.response,
      };
    }, { fatal: false });
  }

  await step("after ship: who sees the winner", async () => {
    const state = await admin.snapshotFlag(created.flagName);
    const anon = await anonymousFlagValue();
    const identified = await client.assign(flagName, "lifecycle-post-ship", created.flagName, "feed");
    const anonymousSeesWinner = anon?.value === variantValues.B;
    const identifiedSeesWinner = identified.value === variantValues.B;
    return {
      verdict: anonymousSeesWinner && identifiedSeesWinner && state.enabled ? "PASS" : "FAIL",
      note: `enabled=${state.enabled} anonymous=${JSON.stringify(anon?.value)} identified=${JSON.stringify(identified.value)} (variant ${identified.variant})`,
      state,
      anonymousSeesWinner,
      identifiedSeesWinner,
    };
  }, { fatal: false });

  if (shipped.verdict === "PASS") {
    // Undo writes the pre-ship environment default back. That default kept 0% per option while the test ran (the
    // split lived in the rollout override, which complete removed), so undo means: control for everyone.
    await step("undo: pre-ship default back = control for everyone (the test split does not return)", async () => {
      const restored = await admin.undoShip(created.flagName, shipped.snapshot);
      const now = await admin.snapshotFlag(created.flagName);
      const weights = (rows) => JSON.stringify(rows.map((r) => [r.multivariate_feature_option, r.percentage_allocation]).sort());
      const sameAsSnapshot = weights(now.multivariate) === weights(restored.multivariate) && now.featureStateValue === restored.featureStateValue;
      const control = now.featureStateValue === variantValues.A && now.multivariate.every((r) => r.percentage_allocation === 0);
      const anon = await anonymousFlagValue();
      return {
        verdict: sameAsSnapshot && control ? "PASS" : "FAIL",
        note: `restored snapshot=${sameAsSnapshot}, control for everyone=${control}, anonymous=${JSON.stringify(anon?.value)}`,
        now,
        restored,
      };
    }, { fatal: false });
  }
} catch (error) {
  exitCode = 1;
  if (!String(error?.message).startsWith("step failed")) console.error("\nLifecycle aborted:", error?.message ?? error);
} finally {
  if (created) {
    await step("archive the throwaway flag", async () => {
      await admin.archiveFeature(created.featureId);
      return { note: created.flagName };
    }, { fatal: false });
  }
}

if (results.some(([v]) => v === "FAIL")) exitCode = 1;
record.finishedAt = new Date().toISOString();
record.summary = Object.fromEntries(results.map(([v, name]) => [name, v]));
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "recorded");
await mkdir(dir, { recursive: true });
const file = path.join(dir, `flagsmith-lifecycle-${stamp}.json`);
await writeFile(file, JSON.stringify(record, null, 2));
console.log(`\n${results.filter(([v]) => v === "PASS").length} PASS, ${results.filter(([v]) => v === "FAIL").length} FAIL, ${results.filter(([v]) => v === "PENDING").length} PENDING`);
console.log(`Recorded: ${file}`);
process.exit(exitCode);
