/**
 * Audience description and reach (spec/02 "Audience targeting"). Pure.
 *
 * No reach number is shown: there are no real swiper counts to base an estimate on yet, and an invented model
 * would be made-up data. Screens show REACH_UNAVAILABLE instead.
 */
import type { Role } from "@/shared/lib/lists";

export interface AudienceInput {
  who: "everyone" | "targetOnly";
  states: readonly string[];
  interests: readonly string[];
}

/** "Shop owner, Wholesaler in Gujarat, Maharashtra who follow Retail, Finance." */
export function describeAudience(audience: AudienceInput, targetUsers: readonly Role[]) {
  return {
    roles: audience.who === "targetOnly" && targetUsers.length > 0 ? [...targetUsers] : ["Everyone"],
    states: audience.states.length > 0 ? [...audience.states] : ["all of India"],
    interests: audience.interests.length > 0 ? [...audience.interests] : ["any interest"],
  };
}

/** Shown instead of a number: no real swiper counts feed an estimate yet. */
export const REACH_UNAVAILABLE = "Reach estimates appear once enough swipers have joined.";

export type ReachView = { kind: "unavailable"; message: string };

/** What a screen may show for reach: never a number. */
export function reachView(): ReachView {
  return { kind: "unavailable", message: REACH_UNAVAILABLE };
}
