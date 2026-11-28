import { NextResponse } from "next/server";
import { notConfiguredResponse } from "@/shared/lib/not-configured";
import { AuthError, ServiceUnavailableError, claimsDeps, resolveClaimant } from "@/features/claims/server/server";
import { parseCommentBody, saveComment } from "@/features/claims/server/service";
import { clientKey, rateLimit } from "@/shared/lib/ratelimit";
import { isValidGuid } from "@/features/swipe/server/service";

export const runtime = "nodejs";

function tooManyRequests(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Too many requests. Try again shortly." },
    { status: 429, headers: { "retry-after": String(Math.max(1, Math.ceil(retryAfterSeconds))) } },
  );
}

/**
 * POST /api/claims/comment: attach the optional comment (typed, or the reviewed voice note text plus its
 * English translation as `commentVoice`) to the swiper's own response. Audio is stored only when the
 * swiper ticked "Let <founder> play my voice note", and is marked deleteAfter = now + 30 days.
 * Body: { swiperGuid, responseId, token, comment?, voice?: { durationSec, language, transcript, english,
 * founderCanPlay, audioBase64?, audioMime? } }.
 */
export async function POST(request: Request) {
  const limited = rateLimit(clientKey(request, "claims:comment"), { limit: 10, windowMs: 60_000 });
  if (!limited.ok) return tooManyRequests(limited.retryAfterSeconds);
  const body = await request.json().catch(() => null);
  const parsed = parseCommentBody(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const guid = (body as { swiperGuid?: unknown }).swiperGuid;
  if (!isValidGuid(guid)) return NextResponse.json({ error: "Missing swiper id." }, { status: 400 });

  try {
    const { context } = await resolveClaimant(request, guid);
    const outcome = await saveComment(await claimsDeps(), parsed, context.swiperKey, context);
    if (!outcome.ok) return NextResponse.json({ error: outcome.error }, { status: outcome.status });
    return NextResponse.json({ saved: true }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof ServiceUnavailableError) {
      return notConfiguredResponse();
    }
    console.error("claims: could not save comment", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not save your comment." }, { status: 500 });
  }
}
