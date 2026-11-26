/**
 * In-memory fixed-window rate limiter (server only, no dependencies).
 *
 * LIMITATION: counters live in this process's memory, so limits are per server instance. On a
 * serverless or multi-instance deployment the effective limit is limit x instances, and counters
 * reset on cold start. Production needs a shared store (Redis/Upstash, Vercel Firewall or a Mongo
 * TTL counter) behind the same `rateLimit(key, { limit, windowMs })` call.
 *
 * Memory is bounded: expired keys are swept on a timer-free schedule (at most once per sweep
 * interval, on the next call) and the table never holds more than MAX_KEYS entries (oldest evicted).
 * Callers should put the route name in `key` (see `clientKey(req, extra)`), because counters are
 * shared by key, not by limit options.
 */
import { createHash } from "node:crypto";

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}
export interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds: number;
}

const MAX_KEYS = 10_000;
const SWEEP_EVERY_MS = 30_000;

interface Entry {
  count: number;
  resetAt: number;
}

const g = globalThis as unknown as { __pitchswipeRateLimit?: { hits: Map<string, Entry>; lastSweep: number } };
function state() {
  return (g.__pitchswipeRateLimit ??= { hits: new Map(), lastSweep: 0 });
}

function sweep(now: number) {
  const s = state();
  s.lastSweep = now;
  for (const [k, v] of s.hits) if (v.resetAt <= now) s.hits.delete(k);
}

/** Counts one call for `key`. `ok` is false once `limit` calls were made inside the current window. */
export function rateLimit(key: string, opts: RateLimitOptions, now: number = Date.now()): RateLimitResult {
  const s = state();
  if (now - s.lastSweep >= SWEEP_EVERY_MS || s.hits.size >= MAX_KEYS) sweep(now);
  let entry = s.hits.get(key);
  if (!entry || entry.resetAt <= now) {
    if (!entry && s.hits.size >= MAX_KEYS) {
      // Still full of live keys: drop the oldest so memory stays bounded.
      const oldest = s.hits.keys().next().value;
      if (oldest !== undefined) s.hits.delete(oldest);
    }
    entry = { count: 0, resetAt: now + opts.windowMs };
    s.hits.set(key, entry);
  }
  entry.count += 1;
  if (entry.count <= opts.limit) return { ok: true, retryAfterSeconds: 0 };
  return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
}

/** Test helper: forget every counter. */
export function resetRateLimits(): void {
  state().hits.clear();
  state().lastSweep = 0;
}

/** Number of tracked keys (tests). */
export function trackedKeys(): number {
  return state().hits.size;
}

/** The caller's IP as seen by our own proxy, or "" when no header gives one. */
export function clientIp(req: Request): string {
  // 1. x-real-ip: nginx (infra/vm/pitchswipe.nginx) and Vercel set it to the TCP peer, overwriting any value
  //    the client sent.
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  // 2. x-forwarded-for, LAST hop: the one our proxy appended. The first hop is whatever the client claimed and is
  //    trivially spoofed to dodge a limit. (Our nginx overwrites the header with $remote_addr, so it has one hop.)
  const hops = (req.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (hops.length) return hops[hops.length - 1];
  // 3. Vercel's own header (single value set by Vercel's edge).
  return req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ?? "";
}

/**
 * A key for this caller (see clientIp), hashed with SHA-256 so no raw IP is stored or logged. No header gives one
 * constant shared bucket. `extra` (for example the route name) is prefixed so routes keep separate counters.
 */
export function clientKey(req: Request, extra?: string): string {
  const ip = clientIp(req);
  const hash = createHash("sha256").update(ip || "unknown").digest("hex").slice(0, 32);
  return extra ? `${extra}:${hash}` : hash;
}

/** A ready 429 response with Retry-After. */
export function tooManyRequests(result: RateLimitResult, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ error: "Too many requests. Try again shortly.", code: "rate_limited" }), {
    status: 429,
    headers: { "content-type": "application/json", "retry-after": String(result.retryAfterSeconds), ...headers },
  });
}

/** Limits by caller; returns a 429 Response to send, or null when allowed. */
export function limitRequest(req: Request, route: string, opts: RateLimitOptions, headers?: Record<string, string>): Response | null {
  const result = rateLimit(clientKey(req, route), opts);
  return result.ok ? null : tooManyRequests(result, headers);
}

/** Limits by an explicit key (for example a signed-in user id); a 429 Response to send, or null when allowed. */
export function limitKey(key: string, opts: RateLimitOptions, headers?: Record<string, string>): Response | null {
  const result = rateLimit(key, opts);
  return result.ok ? null : tooManyRequests(result, headers);
}
