/**
 * The 30-card quality check (spec 04 §5.9) is set aside for now: new swipers go straight to the feed and their
 * swipes count. Everything the check needs (practice deck, scoring, re-check page) stays in place so it can come back.
 *
 * Turn it back on with NEXT_PUBLIC_QUALITY_CHECK=on. It is a NEXT_PUBLIC_ value because the sign-up and verify screens
 * read it in the browser, so it is built into the app: set it as a GitHub repo variable (and in .env.local for local
 * runs), then redeploy. Read with the literal `process.env.NEXT_PUBLIC_QUALITY_CHECK` so Next.js inlines it.
 */
export function qualityCheckEnabled(value: string | undefined = process.env.NEXT_PUBLIC_QUALITY_CHECK): boolean {
  const v = (value ?? "").trim().toLowerCase();
  return v === "on" || v === "1" || v === "true";
}

/**
 * Whether a signed-in swiper's swipes count. With the check on: only a passed check (`counting` in Mongo).
 * With the check off: everyone signed in counts. Guests never reach this (they are not counting in production).
 */
export function swiperCounts(storedCounting: boolean | undefined, enabled = qualityCheckEnabled()): boolean {
  return enabled ? storedCounting === true : true;
}
