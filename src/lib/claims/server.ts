/**
 * Server wiring for the claim, comment, voice and wallet routes. Server only.
 * Reuses WP3's swiper resolution (so demo mode, guests and signed-in swipers behave the same) and the
 * Flagsmith wrapper; nothing here talks to Flagsmith or Firebase directly.
 */
import { SWIPER } from "@/fixtures";
import { isFirebaseAdminConfigured, verifyRequestToken } from "@/lib/auth/server";
import { requireAccepted, defaultDeps as swipeDeps, resolveSwiper } from "@/lib/swipe/server";
import { getSwipeStore } from "@/lib/swipe/store";
import type { SwiperProfile } from "@/lib/swipe/types";
import type { ClaimsDeps, ClaimContext } from "./service";
import { getClaimsStore } from "./store";

export { AuthError } from "@/lib/auth/server";
export { ServiceUnavailableError } from "@/lib/swipe/errors";

export async function claimsDeps(): Promise<ClaimsDeps> {
  const swipe = await swipeDeps(); // reuses WP3's cached paid_swiping flag
  return {
    store: await getClaimsStore(),
    swipeStore: await getSwipeStore(),
    async trackRewardClaim({ deck, swiperKey, source }) {
      const { trackEvent } = await import("@/lib/flagsmith");
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
  if (!isFirebaseAdminConfigured()) {
    return { swiper, context: { swiperKey: swiper.key, email: SWIPER.email, emailVerified: true } };
  }
  if (request.headers.get("authorization")) {
    const token = await verifyRequestToken(request);
    return {
      swiper,
      context: { swiperKey: swiper.key, email: token.email, emailVerified: token.email_verified === true },
    };
  }
  return { swiper, context: { swiperKey: swiper.key, emailVerified: false } };
}
