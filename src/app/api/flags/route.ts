import { NextResponse } from "next/server";

import { PLATFORM_FLAG_DEFAULTS, getPlatformFlags, isNotConfigured } from "@/features/flagsmith";

export const dynamic = "force-dynamic";

/** Platform flags and remote config (paid_swiping, boost_enabled, language_cards, assistant_ship, check_card_rate). */
export async function GET() {
  try {
    return NextResponse.json({ flags: await getPlatformFlags(), source: "flagsmith" });
  } catch (error) {
    // Not configured (local dev) or Flagsmith unreachable: serve safe defaults, never fail the swipe feed.
    return NextResponse.json({
      flags: PLATFORM_FLAG_DEFAULTS,
      source: isNotConfigured(error) ? "defaults:not-configured" : "defaults:error",
    });
  }
}
