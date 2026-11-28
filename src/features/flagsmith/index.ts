/**
 * Flagsmith wrapper. The ONLY module in the app that talks to Flagsmith.
 *
 * Server-only secret: FLAGSMITH_ADMIN_API_KEY. The browser may only use
 * NEXT_PUBLIC_FLAGSMITH_ENV_KEY (see getClientEnvironmentKey).
 *
 * Default-instance functions below use env config, a global fetch client and a
 * Mongo-backed state store when MONGODB_URI is set (in-memory otherwise). For
 * tests, build your own with createFlagsmith({ http, config, store }).
 *
 * When FLAGSMITH_ADMIN_API_KEY (or project / environment key) is unset, admin
 * methods throw FlagsmithNotConfigured; check with isNotConfigured(error) or
 * isAdminConfigured(loadConfig()) before calling.
 */
import { FlagsmithAdmin } from "./server/admin";
import { FlagsmithClient } from "./server/client";
import { loadConfig, type FlagsmithConfig } from "./server/config";
import { createFetchClient, type HttpClient } from "./server/http";
import { createMongoStore } from "./server/mongo-store";
import { RefreshGuard, createMemoryStore, type StateStore } from "./state";

export * from "./server/admin";
export * from "./server/client";
export * from "./errors";
export * from "./results";
export * from "./state";
export * from "./weights";
export { DEFAULT_EVENTS_URL, eventsEndpoint, isAdminConfigured, loadConfig, type FlagsmithConfig } from "./server/config";
export type { HttpClient, HttpRequest, HttpResponse } from "./server/http";

export interface FlagsmithInstance {
  admin: FlagsmithAdmin;
  client: FlagsmithClient;
}

export function createFlagsmith(
  options: { config?: FlagsmithConfig; http?: HttpClient; store?: StateStore; now?: () => number } = {},
): FlagsmithInstance {
  const config = options.config ?? loadConfig();
  const http = options.http ?? createFetchClient();
  const store = options.store ?? createMemoryStore();
  const now = options.now ?? Date.now;
  return {
    admin: new FlagsmithAdmin({ config, http, store, guard: new RefreshGuard(store, undefined, now), now }),
    client: new FlagsmithClient({ config, http, now }),
  };
}

let shared: FlagsmithInstance | undefined;

function instance(): FlagsmithInstance {
  shared ??= createFlagsmith({ store: process.env.MONGODB_URI ? createMongoStore() : createMemoryStore() });
  return shared;
}

/** Public client key for the swipe page and the founder snippet. */
export function getClientEnvironmentKey(): string | undefined {
  return process.env.NEXT_PUBLIC_FLAGSMITH_ENV_KEY || undefined;
}

/* Admin */
export const createDeckExperiment: FlagsmithAdmin["createDeckExperiment"] = (i) => instance().admin.createDeckExperiment(i);
export const launchDeckExperiment: FlagsmithAdmin["launchDeckExperiment"] = (i) => instance().admin.launchDeckExperiment(i);
export const getExperiment: FlagsmithAdmin["getExperiment"] = (id) => instance().admin.getExperiment(id);
export const startExperiment: FlagsmithAdmin["startExperiment"] = (id) => instance().admin.startExperiment(id);
export const getExperimentResults: FlagsmithAdmin["getExperimentResults"] = (id, c) =>
  instance().admin.getExperimentResults(id, c);
export const completeExperiment: FlagsmithAdmin["completeExperiment"] = (id, d) => instance().admin.completeExperiment(id, d);
export const setFlagWeights: FlagsmithAdmin["setFlagWeights"] = (f, c, w, o) =>
  instance().admin.setFlagWeights(f, c, w, o);
export const shipWinner: FlagsmithAdmin["shipWinner"] = (i) => instance().admin.shipWinner(i);
export const undoShip: FlagsmithAdmin["undoShip"] = (f, s) => instance().admin.undoShip(f, s);
export const archiveFlag: FlagsmithAdmin["archiveFlag"] = (f) => instance().admin.archiveFlag(f);
export const archiveFeature: FlagsmithAdmin["archiveFeature"] = (id) => instance().admin.archiveFeature(id);

/* Client */
export const assignSwiper: FlagsmithClient["assign"] = (d, g, f, s) => instance().client.assign(d, g, f, s);
export const trackEvent: FlagsmithClient["trackEvent"] = (i) => instance().client.trackEvent(i);
export const trackExposure: FlagsmithClient["trackExposure"] = (i) => instance().client.trackExposure(i);
export const getPlatformFlags: FlagsmithClient["getPlatformFlags"] = () => instance().client.getPlatformFlags();
