/**
 * Flagsmith Admin (management) API: flag + experiment lifecycle. Server only.
 *
 * Reconciled against Flagsmith/flagsmith main (SHA f6ecf07, see src/features/flagsmith/README.md):
 *  - option keys are read-only on the nested create (features/multivariate/serializers.py
 *    NestedMultivariateFeatureOptionSerializer), so options are added one by one through
 *    POST projects/{p}/features/{f}/mv-options/ (MultivariateFeatureOptionSerializer, `key` writable, "control" reserved);
 *  - complete requires {rollout_decision, rollout_variant?} (experimentation/serializers.py ExperimentRolloutDecisionSerializer);
 *  - results refresh answers 400 (not started / final) or 429 (5-minute throttle) and both are non-fatal;
 *  - feature-state writes use PUT with the existing mv row ids (PATCH drops multivariate values silently,
 *    features/views.py get_serializer_class); both fail with HTTP 400 when the environment uses v2 versioning.
 * Behaviour that still needs a live account is listed in the README ("Still unverifiable").
 */
import type { FlagsmithExperimentResults } from "@/types";

import { requireAdmin, type AdminConfig, type FlagsmithConfig } from "./config";
import {
  FlagsmithApiError,
  FlagsmithCompletedDifferently,
  FlagsmithInvalidInput,
  FlagsmithPublishError,
  FlagsmithUnexpectedResponse,
  FlagsmithVersioningError,
} from "../errors";
import type { HttpClient } from "./http";
import {
  CONTROL_VARIANT_KEY,
  expectedSharesFor,
  parseExperimentResults,
  toFlagsmithResults,
  type ExperimentResults,
} from "../results";
import { RefreshGuard, type StateStore } from "../state";
import { equalWeights, toStateValues, winnerTakesAll, type MultivariateStateValue } from "../weights";

export const METRIC_REWARD_CLAIM = "reward_claim";
export const METRIC_ANSWER_POSITIVE = "answer_positive";

const KEY_PATTERN = /^[-a-zA-Z0-9_]+$/;
/** Validation allows 2 to 4 cards (4 only for price-level decks). */
const MIN_VARIANTS = 2;
const MAX_VARIANTS = 4;

export interface CreateDeckExperimentInput {
  deckId: string;
  flagName: string;
  /** One variant per card, control FIRST, e.g. ["A", "B", "C"]. 2 to 4 cards per deck. */
  variantKeys: string[];
  /** Text each variant serves (the flag value). Defaults to the key. */
  variantValues?: Record<string, string>;
  hypothesis?: string;
}

export interface DeckExperiment {
  experimentId: string;
  /** The flag name actually used (a fresh suffix when the original name was taken by an earlier attempt). */
  flagName: string;
  featureId: number;
  /** Multivariate option id per NON-control variant key. */
  optionIds: Record<string, number>;
  metricIds: Record<string, string>;
  /** `metric_id` of reward_claim in the results payload. */
  rewardMetricId: string;
}

/** Flag weights per variant key (control included), summing to 100. */
export type VariantWeights = Record<string, number>;

/** What the environment's feature state looked like before shipping. Persist it; undo writes it back. */
export interface FlagSnapshot {
  flagName: string;
  featureId: number;
  featureStateId: number;
  enabled: boolean;
  featureStateValue: unknown;
  /** Includes each row's `id`, which the PUT needs to update rows in place. */
  multivariate: MultivariateStateValue[];
  takenAt: string;
}

export interface RefreshedResults {
  /** Null until Flagsmith has computed results (or when the payload has no variants). */
  results: FlagsmithExperimentResults | null;
  parsed: ExperimentResults | null;
  /** True when a refresh POST was accepted. False when the guard skipped it or Flagsmith refused it (400/429). */
  refreshed: boolean;
  /** Why the refresh did not run: "guard", or Flagsmith's HTTP status ("400", "429"). */
  refreshSkipped?: string;
  nextRefreshAt: Date | null;
}

export interface ResultsContext {
  flagName: string;
  /** Variant key to card id. */
  cardIds: Record<string, string>;
  /** The control card's variant key; Flagsmith's "control" is mapped to it. Default: first key of cardIds in sort order. */
  controlKey?: string;
  /** reward_claim's metric id, stored on the deck at publish. Looked up by event name when absent. */
  rewardMetricId?: string;
  /** Bypass the guard (founder pressed refresh, still limited by the caller). Default false. */
  force?: boolean;
}

export type RolloutDecision = "control" | "variant" | "disable";

/** Body of POST .../experiments/{id}/complete/. `rollout_variant` (an mv option id) only with "variant". */
export interface RolloutDecisionInput {
  rollout_decision: RolloutDecision;
  rollout_variant?: number;
}

export interface ExperimentInfo {
  id: string;
  /** "created" | "running" | "paused" | "completed" (experimentation/models.py ExperimentStatus). */
  status: string | null;
  /** "control" | "variant" | "disable" once completed (serializers.py ExperimentSerializer, read-only). */
  rolloutDecision: string | null;
  /** The mv option id rolled out, with "variant". */
  rolloutVariant: number | null;
  raw: unknown;
}

export interface CompleteResult {
  /** True when Flagsmith refused complete but the experiment already shows status "completed". */
  alreadyCompleted: boolean;
  response: unknown;
}

export interface ShipWinnerInput {
  flagName: string;
  experimentId: string;
  /** Control first. */
  variantKeys: string[];
  winnerKey: string;
  /** The winning text; set as the flag value so anonymous visitors get it too (spec 02 5.15). */
  winnerValue?: string;
  /** Option id per challenger key (stored on the deck). Read from the flag when absent. */
  optionIds?: Record<string, number>;
}

export interface ShipWinnerResult {
  snapshot: FlagSnapshot;
  weights: VariantWeights;
  complete: CompleteResult;
}

export interface AdminDeps {
  config: FlagsmithConfig;
  http: HttpClient;
  store: StateStore;
  guard: RefreshGuard;
  now?: () => number;
}

type Obj = Record<string, unknown>;

function isObj(value: unknown): value is Obj {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function list(json: unknown): Obj[] {
  const raw = Array.isArray(json) ? json : isObj(json) && Array.isArray(json.results) ? json.results : [];
  return raw.filter(isObj);
}

function requireId(value: unknown, what: string, body: unknown): number {
  if (typeof value !== "number") throw new FlagsmithUnexpectedResponse(`Flagsmith response has no ${what}`, body);
  return value;
}

/** Metric ids are integers in Flagsmith; send them as numbers when they look like one. */
const pk = (id: string): number | string => (/^\d+$/.test(id) ? Number(id) : id);

function isV2VersioningRefusal(error: unknown): boolean {
  if (!(error instanceof FlagsmithApiError) || error.status !== 400) return false;
  const text = JSON.stringify(error.body ?? "").toLowerCase();
  return text.includes("v2 feature versioning") || text.includes("direct_feature_state_write_not_allowed");
}

/** The complete body for a winner: control -> "control"; any other card -> "variant" + its option id. */
export function rolloutDecisionFor(
  controlKey: string,
  winnerKey: string,
  optionIds: Record<string, number>,
): RolloutDecisionInput {
  if (winnerKey === controlKey || winnerKey === CONTROL_VARIANT_KEY) return { rollout_decision: "control" };
  const id = optionIds[winnerKey];
  if (typeof id !== "number") throw new FlagsmithInvalidInput(`No Flagsmith option id for winner "${winnerKey}"`);
  return { rollout_decision: "variant", rollout_variant: id };
}

export class FlagsmithAdmin {
  private readonly config: FlagsmithConfig;
  private readonly http: HttpClient;
  private readonly store: StateStore;
  private readonly guard: RefreshGuard;
  private readonly now: () => number;

  constructor(deps: AdminDeps) {
    this.config = deps.config;
    this.http = deps.http;
    this.store = deps.store;
    this.guard = deps.guard;
    this.now = deps.now ?? Date.now;
  }

  /* ------------------------------ plumbing ------------------------------ */

  private cfg(): AdminConfig {
    return requireAdmin(this.config);
  }

  private async call(method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<unknown> {
    const cfg = this.cfg();
    const response = await this.http({
      method,
      url: `${cfg.apiUrl}${path}`,
      headers: { Authorization: `${cfg.authScheme} ${cfg.adminKey}` },
      body,
    });
    if (response.status < 200 || response.status >= 300) {
      throw new FlagsmithApiError(method, path, response.status, response.json);
    }
    return response.json;
  }

  private envPath(suffix: string): string {
    return `/api/v1/environments/${this.cfg().environmentKey}${suffix}`;
  }

  private projectPath(suffix: string): string {
    return `/api/v1/projects/${this.cfg().projectId}${suffix}`;
  }

  /* ------------------------------- metrics ------------------------------- */

  /**
   * Existing metric for this event (MetricSerializer: id, name, aggregation, direction, definition{version, event}).
   * Not cached: a metric deleted in the dashboard is soft-deleted (Metric is a SoftDeleteExportableModel), and a
   * stale cached id would make every later experiment create fail with 400 "Invalid pk". Publish is rare.
   */
  private async findMetricId(event: string): Promise<string | null> {
    const found = list(
      await this.call("GET", this.envPath(`/experiment-metrics/?q=${encodeURIComponent(event)}&page_size=100`)),
    ).find((m) => isObj(m.definition) && m.definition.event === event);
    if (!found || found.id === undefined) return null;
    return String(found.id);
  }

  /** Find or create an Occurrence metric (higher is better). */
  private async ensureMetric(event: string): Promise<string> {
    const existing = await this.findMetricId(event);
    if (existing) return existing;
    const created = await this.call("POST", this.envPath("/experiment-metrics/"), {
      name: event,
      aggregation: "occurrence",
      direction: "up",
      definition: { version: 1, event },
    });
    if (!isObj(created) || created.id === undefined) {
      throw new FlagsmithUnexpectedResponse(`Metric "${event}" was created but no id came back`, created);
    }
    return String(created.id);
  }

  /* --------------------------- flag + experiment --------------------------- */

  private validateVariants(input: CreateDeckExperimentInput): void {
    const { variantKeys } = input;
    if (variantKeys.length < MIN_VARIANTS || variantKeys.length > MAX_VARIANTS) {
      throw new FlagsmithInvalidInput(`A deck needs ${MIN_VARIANTS} to ${MAX_VARIANTS} cards (control first)`);
    }
    if (new Set(variantKeys).size !== variantKeys.length || !variantKeys.every((k) => KEY_PATTERN.test(k))) {
      throw new FlagsmithInvalidInput("Variant keys must be unique and match [-a-zA-Z0-9_]+");
    }
    if (variantKeys.slice(1).some((k) => k.toLowerCase() === CONTROL_VARIANT_KEY)) {
      throw new FlagsmithInvalidInput(`"${CONTROL_VARIANT_KEY}" is a reserved Flagsmith variant key`);
    }
  }

  /**
   * A flag with this name left by an earlier failed attempt (or a publish whose deck save failed) is archived
   * and a fresh, unique name is used, so a retry never fails on a duplicate name and never leaves two live flags.
   * Archived features keep their name (the list endpoint returns them unless filtered), hence the suffix.
   */
  private async freeFlagName(flagName: string): Promise<string> {
    const existing = await this.findFeature(flagName);
    if (!existing) return flagName;
    if (existing.is_archived !== true) await this.archiveFeature(requireId(existing.id, "feature id", existing));
    for (let attempt = 0; attempt < 3; attempt++) {
      const candidate = `${flagName}_r${(this.now() + attempt).toString(36)}`;
      if (!(await this.findFeature(candidate))) return candidate;
    }
    throw new FlagsmithUnexpectedResponse(`Could not find a free flag name for "${flagName}"`, null);
  }

  /**
   * Create the MULTIVARIATE flag (control = the flag's own value), one keyed option per other card, the
   * metrics, and an experiment at 100% rollout with an equal split. Created, NOT started.
   * On any failure after the flag exists, the flag is archived before the error is thrown
   * (FlagsmithPublishError, with `cleanedUp`).
   */
  async createDeckExperiment(input: CreateDeckExperimentInput): Promise<DeckExperiment> {
    this.cfg();
    this.validateVariants(input);
    const [controlKey, ...challengers] = input.variantKeys;
    const valueOf = (key: string) => input.variantValues?.[key] ?? key;

    let step = "checking the flag name";
    let featureId: number | null = null;
    try {
      const flagName = await this.freeFlagName(input.flagName);

      // 1. Flag, no options (nested option keys are read-only and would be created keyless).
      step = "creating the flag";
      const feature = await this.call("POST", this.projectPath("/features/"), {
        name: flagName,
        type: "MULTIVARIATE",
        default_enabled: true,
        initial_value: valueOf(controlKey),
      });
      featureId = requireId(isObj(feature) ? feature.id : undefined, "feature id", feature);

      // 2. One option per challenger, with its key; ids come back on each response.
      step = "adding the card options";
      const optionIds: Record<string, number> = {};
      for (const key of challengers) {
        const option = await this.call("POST", this.projectPath(`/features/${featureId}/mv-options/`), {
          feature: featureId,
          type: "unicode",
          string_value: valueOf(key),
          default_percentage_allocation: 0,
          key,
        });
        if (!isObj(option) || typeof option.id !== "number") {
          throw new FlagsmithUnexpectedResponse(`Option "${key}" was created but no id came back`, option);
        }
        if (option.key !== undefined && option.key !== key) {
          throw new FlagsmithUnexpectedResponse(`Option "${key}" came back with key ${JSON.stringify(option.key)}`, option);
        }
        optionIds[key] = option.id;
      }

      // 3. Metrics (primary first).
      step = "setting up the metrics";
      const rewardId = await this.ensureMetric(METRIC_REWARD_CLAIM);
      const positiveId = await this.ensureMetric(METRIC_ANSWER_POSITIVE);

      // 4. Experiment: 100% of identities enrolled, equal split across cards.
      step = "creating the experiment";
      const weights = equalWeights(input.variantKeys);
      const experiment = await this.call("POST", this.envPath("/experiments/"), {
        feature: featureId,
        name: `${flagName} experiment`,
        hypothesis:
          input.hypothesis ?? `One of the ${input.variantKeys.length} cards earns more ${METRIC_REWARD_CLAIM} than control.`,
        metrics: [
          { metric: pk(rewardId), expected_direction: "increase" },
          { metric: pk(positiveId), expected_direction: "increase" },
        ],
        experiment_rollout: {
          enabled: true,
          rollout_percentage: 100,
          // FeatureValueSerializer types: "integer" | "string" | "boolean".
          feature_state_value: { type: "string", value: valueOf(controlKey) },
          multivariate_feature_state_values: toStateValues(optionIds, controlKey, weights),
        },
      });
      if (!isObj(experiment) || experiment.id === undefined) {
        throw new FlagsmithUnexpectedResponse("Experiment created but no id came back", experiment);
      }

      return {
        experimentId: String(experiment.id),
        flagName,
        featureId,
        optionIds,
        metricIds: { [METRIC_REWARD_CLAIM]: rewardId, [METRIC_ANSWER_POSITIVE]: positiveId },
        rewardMetricId: rewardId,
      };
    } catch (error) {
      throw await this.failPublish(step, error, featureId);
    }
  }

  /**
   * Archive the half-made flag (best effort) and wrap the error with the step it failed at. When the archive
   * itself fails, the error carries the feature id (`orphanFeatureId`) so the deck can record it and archive it
   * later (onDeckArchived), instead of leaving it in the project forever.
   */
  private async failPublish(step: string, error: unknown, featureId: number | null): Promise<FlagsmithPublishError> {
    if (error instanceof FlagsmithPublishError) return error;
    let cleanedUp = featureId === null;
    if (featureId !== null) {
      try {
        await this.archiveFeature(featureId);
        cleanedUp = true;
      } catch (cleanup) {
        console.error("flagsmith: could not archive half-made flag", featureId, cleanup instanceof Error ? cleanup.message : cleanup);
      }
    }
    return new FlagsmithPublishError(step, error, cleanedUp, cleanedUp ? undefined : (featureId ?? undefined));
  }

  /**
   * Publish path: create everything, then start. Any failure archives the flag and throws FlagsmithPublishError.
   * A failed start (e.g. a timeout) is checked with a GET first: if Flagsmith shows the experiment running, the
   * start did happen and the publish counts as a success (archiving would orphan a running experiment).
   */
  async launchDeckExperiment(input: CreateDeckExperimentInput): Promise<DeckExperiment> {
    const created = await this.createDeckExperiment(input);
    try {
      await this.startExperiment(created.experimentId);
    } catch (error) {
      const info = await this.getExperiment(created.experimentId).catch(() => null);
      if (info?.status === "running") {
        console.warn("flagsmith: start reported an error but the experiment is running", created.experimentId);
        return created;
      }
      throw await this.failPublish("starting the experiment", error, created.featureId);
    }
    return created;
  }

  /** Locks the flag and turns the rollout on (views.py `start`; the body is ignored). */
  async startExperiment(experimentId: string): Promise<void> {
    await this.call("POST", this.envPath(`/experiments/${experimentId}/start/`), {});
  }

  /** ExperimentDetailSerializer: status plus the read-only rollout_decision / rollout_variant set by complete. */
  async getExperiment(experimentId: string): Promise<ExperimentInfo> {
    const json = await this.call("GET", this.envPath(`/experiments/${experimentId}/`));
    const o = isObj(json) ? json : {};
    // rollout_variant is a PK field; accept a nested {id} too in case a serializer expands it.
    const variant = isObj(o.rollout_variant) ? o.rollout_variant.id : o.rollout_variant;
    return {
      id: experimentId,
      status: typeof o.status === "string" ? o.status : null,
      rolloutDecision: typeof o.rollout_decision === "string" ? o.rollout_decision : null,
      rolloutVariant: typeof variant === "number" ? variant : typeof variant === "string" && /^\d+$/.test(variant) ? Number(variant) : null,
      raw: json,
    };
  }

  /**
   * Refresh (at most once per 5 min per experiment) then read results. The refresh POST is non-fatal on
   * 400 (not started yet, or results final) and 429 (Flagsmith's own 5-minute throttle): the GET still runs.
   */
  async getExperimentResults(experimentId: string, context: ResultsContext): Promise<RefreshedResults> {
    this.cfg();
    const decision = context.force ? { allowed: true, retryAfterMs: 0 } : await this.guard.check(experimentId);
    let refreshed = false;
    let refreshSkipped: string | undefined = decision.allowed ? undefined : "guard";
    if (decision.allowed) {
      await this.guard.mark(experimentId);
      try {
        await this.call("POST", this.envPath(`/experiments/${experimentId}/results/refresh/`), {});
        refreshed = true;
      } catch (error) {
        if (!(error instanceof FlagsmithApiError) || (error.status !== 400 && error.status !== 429)) throw error;
        refreshSkipped = String(error.status);
        console.info("flagsmith: results refresh skipped", experimentId, error.status, JSON.stringify(error.body));
      }
    }
    const payload = await this.call("GET", this.envPath(`/experiments/${experimentId}/results/`));
    const metricId = context.rewardMetricId ?? (await this.findMetricId(METRIC_REWARD_CLAIM)) ?? undefined;
    const parsed = parseExperimentResults(experimentId, payload, {
      metricId,
      // Every card of the deck, so a card with no exposures at all still counts in the local SRM check.
      expectedShares: Object.keys(context.cardIds).length >= 2 ? expectedSharesFor(context.cardIds, context.controlKey) : undefined,
    });
    return {
      parsed,
      results: parsed
        ? toFlagsmithResults(parsed, {
            flagName: context.flagName,
            cardIds: context.cardIds,
            controlKey: context.controlKey,
            refreshedAt: refreshed ? new Date(this.now()) : undefined,
          })
        : null,
      refreshed,
      ...(refreshSkipped ? { refreshSkipped } : {}),
      nextRefreshAt: decision.allowed ? null : new Date(this.now() + decision.retryAfterMs),
    };
  }

  /**
   * Ends the experiment with a rollout decision: Flagsmith writes the environment default (control, or the
   * variant at 100%) and removes the rollout override (services.py _apply_rollout_decision). Results freeze and
   * the experiment cannot restart. A 400/409 is tolerated ONLY when the experiment already shows "completed".
   */
  async completeExperiment(experimentId: string, decision: RolloutDecisionInput): Promise<CompleteResult> {
    if (!decision || !["control", "variant", "disable"].includes(decision.rollout_decision)) {
      throw new FlagsmithInvalidInput("completeExperiment needs a rollout_decision");
    }
    if (decision.rollout_decision === "variant" && typeof decision.rollout_variant !== "number") {
      throw new FlagsmithInvalidInput('rollout_decision "variant" needs rollout_variant (an option id)');
    }
    const body: RolloutDecisionInput =
      decision.rollout_decision === "variant"
        ? { rollout_decision: "variant", rollout_variant: decision.rollout_variant }
        : { rollout_decision: decision.rollout_decision };
    try {
      return { alreadyCompleted: false, response: await this.call("POST", this.envPath(`/experiments/${experimentId}/complete/`), body) };
    } catch (error) {
      if (!(error instanceof FlagsmithApiError) || (error.status !== 400 && error.status !== 409)) throw error;
      const info = await this.getExperiment(experimentId).catch(() => null);
      if (info?.status !== "completed") throw error;
      // Completed elsewhere (e.g. in the Flagsmith dashboard): only "already done" if it is OUR decision.
      // A different or unknown decision ("disable", another variant, or none recorded) is refused, never shipped over.
      const same =
        info.rolloutDecision === body.rollout_decision &&
        (body.rollout_decision !== "variant" || info.rolloutVariant === body.rollout_variant);
      if (!same) throw new FlagsmithCompletedDifferently(info.rolloutDecision, info.rolloutVariant);
      return { alreadyCompleted: true, response: error.body };
    }
  }

  /* ------------------------------ flag state ------------------------------ */

  /** Exact-name match (the search is a substring match). Archived features are included. */
  private async findFeature(flagName: string): Promise<Obj | null> {
    const found = list(
      await this.call("GET", this.projectPath(`/features/?search=${encodeURIComponent(flagName)}&page_size=100`)),
    ).find((f) => typeof f.name === "string" && f.name.toLowerCase() === flagName.toLowerCase());
    return found ?? null;
  }

  private async findFeatureId(flagName: string): Promise<number> {
    const found = await this.findFeature(flagName);
    return requireId(found?.id, `feature "${flagName}"`, found);
  }

  /** The environment default state (the list filters out segment and identity overrides, features/views.py). */
  private async getFeatureState(featureId: number): Promise<Obj> {
    const state = list(await this.call("GET", this.envPath(`/featurestates/?feature=${featureId}`)))[0];
    if (!state) throw new FlagsmithUnexpectedResponse(`No feature state for feature ${featureId}`, null);
    return state;
  }

  private static rows(state: Obj): MultivariateStateValue[] {
    const mv = Array.isArray(state.multivariate_feature_state_values) ? state.multivariate_feature_state_values : [];
    return mv.filter(isObj).map((v) => ({
      ...(typeof v.id === "number" ? { id: v.id } : {}),
      multivariate_feature_option: Number(v.multivariate_feature_option),
      percentage_allocation: Number(v.percentage_allocation),
    }));
  }

  /** Read the environment's current state of the flag. */
  async snapshotFlag(flagName: string): Promise<FlagSnapshot> {
    const featureId = await this.findFeatureId(flagName);
    const state = await this.getFeatureState(featureId);
    return {
      flagName,
      featureId,
      featureStateId: requireId(state.id, "feature state id", state),
      enabled: state.enabled === true,
      featureStateValue: state.feature_state_value ?? null,
      multivariate: FlagsmithAdmin.rows(state),
      takenAt: new Date(this.now()).toISOString(),
    };
  }

  /**
   * PUT the environment default: value + weights per option id. Row ids come from a fresh read (complete may
   * have rewritten the rows since a snapshot), matched by option id, so rows are updated in place.
   */
  private async writeState(
    featureId: number,
    values: { enabled?: boolean; featureStateValue: unknown; weightsByOption: Record<number, number> },
  ): Promise<void> {
    const current = await this.getFeatureState(featureId);
    const stateId = requireId(current.id, "feature state id", current);
    const rowIds = new Map(FlagsmithAdmin.rows(current).map((r) => [r.multivariate_feature_option, r.id]));
    const multivariate = Object.entries(values.weightsByOption).map(([option, weight]) => {
      const id = rowIds.get(Number(option));
      return {
        ...(id !== undefined ? { id } : {}),
        multivariate_feature_option: Number(option),
        percentage_allocation: weight,
      };
    });
    try {
      await this.call("PUT", this.envPath(`/featurestates/${stateId}/`), {
        feature: featureId,
        enabled: values.enabled ?? current.enabled === true,
        feature_state_value: values.featureStateValue,
        multivariate_feature_state_values: multivariate,
      });
    } catch (error) {
      if (isV2VersioningRefusal(error)) throw new FlagsmithVersioningError((error as FlagsmithApiError).body);
      throw error;
    }
  }

  /** Option id per key, read from the feature (keys are set through mv-options at publish). */
  async optionIdsForFlag(flagName: string, featureId?: number): Promise<Record<string, number>> {
    const id = featureId ?? (await this.findFeatureId(flagName));
    const detail = await this.call("GET", this.projectPath(`/features/${id}/`));
    const options = isObj(detail) && Array.isArray(detail.multivariate_options) ? detail.multivariate_options : [];
    const byKey: Record<string, number> = {};
    for (const o of options) if (isObj(o) && typeof o.key === "string" && typeof o.id === "number") byKey[o.key] = o.id;
    return byKey;
  }

  /**
   * Set the served weights per variant key (control included, summing to 100).
   * Does NOT snapshot: use shipWinner for the approved ship flow.
   */
  async setFlagWeights(
    flagName: string,
    controlKey: string,
    weights: VariantWeights,
    options: { featureStateValue?: string; optionIds?: Record<string, number>; enabled?: boolean } = {},
  ): Promise<void> {
    const featureId = await this.findFeatureId(flagName);
    const optionIds = options.optionIds ?? (await this.optionIdsForFlag(flagName, featureId));
    const rows = toStateValues(optionIds, controlKey, weights);
    const current = await this.getFeatureState(featureId);
    await this.writeState(featureId, {
      // The ship path passes true: the winner must actually be served, whatever state the flag was left in.
      ...(options.enabled !== undefined ? { enabled: options.enabled } : {}),
      featureStateValue: options.featureStateValue ?? current.feature_state_value ?? null,
      weightsByOption: Object.fromEntries(rows.map((r) => [r.multivariate_feature_option, r.percentage_allocation])),
    });
  }

  /**
   * Approved ship: snapshot the current state (kept in the store AND returned, so the caller can also persist
   * it), complete the experiment with the rollout decision, then write the winning text + 100/0 so anonymous
   * readers (no identity, so no bucketing) also get the winner. Callers must have founder approval.
   */
  async shipWinner(input: ShipWinnerInput): Promise<ShipWinnerResult> {
    const [controlKey] = input.variantKeys;
    const weights = winnerTakesAll(input.variantKeys, input.winnerKey);

    const snapshot = await this.snapshotFlag(input.flagName);
    await this.store.set(`snapshot:${input.flagName}`, snapshot);

    const optionIds = input.optionIds ?? (await this.optionIdsForFlag(input.flagName, snapshot.featureId));
    const complete = await this.completeExperiment(input.experimentId, rolloutDecisionFor(controlKey, input.winnerKey, optionIds));

    const rows = toStateValues(optionIds, controlKey, weights);
    await this.writeState(snapshot.featureId, {
      enabled: true,
      featureStateValue: input.winnerValue ?? snapshot.featureStateValue,
      weightsByOption: Object.fromEntries(rows.map((r) => [r.multivariate_feature_option, r.percentage_allocation])),
    });
    return { snapshot, weights, complete };
  }

  /**
   * Write the pre-ship environment default back. That is NOT the test split: while an experiment runs Flagsmith
   * keeps every option's default allocation at 0 (services.py `_reset_default_allocations_to_control`) and the
   * split lives in the rollout segment override, which complete deletes (`_delete_experiment_rollout_override`).
   * So undo serves the CONTROL card to everyone. There is no undo endpoint and a completed experiment cannot be
   * restarted: testing again needs a new deck (a new experiment).
   *
   * The control state is written explicitly (the snapshot's value, EVERY option at 0%, enabled) instead of the
   * snapshot's weights: a ship retried after a complete whose response was lost snapshots the flag AFTER completion
   * (winner at 100%), and writing that back would keep serving the winner to identified readers.
   */
  async undoShip(flagName: string, snapshot?: FlagSnapshot): Promise<FlagSnapshot> {
    const saved = snapshot ?? ((await this.store.get(`snapshot:${flagName}`)) as FlagSnapshot | null);
    if (!saved) throw new FlagsmithInvalidInput(`No snapshot stored for "${flagName}"; nothing to undo`);
    await this.writeState(saved.featureId, {
      enabled: true,
      featureStateValue: saved.featureStateValue,
      weightsByOption: Object.fromEntries(saved.multivariate.map((r) => [r.multivariate_feature_option, 0])),
    });
    await this.store.set(`snapshot:${flagName}`, null);
    return saved;
  }

  /** Archive a feature by id (PATCH is_archived). */
  async archiveFeature(featureId: number): Promise<void> {
    await this.call("PATCH", this.projectPath(`/features/${featureId}/`), { is_archived: true });
  }

  /** Archive the flag when the deck closes. A running experiment is left as it is. */
  async archiveFlag(flagName: string): Promise<void> {
    await this.archiveFeature(await this.findFeatureId(flagName));
  }
}

