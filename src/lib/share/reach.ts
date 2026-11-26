/**
 * Audience reach estimate (spec/02 "Audience targeting", spec/05 5.10 "Reach warning"). Pure.
 *
 * DEMO ONLY. This model is invented (the pool and the shares are not in the spec). In real mode
 * no reach number is shown at all (see `reachView`); the screens only call `estimateReach` when
 * `demo` is true, and label every demo number that is not the designed "~1,900" as "Demo data".
 *
 * ASSUMPTIONS (a placeholder model for the hackathon demo):
 *  1. The feed has DEMO_SWIPER_POOL = 26,000 verified swipers, spread evenly over roles,
 *     states and interests.
 *  2. "Target users only" keeps ROLE_SHARE = 11% of the pool per chosen target role
 *     (one role = 11%, two = 22%, capped at 100%). "Everyone" keeps all of it.
 *  3. States: none chosen = all of India. One state keeps 40%; each extra state adds 20%
 *     (capped at 100%), because the big states are larger than the average one.
 *  4. Interests: none chosen = all interests. One keeps 35%; each extra adds 20% (capped).
 *  5. The three filters are independent, so the shares multiply. The result is rounded to
 *     the nearest 100.
 *  6. Small audience: a test needs about 50 swipers per card (up to 3 cards = 150 swipes) and
 *     about 1 in 7 eligible swipers swipes a given deck over its run, so below
 *     SMALL_AUDIENCE = 1,000 the page warns that reaching the sample may take longer.
 *
 * Demo check (spec/08 13): Shop owner + Wholesaler, Gujarat + Maharashtra, Retail + Finance
 * gives 26,000 x 0.22 x 0.60 x 0.55 = 1,887.6, shown as "~1,900".
 */
import type { Role } from "@/lib/lists";

export const DEMO_SWIPER_POOL = 26_000;
export const ROLE_SHARE = 0.11;
export const SMALL_AUDIENCE = 1_000;
export const MIN_SAMPLE_PER_CARD = 50;

export interface AudienceInput {
  who: "everyone" | "targetOnly";
  states: readonly string[];
  interests: readonly string[];
}

export interface ReachEstimate {
  /** Swipers who can see the deck, rounded to the nearest 100. */
  reach: number;
  /** Share of the pool, 0 to 1. */
  share: number;
  small: boolean;
  /** Plain-language warning when `small`, else undefined. */
  warning?: string;
}

const stepShare = (count: number, first: number, extra: number) => (count === 0 ? 1 : Math.min(1, first + extra * (count - 1)));

export function estimateReach(
  audience: AudienceInput,
  targetUsers: readonly Role[],
  pool: number = DEMO_SWIPER_POOL,
): ReachEstimate {
  const who = audience.who === "targetOnly" ? Math.min(1, targetUsers.length * ROLE_SHARE) : 1;
  const states = stepShare(audience.states.length, 0.4, 0.2);
  const interests = stepShare(audience.interests.length, 0.35, 0.2);
  const share = who * states * interests;
  const reach = Math.round((pool * share) / 100) * 100;
  const small = reach < SMALL_AUDIENCE;
  return {
    reach,
    share,
    small,
    warning: small
      ? `Small audience: about ${reach.toLocaleString("en-IN")} swipers. Reaching ${MIN_SAMPLE_PER_CARD} swipers per card may take longer. Add states or interests, or choose Everyone, to widen it.`
      : undefined,
  };
}

/** "~1,900" */
export function formatReach(reach: number): string {
  return `~${reach.toLocaleString("en-IN")}`;
}

/** "Shop owner, Wholesaler in Gujarat, Maharashtra who follow Retail, Finance." */
export function describeAudience(audience: AudienceInput, targetUsers: readonly Role[]) {
  return {
    roles: audience.who === "targetOnly" && targetUsers.length > 0 ? [...targetUsers] : ["Everyone"],
    states: audience.states.length > 0 ? [...audience.states] : ["all of India"],
    interests: audience.interests.length > 0 ? [...audience.interests] : ["any interest"],
  };
}

/** Shown in real mode instead of a number: no real swiper counts feed an estimate yet. */
export const REACH_UNAVAILABLE = "Reach estimates appear once enough swipers have joined.";

/** The one selection whose reach the designs show as "~1,900" (spec/08 13, web 04 and 15). */
const DESIGNED_ROLES = ["Shop owner", "Wholesaler"];
const DESIGNED_STATES = ["Gujarat", "Maharashtra"];
const DESIGNED_INTERESTS = ["Retail", "Finance"];

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && b.every((x) => a.includes(x));

/** True only for the exact audience the designs show, so its ~1,900 needs no "Demo data" label. */
export function isDesignedAudience(audience: AudienceInput, targetUsers: readonly Role[]): boolean {
  return (
    audience.who === "targetOnly" &&
    sameSet(targetUsers, DESIGNED_ROLES) &&
    sameSet(audience.states, DESIGNED_STATES) &&
    sameSet(audience.interests, DESIGNED_INTERESTS)
  );
}

export type ReachView =
  | { kind: "unavailable"; message: string }
  | { kind: "estimate"; estimate: ReachEstimate; formatted: string; label: boolean };

/**
 * What a screen may show for reach. Real mode: never a number. Demo mode: the invented model,
 * with `label: true` (show "Demo data") unless it is exactly the designed selection.
 */
export function reachView(demo: boolean, audience: AudienceInput, targetUsers: readonly Role[]): ReachView {
  if (!demo) return { kind: "unavailable", message: REACH_UNAVAILABLE };
  const estimate = estimateReach(audience, targetUsers);
  return { kind: "estimate", estimate, formatted: formatReach(estimate.reach), label: !isDesignedAudience(audience, targetUsers) };
}
