import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { AuthError, isFirebaseAdminConfigured, verifyRequestToken } from "@/lib/auth/server";
import {
  buildDeck,
  deckShape,
  evaluateSwipes,
  getLibraryCard,
  parseMode,
  prepareSubmission,
  toPublicCard,
} from "@/lib/quality";
import { limitKey, limitRequest } from "@/lib/ratelimit";
import { isSwipeDemoMode } from "@/lib/swipe/store";
import { User } from "@/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET  /api/practice?mode=initial|recheck  A fresh practice deck (public: the cards are demo content and
 *                                          carry no answer key). 30 cards, or 20 for a re-check.
 * POST /api/practice                       { mode, swipes: [{ cardId, answer, dwellMs }] } -> score.
 *                                          Signed in + Mongo: saves qualityScore, counting, checkReasons on the user.
 *                                          Firebase Admin not configured: demo mode, scores the run, saves nothing.
 */
export async function GET(request: Request) {
  const early = limitRequest(request, "practice:get", { limit: 60, windowMs: 60_000 });
  if (early) return early;
  const mode = parseMode(new URL(request.url).searchParams.get("mode"));
  const cards = buildDeck(mode).map((id) => toPublicCard(getLibraryCard(id)!));
  return NextResponse.json({ mode, size: deckShape(mode).size, cards, demo: isSwipeDemoMode() });
}

export async function POST(request: Request) {
  const early = limitRequest(request, "practice:post", { limit: 10, windowMs: 60_000 });
  if (early) return early;
  const body = (await request.json().catch(() => null)) as { mode?: unknown; swipes?: unknown } | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const mode = parseMode(body.mode);
  const checked = prepareSubmission(mode, body.swipes);
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
  const result = evaluateSwipes(checked.swipes);
  const payload = { mode, ...result };

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ...payload, demo: true, persisted: false });
  }

  try {
    const token = await verifyRequestToken(request);
    if (!token.email_verified) {
      return NextResponse.json({ error: "Verify your email first.", code: "unverified" }, { status: 403 });
    }
    // A bot account must not be able to retry the quality check endlessly.
    const limited = limitKey(`practice:user:${token.uid}`, { limit: 6, windowMs: 600_000 });
    if (limited) return limited;
    await connectDb();
    const updated = await User.updateOne(
      { firebaseUid: token.uid },
      { $set: { qualityScore: result.score, counting: result.counting, checkReasons: result.reasons } },
    );
    if (updated.matchedCount === 0) {
      return NextResponse.json({ error: "Create your profile first.", code: "no_profile" }, { status: 404 });
    }
    return NextResponse.json({ ...payload, demo: false, persisted: true });
  } catch (error) {
    if (error instanceof AuthError) {
      // Never tell a caller which env vars are missing.
      const message = error.code === "not_configured" ? "Sign-in is not available right now." : error.message;
      return NextResponse.json({ error: message, code: error.code }, { status: error.status });
    }
    if (error instanceof Error && error.message.startsWith("MONGODB_URI")) {
      console.error("practice route: storage not configured");
      return NextResponse.json({ error: "Saving is not available right now.", code: "not_configured" }, { status: 503 });
    }
    console.error("practice route", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not save your score." }, { status: 500 });
  }
}
