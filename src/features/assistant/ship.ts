/**
 * Review, approve-and-ship, undo and snooze (spec 05 6.6 steps 4 to 7).
 *
 * The ONLY path that changes a flag is shipDeck, and it needs `approve === true` from the
 * authenticated owner of the deck. It re-reads Flagsmith and re-applies the decided rule
 * itself: the client's word about who won is never trusted, and code never overrides Flagsmith.
 *
 * Sequence: snapshot, complete WITH the rollout decision ({rollout_decision: "control"} or
 * {rollout_decision: "variant", rollout_variant: <option id>}; Flagsmith then serves the winner to identities and
 * removes the rollout override), re-read the flag (diagnostic), then PUT the winning text + 100/0 so anonymous
 * readers of the share link get the winner too. A refused complete is tolerated ONLY when Flagsmith shows the
 * experiment as completed (the wrapper checks); anything else aborts before the flag is touched. If complete
 * succeeded but the text write fails (e.g. v2 feature versioning), the ship stands (Flagsmith already applied the
 * decision) and the error is recorded and shown.
 */
import { rolloutDecisionFor, type FlagSnapshot, type RolloutDecisionInput } from "@/features/flagsmith/server/admin";
import { FlagsmithApiError, FlagsmithCompletedDifferently, FlagsmithVersioningError } from "@/features/flagsmith/errors";

import { alertView, reviewView, shippedView } from "./copy";
import { assessDeck } from "./decided";
import { snoozeUntil } from "./alerts";
import type { DeckSource, ResultsSource } from "./server/sources";
import type { AssistantStore } from "./server/store";
import type { AlertView, ReviewView, ShipRecord, ShippedView, WatchedDeck } from "./types";

/** The subset of the Flagsmith wrapper the ship path uses (injectable for tests). */
export interface FlagsmithPort {
  snapshotFlag(flagName: string): Promise<unknown>;
  /** Throws unless Flagsmith completed it (a refused complete counts only when the experiment shows "completed"). */
  completeExperiment(
    experimentId: string,
    decision: RolloutDecisionInput,
  ): Promise<{ alreadyCompleted: boolean; response: unknown }>;
  /** Option id per challenger key, read from the flag (used when the deck has no stored optionIds). */
  optionIdsForFlag(flagName: string): Promise<Record<string, number>>;
  setFlagWeights(
    flagName: string,
    controlKey: string,
    weights: Record<string, number>,
    options?: { featureStateValue?: string; optionIds?: Record<string, number>; enabled?: boolean },
  ): Promise<void>;
  undoShip(flagName: string, snapshot?: FlagSnapshot): Promise<unknown>;
}

export interface ShipDeps {
  decks: DeckSource;
  results: ResultsSource;
  store: AssistantStore;
  flagsmith: FlagsmithPort;
  now?: () => Date;
  /** Optional code-filled insight line for the review sheet. */
  insight?: (deck: WatchedDeck) => Promise<string | null>;
  /** Domain of the product's connected website (WP9), when there is one. */
  siteDomain?: (deck: WatchedDeck) => Promise<string | null>;
}

export type Outcome<T> = { ok: true; value: T } | { ok: false; status: number; error: string };
const fail = (status: number, error: string): { ok: false; status: number; error: string } => ({ ok: false, status, error });

const TEXT_NOUNS = new Set(["headline", "description", "reward", "price", "language"]);
const inFlight = new Set<string>();

const activeShip = (s: ShipRecord | null): s is ShipRecord => s !== null && !s.undoneAt;

/**
 * Founder-safe text for a failed flag write. Raw errors (admin paths, feature-state ids, transport detail) go to
 * the server log only; the stored ShipRecord and the shipped screen get this.
 */
export function safeWriteError(error: unknown): string {
  if (error instanceof FlagsmithVersioningError || (error as { code?: unknown })?.code === "FLAGSMITH_V2_VERSIONING") {
    return (error as Error).message;
  }
  if (error instanceof FlagsmithApiError) return `Flagsmith did not accept the new text (HTTP ${error.status}).`;
  return "Flagsmith did not accept the new text.";
}

/** Data for the review sheet. Read only. */
export async function getReview(deps: ShipDeps, ownerId: string, deckId: string): Promise<Outcome<ReviewView>> {
  const deck = await deps.decks.getForOwner(ownerId, deckId);
  if (!deck) return fail(404, "Test not found.");
  const ship = await deps.store.getShip(deckId);
  const { results, swipers } = await deps.results.get(deck, { now: deps.now?.() });
  const assessment = assessDeck(results, deck.controlKey, swipers);
  const insight = assessment.decided && deps.insight ? await deps.insight(deck).catch(() => null) : null;
  return {
    ok: true,
    value: reviewView({
      deck,
      chances: assessment.chances,
      winnerKey: assessment.decided ? assessment.winnerKey : null,
      swipers,
      insight,
      alreadyShipped: activeShip(ship),
      siteDomain: deps.siteDomain ? await deps.siteDomain(deck).catch(() => null) : null,
      notDecidedText: assessment.decided
        ? undefined
        : assessment.reason === "too_close"
          ? "Too close to call. Nothing is ready to ship."
          : "Still collecting swipes. Nothing is ready to ship.",
    }),
  };
}

export async function getShipped(deps: ShipDeps, ownerId: string, deckId: string): Promise<Outcome<ShippedView>> {
  const deck = await deps.decks.getForOwner(ownerId, deckId);
  const ship = await deps.store.getShip(deckId);
  if (!deck || !ship || ship.ownerId !== ownerId) return fail(404, "Nothing shipped for this test.");
  return { ok: true, value: shippedView(deck, ship, deps.siteDomain ? await deps.siteDomain(deck).catch(() => null) : null) };
}

export async function shipDeck(
  deps: ShipDeps,
  input: { ownerId: string; deckId: string; approve: unknown; winnerKey?: unknown },
): Promise<Outcome<ShippedView>> {
  if (input.approve !== true) return fail(400, "Shipping needs your approval (approve: true).");
  const now = deps.now ?? (() => new Date());
  const deck = await deps.decks.getForOwner(input.ownerId, input.deckId);
  if (!deck) return fail(404, "Test not found.");
  if (inFlight.has(deck.deckId)) return fail(409, "A ship is already in progress for this test.");
  inFlight.add(deck.deckId);
  try {
    const existing = await deps.store.getShip(deck.deckId);
    if (activeShip(existing)) return fail(409, "This test is already shipped.");

    const { results, swipers } = await deps.results.get(deck, { now: now() });
    const assessment = assessDeck(results, deck.controlKey, swipers);
    if (!assessment.decided) return fail(409, "The test is no longer decided, so nothing was shipped.");
    if (typeof input.winnerKey === "string" && input.winnerKey !== assessment.winnerKey) {
      return fail(409, `Flagsmith now reports ${assessment.winnerKey} as the winner, not ${input.winnerKey}. Review again.`);
    }
    const winnerKey = assessment.winnerKey;
    const at = now().toISOString();
    const events = (type: "approved" | "shipped") =>
      deps.store.addEvent({
        deckId: deck.deckId,
        type,
        chances: assessment.chances.map((c) => ({ cardId: c.cardId, key: c.key, chance: c.chance })),
        swipers: swipers ?? 0,
        checksPassed: true,
        at,
      });
    await events("approved");

    const keys = deck.cards.map((c) => c.key);
    const weights = Object.fromEntries(keys.map((k) => [k, k === winnerKey ? 100 : 0]));
    const winnerText = deck.cards.find((c) => c.key === winnerKey)?.text;
    const record: ShipRecord = {
      deckId: deck.deckId,
      ownerId: deck.ownerId,
      winnerKey,
      approvedBy: deck.ownerName,
      approvedAt: at,
      chances: assessment.chances,
      weights,
      previousSnapshot: null,
      completeResponse: null,
      completeConfirmed: false,
    };

    const fm = deps.flagsmith;
    if (!deck.experimentId) return fail(409, "This test has no Flagsmith experiment.");
    record.previousSnapshot = await fm.snapshotFlag(deck.flagName);
    // Durable before any change, so undo works even if the next steps fail halfway.
    await deps.store.saveShip(record);
    let optionIds: Record<string, number>;
    let decision: RolloutDecisionInput;
    try {
      optionIds = deck.optionIds ?? (await fm.optionIdsForFlag(deck.flagName));
      decision = rolloutDecisionFor(deck.controlKey, winnerKey, optionIds);
      record.rolloutDecision = decision;
    } catch (error) {
      record.completeError = error instanceof Error ? error.message : String(error);
      console.warn("assistant: no Flagsmith option for the winner", deck.deckId, record.completeError);
      await deps.store.saveShip({ ...record, undoneAt: at });
      return fail(502, "Flagsmith has no option for the winning card, so nothing was shipped.");
    }
    try {
      const out = await fm.completeExperiment(deck.experimentId, decision);
      record.completeResponse = out.response;
      record.completeConfirmed = true;
      if (out.alreadyCompleted) record.completeError = "Flagsmith had already completed this experiment.";
      console.info("assistant: flagsmith complete response", deck.deckId, JSON.stringify(record.completeResponse));
    } catch (error) {
      record.completeError = error instanceof Error ? error.message : String(error);
      record.completeResponse = (error as { body?: unknown }).body ?? null;
      console.warn("assistant: flagsmith complete failed", deck.deckId, record.completeError, JSON.stringify(record.completeResponse));
      await deps.store.saveShip({ ...record, undoneAt: at });
      // Completed in the dashboard with another decision: retrying cannot help, and shipping over it would
      // serve a flag the founder did not choose (e.g. one left disabled).
      if (error instanceof FlagsmithCompletedDifferently) return fail(409, error.message);
      return fail(502, "Flagsmith could not end the experiment, so nothing was shipped. Try again.");
    }
    try {
      record.afterCompleteSnapshot = await fm.snapshotFlag(deck.flagName);
      console.info("assistant: flag after complete", deck.deckId, JSON.stringify(record.afterCompleteSnapshot));
    } catch {
      /* diagnostic only */
    }
    try {
      await fm.setFlagWeights(deck.flagName, deck.controlKey, weights, {
        featureStateValue: TEXT_NOUNS.has(deck.noun) && winnerText ? winnerText : undefined,
        optionIds,
        enabled: true, // the winner must be served even if the flag was left disabled
      });
    } catch (error) {
      // Complete already applied the decision in Flagsmith, so the ship stands; the share link and website may
      // still show the old text. A safe summary is recorded and shown; the raw error is logged only.
      record.valueWriteError = safeWriteError(error);
      console.error("assistant: could not write the winning text to the flag", deck.deckId, error instanceof Error ? error.message : error);
    }
    await deps.store.saveShip(record);
    await deps.decks.setStatus(deck.ownerId, deck.deckId, "shipped");
    const alert = await deps.store.getAlert(deck.deckId);
    if (alert) await deps.store.saveAlert({ ...alert, status: "shipped", updatedAt: at, read: true });
    await events("shipped");
    return { ok: true, value: shippedView(deck, record, deps.siteDomain ? await deps.siteDomain(deck).catch(() => null) : null) };
  } finally {
    inFlight.delete(deck.deckId);
  }
}

/**
 * Writes the control state back (control value, every option at 0%, enabled), which serves the CONTROL card to
 * everyone (the test split lived in the experiment's rollout override, which complete removed; see
 * admin.undoShip). The experiment stays completed and cannot restart.
 */
export async function undoDeck(deps: ShipDeps, input: { ownerId: string; deckId: string }): Promise<Outcome<{ undone: true }>> {
  const deck = await deps.decks.getForOwner(input.ownerId, input.deckId);
  if (!deck) return fail(404, "Test not found.");
  const ship = await deps.store.getShip(deck.deckId);
  if (!activeShip(ship)) return fail(409, "There is nothing to undo for this test.");
  const at = (deps.now ?? (() => new Date()))().toISOString();
  if (!ship.previousSnapshot) return fail(409, "No saved flag state to restore.");
  // undoShip writes the control state (every option at 0%, enabled), never the snapshot's weights, which may have
  // been read after an earlier attempt's complete went through. The snapshot's VALUE is still the control value:
  // complete does not change it, and the snapshot is always taken before this ship writes the winner's text.
  await deps.flagsmith.undoShip(deck.flagName, ship.previousSnapshot as FlagSnapshot);
  await deps.store.saveShip({ ...ship, undoneAt: at });
  await deps.decks.setStatus(deck.ownerId, deck.deckId, "unshipped");
  await deps.store.addEvent({
    deckId: deck.deckId,
    type: "undone",
    chances: ship.chances.map((c) => ({ cardId: c.cardId, key: c.key, chance: c.chance })),
    swipers: 0,
    checksPassed: true,
    at,
  });
  return { ok: true, value: { undone: true } };
}

/** "Later": hide the alert for 24 hours. */
export async function snoozeAlert(deps: ShipDeps, input: { ownerId: string; deckId: string }): Promise<Outcome<{ snoozedUntil: string }>> {
  const alert = await deps.store.getAlert(input.deckId);
  if (!alert || alert.ownerId !== input.ownerId) return fail(404, "No alert for this test.");
  if (alert.status !== "active") return fail(409, "This alert is not active.");
  const now = (deps.now ?? (() => new Date()))();
  const until = snoozeUntil(now);
  await deps.store.saveAlert({ ...alert, status: "snoozed", snoozedUntil: until, updatedAt: now.toISOString() });
  return { ok: true, value: { snoozedUntil: until } };
}

/** Alerts for My decks and the notification list: active ones, plus snoozed ones whose time is up. */
export async function listAlerts(deps: ShipDeps, ownerId: string): Promise<AlertView[]> {
  const now = (deps.now ?? (() => new Date()))().getTime();
  const out: AlertView[] = [];
  for (const a of await deps.store.listAlerts(ownerId)) {
    const due = a.status === "snoozed" && a.snoozedUntil !== undefined && Date.parse(a.snoozedUntil) <= now;
    if (a.status !== "active" && !due) continue;
    const deck = await deps.decks.getForOwner(ownerId, a.deckId);
    if (!deck) continue;
    out.push(alertView({ ...a, status: "active" }, deck));
  }
  return out.sort((x, y) => Date.parse(y.raisedAt) - Date.parse(x.raisedAt));
}

export async function markRead(deps: ShipDeps, input: { ownerId: string; deckId: string }): Promise<void> {
  const alert = await deps.store.getAlert(input.deckId);
  if (alert && alert.ownerId === input.ownerId) await deps.store.saveAlert({ ...alert, read: true });
}
