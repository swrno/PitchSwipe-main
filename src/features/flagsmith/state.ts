/**
 * Small key-value state used for the results-refresh guard and the pre-ship
 * flag snapshots. In-memory by default; mongo-store.ts provides a durable one
 * (serverless instances do not share memory).
 */

export interface StateStore {
  get(key: string): Promise<unknown | null>;
  set(key: string, value: unknown): Promise<void>;
}

export function createMemoryStore(): StateStore {
  const data = new Map<string, unknown>();
  return {
    async get(key) {
      return data.has(key) ? (data.get(key) as unknown) : null;
    },
    async set(key, value) {
      data.set(key, value);
    },
  };
}

export const REFRESH_MIN_INTERVAL_MS = 5 * 60 * 1000;

export interface RefreshDecision {
  allowed: boolean;
  /** Milliseconds until the next refresh is allowed (0 when allowed). */
  retryAfterMs: number;
}

/** At most one results refresh per experiment per interval (Flagsmith advises 5 min). */
export class RefreshGuard {
  private readonly store: StateStore;
  private readonly intervalMs: number;
  private readonly now: () => number;

  constructor(store: StateStore, intervalMs: number = REFRESH_MIN_INTERVAL_MS, now: () => number = Date.now) {
    this.store = store;
    this.intervalMs = intervalMs;
    this.now = now;
  }

  private key(experimentId: string): string {
    return `refresh:${experimentId}`;
  }

  async check(experimentId: string): Promise<RefreshDecision> {
    const last = await this.store.get(this.key(experimentId));
    if (typeof last !== "number") return { allowed: true, retryAfterMs: 0 };
    const wait = last + this.intervalMs - this.now();
    return wait > 0 ? { allowed: false, retryAfterMs: wait } : { allowed: true, retryAfterMs: 0 };
  }

  /** Call when a refresh is about to be sent (failed attempts count too, to avoid hammering). */
  async mark(experimentId: string): Promise<void> {
    await this.store.set(this.key(experimentId), this.now());
  }
}
