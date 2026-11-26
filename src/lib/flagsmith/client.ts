/**
 * Flagsmith client-side (SDK) endpoints, called from our server with the public
 * environment key: identities, events, platform flags. No admin key needed.
 */
import { eventsEndpoint, requireEnvironmentKey, type FlagsmithConfig } from "./config";
import { FlagsmithApiError } from "./errors";
import type { HttpClient } from "./http";

export type SwipeSource = "feed" | "link";
export type FlagsmithEventName = "reward_claim" | "answer_positive";
/** Flagsmith api/experimentation/constants.py EXPOSURE_EVENT_NAME. */
export const EXPOSURE_EVENT = "$flag_exposure";

/** Identity used for assignment: `<deckId>:<guid>` (spec/06 7). */
export function identityFor(deckId: string, swiperGuid: string): string {
  return `${deckId}:${swiperGuid}`;
}

type Obj = Record<string, unknown>;

function isObj(value: unknown): value is Obj {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export interface PlatformFlags {
  /** Kill switch: false turns off all (demo) payouts. */
  paid_swiping: boolean;
  boost_enabled: boolean;
  language_cards: boolean;
  /** Gradual rollout of the approve-and-ship assistant. */
  assistant_ship: boolean;
  /** Remote config: one check card in every N cards (spec: 1 in 20). */
  check_card_rate: number;
}

/** Used when a flag is missing or Flagsmith is not configured. */
export const PLATFORM_FLAG_DEFAULTS: PlatformFlags = {
  paid_swiping: true,
  boost_enabled: false,
  language_cards: true,
  assistant_ship: true,
  check_card_rate: 20,
};

export interface AssignmentResult {
  identifier: string;
  /**
   * The variant Flagsmith served: the multivariate option key, or "control" for the flag's own value
   * (api/features/serializers.py SDKIdentityFeatureStateSerializer.get_variant). Null when the flag is absent
   * or not multivariate.
   */
  variant: string | null;
  /** The value the flag serves this identity (the card text), or null if absent. Fallback for matching. */
  value: unknown;
  enabled: boolean;
  /** `metadata.experiment.in_experiment` when an experiment is running on the flag, else null. */
  inExperiment: boolean | null;
  /** `metadata.experiment.id` when an experiment is running on the flag. */
  experimentId: string | null;
  raw: unknown;
}

export interface TrackEventInput {
  deckId: string;
  swiperGuid: string;
  flagName: string;
  event: FlagsmithEventName;
  source: SwipeSource;
  /** Only counted, valid swipes may reach Flagsmith. false is dropped without a call. */
  counted: boolean;
}

export interface TrackExposureInput {
  deckId: string;
  swiperGuid: string;
  flagName: string;
  /** "control" or the option key of the card that was shown. */
  variant: string;
  source: SwipeSource;
  experimentId?: string;
  /** Only counted, valid swipes may reach Flagsmith. false is dropped without a call. */
  counted: boolean;
}

export interface TrackEventResult {
  sent: boolean;
  accepted: number;
  rejected: unknown[];
}

interface EventBody {
  event: string;
  timestamp: number;
  identifier: string;
  feature_name: string;
  value?: string;
  traits?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export class FlagsmithClient {
  private readonly config: FlagsmithConfig;
  private readonly http: HttpClient;
  private readonly now: () => number;

  constructor(deps: { config: FlagsmithConfig; http: HttpClient; now?: () => number }) {
    this.config = deps.config;
    this.http = deps.http;
    this.now = deps.now ?? Date.now;
  }

  private async call(method: "GET" | "POST", path: string, body?: unknown): Promise<unknown> {
    const key = requireEnvironmentKey(this.config);
    const response = await this.http({
      method,
      url: `${this.config.apiUrl}${path}`,
      headers: { "X-Environment-Key": key },
      body,
    });
    if (response.status < 200 || response.status >= 300) {
      throw new FlagsmithApiError(method, path, response.status, response.json);
    }
    return response.json;
  }

  /**
   * Identify a swiper (creates the identity, stores the `source` trait) and read the variant the deck flag
   * serves them. Anonymous reads get no multivariate bucketing, so always go through here for swipers.
   */
  async assign(deckId: string, swiperGuid: string, flagName: string, source: SwipeSource): Promise<AssignmentResult> {
    const identifier = identityFor(deckId, swiperGuid);
    const json = await this.call("POST", "/api/v1/identities/", {
      identifier,
      traits: [{ trait_key: "source", trait_value: source }],
    });
    const flags = isObj(json) && Array.isArray(json.flags) ? json.flags.filter(isObj) : [];
    const flag = flags.find((f) => isObj(f.feature) && f.feature.name === flagName);
    const experiment = flag && isObj(flag.metadata) && isObj(flag.metadata.experiment) ? flag.metadata.experiment : null;
    return {
      identifier,
      variant: flag && typeof flag.variant === "string" && flag.variant !== "" ? flag.variant : null,
      value: flag ? (flag.feature_state_value ?? null) : null,
      enabled: flag?.enabled === true,
      inExperiment: experiment && typeof experiment.in_experiment === "boolean" ? experiment.in_experiment : null,
      experimentId: experiment && experiment.id !== undefined && experiment.id !== null ? String(experiment.id) : null,
      raw: json,
    };
  }

  /**
   * POST a batch to the events endpoint (eventsEndpoint: `${FLAGSMITH_EVENTS_URL}/v1/events`, or the core
   * `/api/v1/events/`). Body per api/experimentation/sdk_events.py SDKExperimentationEventSerializer; the
   * timestamp is always integer ms (seconds are rejected: MIN_TIMESTAMP_MS). A batch with nothing accepted comes
   * back as HTTP 400 with the same {accepted, rejected} body, which is returned here rather than thrown.
   */
  private async postEvents(events: EventBody[]): Promise<TrackEventResult> {
    const key = requireEnvironmentKey(this.config);
    const url = eventsEndpoint(this.config);
    const response = await this.http({ method: "POST", url, headers: { "X-Environment-Key": key }, body: { events } });
    const json = response.json;
    const counted = isObj(json) && typeof json.accepted === "number";
    const rejected = isObj(json) && Array.isArray(json.rejected) ? json.rejected : [];
    const ok = response.status >= 200 && response.status < 300;
    if (!ok && !(response.status === 400 && counted)) {
      throw new FlagsmithApiError("POST", url.replace(/^https?:\/\/[^/]+/, ""), response.status, json);
    }
    // Both the core view and the ingestion server (Flagsmith/ingestion-server src/routes/ingest.rs) answer
    // 202 {accepted, rejected}. A 2xx without a numeric `accepted` is read as everything accepted, so an
    // unexpected body never silently suppresses the conversions that follow.
    const accepted = counted ? (json as { accepted: number }).accepted : ok ? events.length - rejected.length : 0;
    return { sent: true, accepted, rejected };
  }

  /** Record reward_claim / answer_positive for an identity. Rejected events come back in `rejected`. */
  async trackEvent(input: TrackEventInput): Promise<TrackEventResult> {
    if (!input.counted) return { sent: false, accepted: 0, rejected: [] };
    return this.postEvents([
      {
        event: input.event,
        timestamp: Math.trunc(this.now()),
        identifier: identityFor(input.deckId, input.swiperGuid),
        feature_name: input.flagName,
        traits: { source: input.source },
      },
    ]);
  }

  /**
   * Record that this identity was shown a variant. Flagsmith counts exposures ONLY from `$flag_exposure`
   * events (value = variant key, feature_name required; sdk_events.py validate()); without them every variant
   * has n=0. Same payload as flagsmith-js-client event-processor.ts trackFlagExposure.
   */
  async trackExposure(input: TrackExposureInput): Promise<TrackEventResult> {
    if (!input.counted) return { sent: false, accepted: 0, rejected: [] };
    const experimentId =
      input.experimentId === undefined ? undefined : /^\d+$/.test(input.experimentId) ? Number(input.experimentId) : input.experimentId;
    return this.postEvents([
      {
        event: EXPOSURE_EVENT,
        timestamp: Math.trunc(this.now()),
        identifier: identityFor(input.deckId, input.swiperGuid),
        feature_name: input.flagName,
        value: input.variant,
        traits: { source: input.source },
        ...(experimentId !== undefined ? { metadata: { experiment_id: experimentId } } : {}),
      },
    ]);
  }

  /** Platform flags + remote config. Falls back to defaults for anything missing. */
  async getPlatformFlags(): Promise<PlatformFlags> {
    const json = await this.call("GET", "/api/v1/flags/");
    return parsePlatformFlags(json);
  }
}

/** Pure: map a /flags/ response onto PlatformFlags with defaults. */
export function parsePlatformFlags(json: unknown): PlatformFlags {
  const out: PlatformFlags = { ...PLATFORM_FLAG_DEFAULTS };
  const flags = Array.isArray(json) ? json.filter(isObj) : [];
  for (const f of flags) {
    const name = isObj(f.feature) ? f.feature.name : undefined;
    if (name === "check_card_rate") {
      const n = Number(f.feature_state_value);
      if (f.enabled === true && Number.isFinite(n) && n >= 1) out.check_card_rate = Math.floor(n);
    } else if (
      name === "paid_swiping" ||
      name === "boost_enabled" ||
      name === "language_cards" ||
      name === "assistant_ship"
    ) {
      out[name] = f.enabled === true;
    }
  }
  return out;
}
