/** Typed errors for the Flagsmith wrapper. */

/** Thrown by every method when the env vars it needs are missing. API routes map this to 503. */
export class FlagsmithNotConfigured extends Error {
  readonly code = "FLAGSMITH_NOT_CONFIGURED";
  readonly missing: string[];

  constructor(missing: string[]) {
    super(`Flagsmith is not configured. Set: ${missing.join(", ")} (see .env.example).`);
    this.name = "FlagsmithNotConfigured";
    this.missing = missing;
  }
}

/** Non-2xx answer from Flagsmith. The body is kept for debugging; it never contains our keys. */
export class FlagsmithApiError extends Error {
  readonly code = "FLAGSMITH_API_ERROR";
  readonly status: number;
  readonly method: string;
  readonly path: string;
  readonly body: unknown;

  constructor(method: string, path: string, status: number, body: unknown) {
    super(`Flagsmith ${method} ${path} failed with HTTP ${status}`);
    this.name = "FlagsmithApiError";
    this.status = status;
    this.method = method;
    this.path = path;
    this.body = body;
  }
}

/** Input the wrapper refuses before any network call (bad weights, unknown variant key, ...). */
export class FlagsmithInvalidInput extends Error {
  readonly code = "FLAGSMITH_INVALID_INPUT";

  constructor(message: string) {
    super(message);
    this.name = "FlagsmithInvalidInput";
  }
}

export function isNotConfigured(error: unknown): error is FlagsmithNotConfigured {
  return error instanceof FlagsmithNotConfigured;
}

/**
 * A direct feature-state write was refused because the environment uses v2 feature versioning
 * (Flagsmith api/features/versioning/exceptions.py DirectFeatureStateWriteNotAllowedError, HTTP 400).
 * Shipping the winning text and undo both need v1 versioning for the PitchSwipe environment.
 */
export class FlagsmithVersioningError extends Error {
  readonly code = "FLAGSMITH_V2_VERSIONING";
  readonly body: unknown;

  constructor(body: unknown) {
    super(
      "Flagsmith refused the flag update: this environment uses v2 feature versioning. " +
        "Turn feature versioning off for the PitchSwipe environment (or ship from the Flagsmith dashboard).",
    );
    this.name = "FlagsmithVersioningError";
    this.body = body;
  }
}

/**
 * complete was refused because the experiment is already completed, but with a different rollout decision than
 * the one being shipped (e.g. someone chose "disable" or another variant in the Flagsmith dashboard).
 * The message is safe to show the founder.
 */
export class FlagsmithCompletedDifferently extends Error {
  readonly code = "FLAGSMITH_COMPLETED_DIFFERENTLY";
  readonly rolloutDecision: string | null;
  readonly rolloutVariant: number | null;

  constructor(rolloutDecision: string | null, rolloutVariant: number | null) {
    const what =
      rolloutDecision === "disable"
        ? "the flag turned off"
        : rolloutDecision === "variant"
          ? "a different card rolled out"
          : rolloutDecision === "control"
            ? "the control card rolled out"
            : "no recorded decision";
    super(`This experiment was already completed in Flagsmith with ${what}. Nothing was shipped; check the Flagsmith dashboard.`);
    this.name = "FlagsmithCompletedDifferently";
    this.rolloutDecision = rolloutDecision;
    this.rolloutVariant = rolloutVariant;
  }
}

/** Publishing a deck to Flagsmith failed at `step`; the half-made flag was archived when `cleanedUp`. */
export class FlagsmithPublishError extends Error {
  readonly code = "FLAGSMITH_PUBLISH_FAILED";
  readonly step: string;
  readonly original: unknown;
  readonly cleanedUp: boolean;
  /** The half-made flag that could NOT be archived (only when cleanedUp is false); store it and archive it later. */
  readonly orphanFeatureId?: number;

  constructor(step: string, cause: unknown, cleanedUp: boolean, orphanFeatureId?: number) {
    super(`Flagsmith publish failed while ${step}: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = "FlagsmithPublishError";
    this.step = step;
    this.original = cause;
    this.cleanedUp = cleanedUp;
    if (orphanFeatureId !== undefined) this.orphanFeatureId = orphanFeatureId;
  }

  /** Short text that is safe to store on the deck and show the founder (no response bodies, no keys). */
  get safeReason(): string {
    const status = this.original instanceof FlagsmithApiError ? ` (HTTP ${this.original.status})` : "";
    return `Flagsmith failed while ${this.step}${status}`;
  }
}

/** Flagsmith answered 2xx but the body lacks something we need (shape is partly unpublished). */
export class FlagsmithUnexpectedResponse extends Error {
  readonly code = "FLAGSMITH_UNEXPECTED_RESPONSE";
  readonly body: unknown;

  constructor(message: string, body: unknown) {
    super(message);
    this.name = "FlagsmithUnexpectedResponse";
    this.body = body;
  }
}
