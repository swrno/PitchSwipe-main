/**
 * The 5-minute watcher (spec 05 6.6 steps 1 to 3). For each live deck: read Flagsmith
 * results (the wrapper refreshes at most once per 5 minutes), apply the decided rule,
 * record an `assistantEvents` row, and raise or withdraw the alert. It never ships,
 * stops or changes a test or a flag.
 */
import { chanceOf, emailTexts } from "./copy";
import { assessDeck } from "./decided";
import { nextAlertAction } from "./alerts";
import type { Mailer } from "./mailer";
import type { DeckSource, ResultsSource } from "./sources";
import type { AssistantStore } from "./store";
import type { AlertRecord, Assessment, WatchedDeck } from "./types";

export interface WatcherDeps {
  decks: DeckSource;
  results: ResultsSource;
  store: AssistantStore;
  mailer: Mailer;
  /** Public app origin for the email link. */
  baseUrl: string;
  now?: () => Date;
}

export interface WatchOutcome {
  deckId: string;
  action: "raised" | "refreshed" | "resurfaced" | "withdrawn" | "none" | "error";
  decided: boolean;
  emailed?: boolean;
  error?: string;
}

const eventChances = (a: Assessment) => a.chances.map((c) => ({ cardId: c.cardId, key: c.key, chance: c.chance }));

async function checkDeck(deck: WatchedDeck, deps: WatcherDeps, now: Date): Promise<WatchOutcome> {
  const ship = await deps.store.getShip(deck.deckId);
  // A shipped deck (even one whose ship was undone) is never re-alerted.
  if (ship) return { deckId: deck.deckId, action: "none", decided: false };

  const { results, swipers } = await deps.results.get(deck, { now });
  const assessment = assessDeck(results, deck.controlKey, swipers);
  const at = now.toISOString();
  await deps.store.addEvent({
    deckId: deck.deckId,
    type: "checked",
    chances: eventChances(assessment),
    swipers: swipers ?? 0,
    checksPassed: assessment.checksPassed,
    at,
  });

  const existing = await deps.store.getAlert(deck.deckId);
  const action = nextAlertAction(existing, assessment, now);
  const base = { deckId: deck.deckId, decided: assessment.decided };

  if (action.kind === "withdraw" && existing) {
    await deps.store.saveAlert({ ...existing, status: "withdrawn", updatedAt: at });
    await deps.decks.setStatus(deck.ownerId, deck.deckId, "live");
    return { ...base, action: "withdrawn" };
  }

  if (!assessment.decided) return { ...base, action: "none" };

  const winnerChance = chanceOf(assessment.chances, assessment.winnerKey);
  const fields = { winnerKey: assessment.winnerKey, chances: assessment.chances, swipers, updatedAt: at };

  if (action.kind === "raise") {
    const alert: AlertRecord = { deckId: deck.deckId, ownerId: deck.ownerId, status: "active", createdAt: at, read: false, ...fields };
    await deps.store.addEvent({
      deckId: deck.deckId,
      type: "decided",
      chances: eventChances(assessment),
      swipers: swipers ?? 0,
      checksPassed: true,
      at,
    });
    await deps.decks.setStatus(deck.ownerId, deck.deckId, "decided");
    let emailed = false;
    if (deck.ownerEmail) {
      const mail = emailTexts(deck, assessment.winnerKey, winnerChance, swipers, `${deps.baseUrl}/decks/${encodeURIComponent(deck.deckId)}`);
      emailed = await deps.mailer.send({ to: deck.ownerEmail, ...mail });
      if (emailed) alert.emailedAt = at;
    }
    await deps.store.saveAlert(alert);
    return { ...base, action: "raised", emailed };
  }

  if (existing && (action.kind === "refresh" || action.kind === "resurface")) {
    await deps.store.saveAlert({
      ...existing,
      ...fields,
      status: "active",
      snoozedUntil: undefined,
      read: action.kind === "resurface" ? false : existing.read,
    });
    return { ...base, action: action.kind === "refresh" ? "refreshed" : "resurfaced" };
  }
  return { ...base, action: "none" };
}

export async function runWatcher(deps: WatcherDeps): Promise<WatchOutcome[]> {
  const now = (deps.now ?? (() => new Date()))();
  const decks = await deps.decks.listWatchable();
  const out: WatchOutcome[] = [];
  for (const deck of decks) {
    try {
      out.push(await checkDeck(deck, deps, now));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("assistant: check failed", deck.deckId, message);
      out.push({ deckId: deck.deckId, action: "error", decided: false, error: message });
    }
  }
  return out;
}
