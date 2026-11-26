/**
 * Starter decks: the house account's decks from `npm run seed:feed` (scripts/seed/feed-ideas.mjs). They keep the feed
 * from being empty, but a founder's own deck always gets more of the traffic, so real experiments reach a decision first.
 */
export const STARTER_OWNER_UID = "house-pitchswipe-ideas-lab";

/** Share of feed traffic a starter deck gets relative to a founder's deck (1 = equal). */
export const STARTER_FEED_WEIGHT = 0.25;
