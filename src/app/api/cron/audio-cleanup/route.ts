import { NextResponse } from "next/server";

import { cronAuth } from "@/features/claims/server/cron";
import { getClaimsStore } from "@/features/claims/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET or POST /api/cron/audio-cleanup (daily, header `Authorization: Bearer $CRON_SECRET`).
 * Clears voice-note audio whose 30-day deleteAfter has passed. The transcript and the English text stay.
 */
async function handle(request: Request) {
  const auth = cronAuth(request.headers.get("authorization"));
  if (auth === "unconfigured") return NextResponse.json({ error: "CRON_SECRET is not set." }, { status: 503 });
  if (auth !== "ok") return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const cleared = await (await getClaimsStore()).purgeExpiredAudio(new Date());
    return NextResponse.json({ cleared }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("audio cleanup failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "The cleanup failed." }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
