import { NextResponse } from "next/server";

import { readJson, resolveOwnerId } from "@/lib/decks/owner";
import { shipDeps } from "@/lib/assistant/server";
import { listAlerts, markRead, snoozeAlert } from "@/lib/assistant/ship";

const NO_STORE = { "cache-control": "no-store" };

/** GET /api/notifications: the signed-in founder's "Test decided" alerts (My decks card + notification list). */
export async function GET(request: Request) {
  const who = await resolveOwnerId(request);
  if ("response" in who) return who.response;
  try {
    return NextResponse.json({ alerts: await listAlerts(await shipDeps(), who.ownerId) }, { headers: NO_STORE });
  } catch (error) {
    console.error("notifications failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not load notifications." }, { status: 500, headers: NO_STORE });
  }
}

/** POST /api/notifications  body { deckId, action: "snooze" | "read" }. "snooze" is the "Later" button (24 hours). */
export async function POST(request: Request) {
  const who = await resolveOwnerId(request);
  if ("response" in who) return who.response;
  const body = (await readJson(request)) as { deckId?: unknown; action?: unknown } | null;
  if (typeof body?.deckId !== "string" || (body.action !== "snooze" && body.action !== "read")) {
    return NextResponse.json({ error: "Send { deckId, action: 'snooze' | 'read' }." }, { status: 400 });
  }
  const deps = await shipDeps();
  if (body.action === "read") {
    await markRead(deps, { ownerId: who.ownerId, deckId: body.deckId });
    return NextResponse.json({ ok: true });
  }
  const result = await snoozeAlert(deps, { ownerId: who.ownerId, deckId: body.deckId });
  return result.ok ? NextResponse.json(result.value) : NextResponse.json({ error: result.error }, { status: result.status });
}
