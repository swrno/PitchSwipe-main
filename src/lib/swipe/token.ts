/**
 * Served-card token (server only). `/api/responses/next` signs one for every card it serves;
 * `/api/responses` and the claim routes require and verify it.
 *
 * token = "v1." + base64url(JSON {d, c, t, s}) + "." + base64url(HMAC-SHA256(secret, canonical))
 * canonical = v1|deckId|swiperKey|cardKey|servedAt|source
 *
 * The swiper key is in the MAC but not in the payload, so a token only verifies for the identity it was
 * minted for. The server decides `source` at serve time and carries it here; the browser never does.
 * Secret: env SWIPE_SIGNING_SECRET. Dev without it: a random per-process secret and one warning.
 * Production without it: ServiceUnavailableError (refuse to serve).
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { ServiceUnavailableError } from "./errors";
import type { SwipeSource } from "./types";

export const SERVED_TOKEN_MAX_AGE_MS = 60 * 60 * 1000;
/** Claim, comment and wallet calls follow the answer, so they accept an older token. */
export const CLAIM_TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 5_000;
const MAX_TOKEN_LENGTH = 600;

export interface ServedClaims {
  deckId: string;
  cardKey: string;
  servedAt: number;
  source: SwipeSource;
}

export type TokenCheck =
  | { ok: true; claims: ServedClaims }
  | { ok: false; reason: "malformed" | "signature" | "expired" | "future" };

const g = globalThis as unknown as { __pitchswipeDevSigningSecret?: string };

export function getSigningSecret(): string {
  const env = process.env.SWIPE_SIGNING_SECRET;
  if (env && env.length >= 16) return env;
  if (process.env.NODE_ENV === "production") {
    throw new ServiceUnavailableError("SWIPE_SIGNING_SECRET is not set.");
  }
  if (!g.__pitchswipeDevSigningSecret) {
    g.__pitchswipeDevSigningSecret = randomBytes(32).toString("hex");
    console.warn("SWIPE_SIGNING_SECRET is not set: using a random per-process secret (tokens reset on restart).");
  }
  return g.__pitchswipeDevSigningSecret;
}

function mac(secret: string, swiperKey: string, c: ServedClaims): Buffer {
  const canonical = ["v1", c.deckId, swiperKey, c.cardKey, String(c.servedAt), c.source].join("|");
  return createHmac("sha256", secret).update(canonical).digest();
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");

export function signServedToken(secret: string, swiperKey: string, claims: ServedClaims): string {
  const payload = b64(JSON.stringify({ d: claims.deckId, c: claims.cardKey, t: claims.servedAt, s: claims.source }));
  return `v1.${payload}.${b64(mac(secret, swiperKey, claims))}`;
}

export function verifyServedToken(
  secret: string,
  swiperKey: string,
  token: unknown,
  opts: { now: number; maxAgeMs: number },
): TokenCheck {
  if (typeof token !== "string" || token.length > MAX_TOKEN_LENGTH) return { ok: false, reason: "malformed" };
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return { ok: false, reason: "malformed" };
  let claims: ServedClaims;
  try {
    const raw = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Record<string, unknown>;
    if (
      typeof raw.d !== "string" ||
      typeof raw.c !== "string" ||
      typeof raw.t !== "number" ||
      !Number.isFinite(raw.t) ||
      (raw.s !== "feed" && raw.s !== "link")
    ) {
      return { ok: false, reason: "malformed" };
    }
    claims = { deckId: raw.d, cardKey: raw.c, servedAt: raw.t, source: raw.s };
  } catch {
    return { ok: false, reason: "malformed" };
  }
  const given = Buffer.from(parts[2], "base64url");
  const want = mac(secret, swiperKey, claims);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return { ok: false, reason: "signature" };
  if (claims.servedAt > opts.now + CLOCK_SKEW_MS) return { ok: false, reason: "future" };
  if (opts.now - claims.servedAt > opts.maxAgeMs) return { ok: false, reason: "expired" };
  return { ok: true, claims };
}
