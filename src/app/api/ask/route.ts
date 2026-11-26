import { NextResponse } from "next/server";

import { resolveOwnerId, readJson } from "@/lib/decks/owner";
import { limitKey, limitRequest } from "@/lib/ratelimit";
import { MAX_QUESTION, askProvider, buildAskContext, cleanHistory, contextHeader, runAsk, suggestedQuestions } from "@/lib/ask";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };

/**
 * GET  /api/ask?deckId=...   header numbers and suggested questions for the Ask screen.
 * POST /api/ask              { deckId, question, history? } -> one checked answer as plain JSON.
 *
 * Plain JSON, not a stream: the answer is only shown after code has post-checked every number in it
 * (spec 05 section 6.5), so there is nothing safe to stream early.
 *
 * Founder only: the signed-in owner is resolved first and every read goes through owner-scoped loaders.
 * The chat reads and drafts. It has no way to publish, ship, stop a test or change a flag.
 */
export async function GET(request: Request) {
  const early = limitRequest(request, "ask:get", { limit: 120, windowMs: 60_000 }, NO_STORE);
  if (early) return early;
  const who = await resolveOwnerId(request);
  if ("response" in who) return who.response;
  const deckId = new URL(request.url).searchParams.get("deckId") ?? "";
  try {
    const ctx = deckId ? await buildAskContext(who.ownerId, deckId) : null;
    if (!ctx) return NextResponse.json({ error: "Deck not found." }, { status: 404, headers: NO_STORE });
    return NextResponse.json({ header: contextHeader(ctx), suggestions: suggestedQuestions(ctx) }, { headers: NO_STORE });
  } catch (error) {
    console.error("ask: could not load", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not load this chat. Try again." }, { status: 500, headers: NO_STORE });
  }
}

export async function POST(request: Request) {
  const early = limitRequest(request, "ask:ip", { limit: 60, windowMs: 60_000 }, NO_STORE);
  if (early) return early;
  const who = await resolveOwnerId(request);
  if ("response" in who) return who.response;
  // Each answer can be a paid model call: cap it per founder.
  const limited = limitKey(`ask:owner:${who.ownerId}`, { limit: 12, windowMs: 60_000 }, NO_STORE);
  if (limited) return limited;

  const body = (await readJson(request)) as { deckId?: unknown; question?: unknown; history?: unknown } | null;
  const deckId = typeof body?.deckId === "string" ? body.deckId : "";
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (!deckId) return NextResponse.json({ error: "deckId is required." }, { status: 400, headers: NO_STORE });
  if (!question) return NextResponse.json({ error: "Type a question first." }, { status: 400, headers: NO_STORE });
  if (question.length > MAX_QUESTION) {
    return NextResponse.json({ error: `Keep the question under ${MAX_QUESTION} characters.` }, { status: 400, headers: NO_STORE });
  }

  try {
    const ctx = await buildAskContext(who.ownerId, deckId);
    if (!ctx) return NextResponse.json({ error: "Deck not found." }, { status: 404, headers: NO_STORE });
    const answer = await runAsk({ provider: askProvider(), ctx, question, history: cleanHistory(body?.history) });
    return NextResponse.json(answer, { headers: NO_STORE });
  } catch (error) {
    // Provider errors can carry request details; log the message only, never the key.
    console.error("ask: failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not answer that. Try again." }, { status: 502, headers: NO_STORE });
  }
}
