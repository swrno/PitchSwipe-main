/**
 * Deck lifecycle hooks into the Flagsmith experiment engine (WP6). Server only.
 *
 * Publish:
 *  - demo mode: nothing reaches Flagsmith;
 *  - Flagsmith not configured: {} (the deck runs a local split);
 *  - configured: create the flag, one keyed option per challenger, metrics, the experiment, start it, and return
 *    the ids to store on the deck. On ANY failure the half-made flag is archived (admin.ts), the reason is logged
 *    here, and `flagsmithError` (short, safe text) is returned so the deck STILL goes live on a local split.
 * Archive: archive the flag (a running experiment is left as it is); failures are logged, never thrown. A shipped
 * deck, or one whose experiment Flagsmith shows as completed, keeps its flag: it is the flag now serving the
 * winning (or, after undo, the control) text to the share link and the founder's website. When the experiment's
 * status cannot be read (Flagsmith down, no status), the flag is kept and the failure logged: fail closed.
 * A half-made flag whose cleanup failed at publish is stored as `featureId` (with no experimentId) and archived here.
 *
 * The pure functions take their dependencies so tests can drive them with a fake Flagsmith.
 */
import type { DeckRecord } from "./types";

export interface PublishHookResult {
  /** Stored as `deck.experimentId` once the experiment exists and has started. */
  experimentId?: string;
  /** The flag name actually created, when it differs from `deck.flagName` (a retry with a fresh suffix). */
  flagName?: string;
  featureId?: number;
  optionIds?: Record<string, number>;
  rewardMetricId?: string;
  /** Why the deck is not running on Flagsmith (safe to show the founder). */
  flagsmithError?: string;
  /** With flagsmithError: a half-made flag that could not be archived; stored as the deck's featureId so archive cleans it up. */
  orphanFeatureId?: number;
}

/** The slice of the Flagsmith admin the hooks use. */
export interface FlagsmithLifecyclePort {
  launchDeckExperiment(input: {
    deckId: string;
    flagName: string;
    variantKeys: string[];
    variantValues?: Record<string, string>;
  }): Promise<{
    experimentId: string;
    flagName: string;
    featureId: number;
    optionIds: Record<string, number>;
    rewardMetricId: string;
  }>;
  archiveFeature(featureId: number): Promise<void>;
  archiveFlag(flagName: string): Promise<void>;
  /** Experiment status ("running", "completed", ...); used to keep the flag of a completed experiment. */
  getExperiment?(experimentId: string): Promise<{ status: string | null }>;
}

export interface HookDeps {
  demo: boolean;
  /** Null when Flagsmith is not configured. */
  flagsmith: FlagsmithLifecyclePort | null;
  log?: Pick<Console, "info" | "warn" | "error">;
}

/** Control first: the stores order cards by variant key, and the swipe side treats cards[0] as control. */
function orderedCards(deck: DeckRecord) {
  return deck.cards.slice().sort((a, b) => a.variantKey.localeCompare(b.variantKey));
}

/** The flag value of a card: its text, or (logos, screens, language cards) its variant key. */
function flagValue(value: unknown, variantKey: string): string {
  return typeof value === "string" && value.trim() !== "" ? value : variantKey;
}

function safeReason(error: unknown): string {
  const reason = (error as { safeReason?: unknown })?.safeReason;
  if (typeof reason === "string") return reason;
  if ((error as { name?: unknown })?.name === "FlagsmithInvalidInput" && error instanceof Error) return error.message;
  return "Flagsmith could not be reached";
}

export async function publishToFlagsmith(deck: DeckRecord, deps: HookDeps): Promise<PublishHookResult> {
  if (deps.demo || !deps.flagsmith) return {};
  const log = deps.log ?? console;
  const cards = orderedCards(deck);
  try {
    const out = await deps.flagsmith.launchDeckExperiment({
      deckId: deck._id,
      flagName: deck.flagName,
      variantKeys: cards.map((c) => c.variantKey),
      variantValues: Object.fromEntries(cards.map((c) => [c.variantKey, flagValue(c.value, c.variantKey)])),
    });
    log.info("decks: experiment running on Flagsmith", deck._id, out.flagName, out.experimentId);
    return {
      experimentId: out.experimentId,
      ...(out.flagName !== deck.flagName ? { flagName: out.flagName } : {}),
      featureId: out.featureId,
      optionIds: out.optionIds,
      rewardMetricId: out.rewardMetricId,
    };
  } catch (error) {
    const reason = safeReason(error);
    log.error("decks: Flagsmith publish failed; deck runs a local split", deck._id, error instanceof Error ? error.message : error);
    const orphan = (error as { orphanFeatureId?: unknown })?.orphanFeatureId;
    if (typeof orphan === "number") {
      log.error("decks: half-made Flagsmith flag left unarchived; it is archived with the deck", deck._id, orphan);
      return { flagsmithError: reason, orphanFeatureId: orphan };
    }
    return { flagsmithError: reason };
  }
}

/** `deck` is the deck as it was BEFORE archiving (its status tells whether it was shipped). */
export async function archiveOnFlagsmith(deck: DeckRecord, deps: HookDeps): Promise<void> {
  if (deps.demo || !deps.flagsmith) return;
  if (!deck.experimentId && deck.featureId === undefined) return; // local split: no flag was created
  const log = deps.log ?? console;
  if (deck.status === "shipped") {
    log.info("decks: shipped deck archived; its Flagsmith flag stays (it serves the winner)", deck._id, deck.flagName);
    return;
  }
  if (deck.experimentId && deps.flagsmith.getExperiment) {
    let status: string | null;
    try {
      status = (await deps.flagsmith.getExperiment(deck.experimentId)).status;
    } catch (error) {
      status = null;
      log.error("decks: could not read the Flagsmith experiment", deck._id, error instanceof Error ? error.message : error);
    }
    // Fail closed: without a known status the flag may be the one serving an undone ship's control text to the
    // website (an undone deck is "decided", not "shipped"), so it stays rather than being archived on a guess.
    if (status === null) {
      log.error("decks: experiment status unknown; the Flagsmith flag was NOT archived", deck._id, deck.flagName);
      return;
    }
    if (status === "completed") {
      log.info("decks: experiment already completed; its Flagsmith flag stays", deck._id, deck.flagName);
      return;
    }
  }
  try {
    if (deck.featureId !== undefined) await deps.flagsmith.archiveFeature(deck.featureId);
    else await deps.flagsmith.archiveFlag(deck.flagName);
  } catch (error) {
    log.error("decks: could not archive the Flagsmith flag", deck._id, deck.flagName, error instanceof Error ? error.message : error);
  }
}

let depsOverride: HookDeps | null = null;

/** Test seam: run the deck service's hooks against a fake Flagsmith (null restores the env-backed deps). */
export function setHookDepsForTests(deps: HookDeps | null): void {
  depsOverride = deps;
}

async function defaultDeps(): Promise<HookDeps> {
  if (depsOverride) return depsOverride;
  const { isDemoMode } = await import("./store");
  if (isDemoMode()) return { demo: true, flagsmith: null };
  const flagsmith = await import("@/lib/flagsmith");
  if (!flagsmith.isAdminConfigured(flagsmith.loadConfig())) return { demo: false, flagsmith: null };
  return {
    demo: false,
    flagsmith: {
      launchDeckExperiment: (i) => flagsmith.launchDeckExperiment(i),
      archiveFeature: (id) => flagsmith.archiveFeature(id),
      archiveFlag: (name) => flagsmith.archiveFlag(name),
      getExperiment: (id) => flagsmith.getExperiment(id),
    },
  };
}

/** Called by the server right before a deck is saved as "live". Never throws. */
export async function onDeckPublished(deck: DeckRecord, deps?: HookDeps): Promise<PublishHookResult> {
  try {
    return await publishToFlagsmith(deck, deps ?? (await defaultDeps()));
  } catch (error) {
    console.error("decks: publish hook failed", deck._id, error instanceof Error ? error.message : error);
    return { flagsmithError: "Flagsmith could not be reached" };
  }
}

/**
 * Called when a deck is archived, with the deck as it was BEFORE archiving. Never throws into the founder's
 * archive action.
 */
export async function onDeckArchived(deck: DeckRecord, deps?: HookDeps): Promise<void> {
  try {
    await archiveOnFlagsmith(deck, deps ?? (await defaultDeps()));
  } catch (error) {
    console.error("decks: archive hook failed", deck._id, error instanceof Error ? error.message : error);
  }
}
