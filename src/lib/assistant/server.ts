/** Default (env-backed) wiring for the assistant routes. Server only. */
import { getStore } from "@/lib/decks/store";

import { defaultMailer, noopMailer } from "./mailer";
import type { FlagsmithPort, ShipDeps } from "./ship";
import { createDeckSource, createResultsSource, demoReviewNote } from "./sources";
import { getAssistantStore } from "./store";
import type { WatcherDeps } from "./watcher";

let flagsmithPort: FlagsmithPort | undefined;

/** Flagsmith admin through the wrapper (the only module that talks to Flagsmith). Not used in demo mode. */
async function realFlagsmith(): Promise<FlagsmithPort> {
  if (flagsmithPort) return flagsmithPort;
  const { createFlagsmith } = await import("@/lib/flagsmith");
  const { createMemoryStore } = await import("@/lib/flagsmith/state");
  const store = process.env.MONGODB_URI ? (await import("@/lib/flagsmith/mongo-store")).createMongoStore() : createMemoryStore();
  const { admin } = createFlagsmith({ store });
  flagsmithPort = {
    snapshotFlag: (f) => admin.snapshotFlag(f),
    completeExperiment: (id, decision) => admin.completeExperiment(id, decision),
    optionIdsForFlag: (f) => admin.optionIdsForFlag(f),
    setFlagWeights: (f, c, w, o) => admin.setFlagWeights(f, c, w, o),
    undoShip: (f, s) => admin.undoShip(f, s),
  };
  return flagsmithPort;
}

/** One code-filled insight line from the Who swiped tabs (WP7). Null when there is none. */
async function insightFor(ownerId: string, deckId: string): Promise<string | null> {
  try {
    const { loadResults } = await import("@/lib/results/load");
    const payload = await loadResults(ownerId, deckId);
    const who = payload?.whoSwiped;
    return who?.target.insight?.body ?? who?.location.insight?.body ?? null;
  } catch {
    return null;
  }
}

/**
 * Demo mode has no cron, so nothing ever runs the watcher and the "Test decided" alert never appeared on My decks.
 * Run it once per server process (no mail is sent) so the demo headline deck raises its alert like production would.
 */
const demoSeed = globalThis as unknown as { __pitchswipeDemoAlertSeed?: Promise<unknown> };
async function seedDemoAlerts(): Promise<void> {
  demoSeed.__pitchswipeDemoAlertSeed ??= import("./watcher")
    .then(({ runWatcher }) =>
      runWatcher({
        decks: createDeckSource(),
        results: createResultsSource(),
        store: getAssistantStore(),
        mailer: noopMailer,
        baseUrl: "http://localhost:3000",
      }),
    )
    .catch((error) => console.error("assistant: demo alert seed failed", error instanceof Error ? error.message : error));
  await demoSeed.__pitchswipeDemoAlertSeed;
}

/** Domain of the product's connected website, for the "your website switches too" step. Null when none is connected. */
async function siteDomainFor(ownerId: string, deckId: string, demo: boolean): Promise<string | null> {
  try {
    const { siteDeps } = await import("@/lib/sites/server");
    const { DEMO_DOMAIN, DEMO_PRODUCT_ID } = await import("@/lib/sites/service");
    const deps = await siteDeps();
    const ctx = await deps.catalog.getDeckContext(ownerId, deckId);
    if (!ctx) return null;
    const site = await deps.sites.getByProduct(ctx.productId);
    if (site?.domain) return site.domain;
    return demo && ctx.productId === DEMO_PRODUCT_ID ? DEMO_DOMAIN : null;
  } catch {
    return null;
  }
}

export async function shipDeps(): Promise<ShipDeps> {
  const demo = (await getStore()).demo;
  if (demo) await seedDemoAlerts();
  return {
    decks: createDeckSource(),
    results: createResultsSource(),
    store: getAssistantStore(),
    flagsmith: demo ? null : await realFlagsmith(),
    insight: (deck) => insightFor(deck.ownerId, deck.deckId),
    siteDomain: (deck) => siteDomainFor(deck.ownerId, deck.deckId, demo),
    demoNote: demo ? demoReviewNote : undefined,
  };
}

export function watcherDeps(): WatcherDeps {
  return {
    decks: createDeckSource(),
    results: createResultsSource(),
    store: getAssistantStore(),
    mailer: defaultMailer(),
    baseUrl: process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000",
  };
}
