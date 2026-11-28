/**
 * Server wiring for the claim, comment, voice and wallet routes. Server only.
 * Reuses WP3's swiper resolution (so guests and signed-in swipers behave the same) and the
 * Flagsmith wrapper; nothing here talks to Flagsmith or Firebase directly.
 */
import { verifyRequestToken } from "@/features/auth/server/server";
import { requireAccepted, defaultDeps as swipeDeps, resolveSwiper } from "@/features/swipe/server/server";
import { getSwipeStore } from "@/features/swipe/server/store";
import type { SwiperProfile } from "@/features/swipe/types";
import type { ClaimsDeps, ClaimContext } from "./service";
import { getClaimsStore } from "./store";

export { AuthError } from "@/features/auth/server/server";
export { ServiceUnavailableError } from "@/features/swipe/errors";

export async function claimsDeps(): Promise<ClaimsDeps> {
  const swipe = await swipeDeps(); // reuses WP3's cached paid_swiping flag
  return {
    store: await getClaimsStore(),
    swipeStore: await getSwipeStore(),
    async trackRewardClaim({ deck, swiperKey, source }) {
      const { trackEvent } = await import("@/features/flagsmith");
      requireAccepted(
        "reward_claim",
        await trackEvent({
          deckId: deck.id,
          swiperGuid: swiperKey,
          flagName: deck.flagName,
          event: "reward_claim",
          source,
          counted: true,
        }),
      );
    },
    paidSwiping: swipe.paidSwiping,
    now: Date.now,
  };
}

/** The swiper plus the verified email that a claim may share. Guests have no email. */
export async function resolveClaimant(
  request: Request,
  guid: string,
): Promise<{ swiper: SwiperProfile; context: ClaimContext }> {
  const swiper = await resolveSwiper(request, guid);
  if (request.headers.get("authorization")) {
    const token = await verifyRequestToken(request);
    return {
      swiper,
      context: { swiperKey: swiper.key, email: token.email, emailVerified: token.email_verified === true },
    };
  }
  return { swiper, context: { swiperKey: swiper.key, emailVerified: false } };
}
