/**
 * Server wiring for the swipe routes: who the swiper is, and the real Flagsmith / store dependencies.
 * Server only. Needs MongoDB and Firebase Admin; without them every route answers 503.
 */
import { AuthError, verifyRequestToken } from "@/features/auth/server/server";
import { NOT_CONFIGURED_MESSAGE, isServerConfigured } from "@/shared/lib/config";
import { connectDb } from "@/shared/lib/db";
import type { Industry, Role, State } from "@/shared/lib/lists";
import { User } from "@/models";
import { ServiceUnavailableError } from "../errors";
import { guestKey, userKey } from "../identity";
import type { SwipeDeps } from "./service";
import { getSwipeStore } from "./store";
import type { SwiperProfile } from "../types";
import { swiperCounts } from "@/features/quality/switch";

export { AuthError, ServiceUnavailableError };

/** Throws ServiceUnavailableError (a 503) unless MongoDB and Firebase Admin are configured. */
export function assertSwipeBackendsReady(): void {
  if (!isServerConfigured()) throw new ServiceUnavailableError(NOT_CONFIGURED_MESSAGE);
}

/**
 * Resolve the swiper.
 *  - A valid Firebase ID token: the signed-in user (role, state, interests, quality `counting` from Mongo).
 *    Only the verified uid maps to a user row; the key is "u:<user _id>".
 *  - No token: a guest, key "g:<guid>". The guid is client-chosen, so it is namespaced and can never resolve
 *    to a user. Guests are not counting on the feed; link answers count regardless (see validity.decideCounted).
 * Throws AuthError (401) for a bad token, ServiceUnavailableError (503) when the server is not configured.
 */
export async function resolveSwiper(request: Request, guid: string): Promise<SwiperProfile> {
  assertSwipeBackendsReady();
  if (!request.headers.get("authorization")) {
    return { key: guestKey(guid), guest: true, interests: [], counting: false };
  }
  const token = await verifyRequestToken(request);
  await connectDb();
  const user = (await User.findOne({ firebaseUid: token.uid })
    .select("role state interests counting qualityScore")
    .lean()) as { _id: unknown; role?: Role; state?: State; interests?: Industry[]; counting?: boolean; qualityScore?: number } | null;
  if (!user) return { key: guestKey(guid), guest: true, interests: [], counting: false };
  return {
    key: userKey(String(user._id)),
    guest: false,
    role: user.role,
    state: user.state,
    interests: user.interests ?? [],
    // Stored result of the quality check; everyone signed in counts while the check is set aside.
    counting: swiperCounts(user.counting),
    // 0 is the schema default for "has not taken the check yet": nothing to show.
    qualityScore: typeof user.qualityScore === "number" && user.qualityScore > 0 ? user.qualityScore : undefined,
  };
}

let flagsCache: { value: boolean; at: number } | undefined;
const FLAGS_TTL_MS = 60_000;

/** Platform flag `paid_swiping`, cached for a minute; defaults to true when Flagsmith is unavailable. */
async function paidSwipingFlag(): Promise<boolean> {
  if (flagsCache && Date.now() - flagsCache.at < FLAGS_TTL_MS) return flagsCache.value;
  let value = true;
  try {
    const { getPlatformFlags } = await import("@/features/flagsmith");
    value = (await getPlatformFlags()).paid_swiping;
  } catch {
    value = true;
  }
  flagsCache = { value, at: Date.now() };
  return value;
}

/** A batch Flagsmith answered with nothing accepted is a failure (logged, not counted as sent). */
export function requireAccepted(event: string, result: { sent: boolean; accepted: number; rejected: unknown[] }): void {
  if (result.sent && result.accepted < 1) {
    console.warn("swipe: Flagsmith rejected", event, JSON.stringify(result.rejected).slice(0, 500));
    throw new Error(`Flagsmith rejected ${event}`);
  }
}

export async function defaultDeps(): Promise<SwipeDeps> {
  assertSwipeBackendsReady();
  return {
    store: await getSwipeStore(),
    async assign(deck, swiperKey, source) {
      const { assignSwiper } = await import("@/features/flagsmith");
      const result = await assignSwiper(deck.id, swiperKey, deck.flagName, source);
      return { variant: result.variant, value: result.value };
    },
    async trackExposure({ deck, swiperKey, source, variant }) {
      const { trackExposure } = await import("@/features/flagsmith");
      requireAccepted(
        "$flag_exposure",
        await trackExposure({
          deckId: deck.id,
          swiperGuid: swiperKey,
          flagName: deck.flagName,
          variant,
          source,
          experimentId: deck.experimentId,
          counted: true,
        }),
      );
    },
    async trackAnswerPositive({ deck, swiperKey, source }) {
      const { trackEvent } = await import("@/features/flagsmith");
      requireAccepted(
        "answer_positive",
        await trackEvent({
          deckId: deck.id,
          swiperGuid: swiperKey,
          flagName: deck.flagName,
          event: "answer_positive",
          source,
          counted: true,
        }),
      );
    },
    paidSwiping: paidSwipingFlag,
    now: Date.now,
  };
}
