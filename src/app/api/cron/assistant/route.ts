import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { watcherDeps } from "@/lib/assistant/server";
import { runWatcher } from "@/lib/assistant/watcher";

export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // closed by default: no secret, no watcher
  const given = request.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  const a = Buffer.from(given);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * GET or POST /api/cron/assistant (every 5 minutes, header `Authorization: Bearer $CRON_SECRET`).
 * Checks live decks, records assistantEvents, raises or withdraws "Test decided" alerts.
 * It never ships, stops or changes a test or a flag.
 */
async function handle(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET is not set." }, { status: 503 });
  }
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const outcomes = await runWatcher(watcherDeps());
    return NextResponse.json({ checked: outcomes.length, outcomes }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("assistant cron failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "The watcher failed." }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
