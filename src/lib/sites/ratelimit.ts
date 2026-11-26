/** Fixed-window in-memory rate limiter for the public ping endpoint. Per server instance only. */

export interface RateLimiter {
  /** True when the call is allowed. */
  take(key: string, now?: number): boolean;
}

export function createRateLimiter(opts: { limit: number; windowMs: number; maxKeys?: number }): RateLimiter {
  const hits = new Map<string, { start: number; count: number }>();
  const maxKeys = opts.maxKeys ?? 5000;
  return {
    take(key, now = Date.now()) {
      const entry = hits.get(key);
      if (!entry || now - entry.start >= opts.windowMs) {
        if (!entry && hits.size >= maxKeys) {
          for (const [k, v] of hits) if (now - v.start >= opts.windowMs) hits.delete(k);
          if (hits.size >= maxKeys) return false;
        }
        hits.set(key, { start: now, count: 1 });
        return true;
      }
      entry.count += 1;
      return entry.count <= opts.limit;
    },
  };
}
