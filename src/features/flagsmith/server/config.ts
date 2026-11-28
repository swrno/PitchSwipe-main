import { FlagsmithNotConfigured } from "../errors";

export const DEFAULT_API_URL = "https://api.flagsmith.com";
/**
 * Where SDK events (`$flag_exposure`, reward_claim, answer_positive) go. Flagsmith's own SDKs post to
 * `https://events.api.flagsmith.com/v1/events` (flagsmith-js-client event-processor.ts DEFAULT_EVENTS_API_URL).
 * The core API's `/api/v1/events/` only accepts events when the environment's warehouse is the Flagsmith
 * database (Flagsmith/flagsmith api/experimentation/views.py: "This environment does not store events in Flagsmith.").
 */
export const DEFAULT_EVENTS_URL = "https://events.api.flagsmith.com";

export interface FlagsmithConfig {
  apiUrl: string;
  /** Events host (no trailing slash). Equal to apiUrl means "use the core API's /api/v1/events/". */
  eventsUrl: string;
  /** Server only. Never exposed to the browser. */
  adminKey?: string;
  /** "Api-Key" for organisation API keys (default), "Token" for user tokens. */
  authScheme: string;
  projectId?: string;
  /** The environment's client key. Used in admin paths ({env}) and as X-Environment-Key. */
  environmentKey?: string;
}

export interface AdminConfig extends FlagsmithConfig {
  adminKey: string;
  projectId: string;
  environmentKey: string;
}

type Env = Record<string, string | undefined>;

const trim = (url: string) => url.replace(/\/+$/, "");

/** True for Flagsmith Cloud API hosts (api.flagsmith.com, regional *.flagsmith.com). */
export function isFlagsmithCloud(apiUrl: string): boolean {
  try {
    const host = new URL(apiUrl).hostname.toLowerCase();
    return host === "flagsmith.com" || host.endsWith(".flagsmith.com");
  } catch {
    return false;
  }
}

/**
 * Default events host: Cloud's ingestion host for Cloud, otherwise the core API itself (self-hosted Flagsmith has
 * no events.api.flagsmith.com; posting a self-hosted environment key there is rejected and every event is lost).
 */
export function defaultEventsUrl(apiUrl: string): string {
  return isFlagsmithCloud(apiUrl) ? DEFAULT_EVENTS_URL : trim(apiUrl);
}

export function loadConfig(env: Env = process.env): FlagsmithConfig {
  const apiUrl = trim(env.FLAGSMITH_API_URL || DEFAULT_API_URL);
  return {
    apiUrl,
    eventsUrl: trim(env.FLAGSMITH_EVENTS_URL || defaultEventsUrl(apiUrl)),
    adminKey: env.FLAGSMITH_ADMIN_API_KEY || undefined,
    authScheme: env.FLAGSMITH_ADMIN_AUTH_SCHEME || "Api-Key",
    projectId: env.FLAGSMITH_PROJECT_ID || undefined,
    environmentKey: env.NEXT_PUBLIC_FLAGSMITH_ENV_KEY || undefined,
  };
}

/**
 * Full events endpoint. The dedicated events host takes `/v1/events`; when FLAGSMITH_EVENTS_URL is set to the
 * core API URL the core route `/api/v1/events/` is used instead (only works with the Flagsmith-database warehouse).
 */
export function eventsEndpoint(config: Pick<FlagsmithConfig, "apiUrl" | "eventsUrl">): string {
  const events = trim(config.eventsUrl || defaultEventsUrl(config.apiUrl));
  return events === trim(config.apiUrl) ? `${events}/api/v1/events/` : `${events}/v1/events`;
}

function missingAdmin(config: FlagsmithConfig): string[] {
  const missing: string[] = [];
  if (!config.adminKey) missing.push("FLAGSMITH_ADMIN_API_KEY");
  if (!config.projectId) missing.push("FLAGSMITH_PROJECT_ID");
  if (!config.environmentKey) missing.push("NEXT_PUBLIC_FLAGSMITH_ENV_KEY");
  return missing;
}

/** True when every admin env var is set (publish then runs on Flagsmith; otherwise it is a local split). */
export function isAdminConfigured(config: FlagsmithConfig): boolean {
  return missingAdmin(config).length === 0;
}

/** Admin calls need the admin key, the project id and the environment key. */
export function requireAdmin(config: FlagsmithConfig): AdminConfig {
  const missing = missingAdmin(config);
  if (missing.length > 0) throw new FlagsmithNotConfigured(missing);
  return config as AdminConfig;
}

/** Client (SDK endpoint) calls only need the public environment key. */
export function requireEnvironmentKey(config: FlagsmithConfig): string {
  if (!config.environmentKey) throw new FlagsmithNotConfigured(["NEXT_PUBLIC_FLAGSMITH_ENV_KEY"]);
  return config.environmentKey;
}
