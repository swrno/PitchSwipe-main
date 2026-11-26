/**
 * Demo-only switch for the swipe feed: `/swipe?demo=notcounted` makes the demo swiper "not counting yet"
 * (quality score below 70), so the "Not counted yet" banner, the "Not counted yet" pill and the unpaid
 * outcome can be seen without a real profile (design phone 32 is the matching quality result).
 * `?demo=counting` turns it off again.
 *
 * It can only LOWER what the demo swiper gets (counting -> not counting), and the server reads it only where
 * it already invents a fixture swiper (no Firebase Admin or no database), never for a verified user.
 * Pure module: no imports, safe on the client and the server.
 */
export const DEMO_PROFILE_COOKIE = "pitchswipe-demo-profile";

/** What `?demo=` asks for on a swipe URL, or null when it is absent or unknown. */
export function demoProfileFromSearch(search: string): "notcounted" | "counting" | null {
  const value = new URLSearchParams(search).get("demo");
  return value === "notcounted" || value === "counting" ? value : null;
}

/** Cookie header value (`name=value`) that records the choice, or an expiring one that clears it. */
export function demoProfileCookie(choice: "notcounted" | "counting"): string {
  return choice === "notcounted"
    ? `${DEMO_PROFILE_COOKIE}=notcounted; path=/; max-age=3600; SameSite=Lax`
    : `${DEMO_PROFILE_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

/** True when the request's Cookie header carries the not-counted demo choice. */
export function demoNotCounted(cookieHeader: string | null | undefined): boolean {
  if (!cookieHeader) return false;
  return cookieHeader.split(";").some((part) => part.trim() === `${DEMO_PROFILE_COOKIE}=notcounted`);
}
