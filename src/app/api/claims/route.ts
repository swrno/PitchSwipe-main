import { NextResponse } from "next/server";
import { AuthError, ServiceUnavailableError, claimsDeps, resolveClaimant } from "@/lib/claims/server";
import { claimReward, parseResponseRef } from "@/lib/claims/service";
import { clientKey, rateLimit } from "@/lib/ratelimit";
import { isValidGuid } from "@/lib/swipe/service";

export const runtime = "nodejs";

function tooManyRequests(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Too many requests. Try again shortly." },
    { status: 429, headers: { "retry-after": String(Math.max(1, Math.ceil(retryAfterSeconds))) } },
  );
}

/**
 * POST /api/claims: the swiper explicitly taps "Claim reward". Stores the claim in MongoDB (their verified
 * profile email, never one typed into the request) and sends reward_claim to Flagsmith only for a valid AND
 * counted swipe on a live deck. Body: { swiperGuid, responseId, token } (token: the served-card token).
 */
export async function POST(request: Request) {
  const limited = rateLimit(clientKey(request, "claims:claim"), { limit: 10, windowMs: 60_000 });
  if (!limited.ok) return tooManyRequests(limited.retryAfterSeconds);
  const body = await request.json().catch(() => null);
  const ref = parseResponseRef(body);
  if ("error" in ref) return NextResponse.json({ error: ref.error }, { status: 400 });
  const guid = (body as { swiperGuid?: unknown }).swiperGuid;
  if (!isValidGuid(guid)) return NextResponse.json({ error: "Missing swiper id." }, { status: 400 });

  try {
    const { context } = await resolveClaimant(request, guid);
    const outcome = await claimReward(await claimsDeps(), ref, context);
    if (!outcome.ok) return NextResponse.json({ error: outcome.error }, { status: outcome.status });
    return NextResponse.json(outcome, { status: outcome.alreadyClaimed ? 200 : 201 });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof ServiceUnavailableError) {
      return NextResponse.json({ error: "This service is temporarily unavailable." }, { status: 503 });
    }
    console.error("claims: could not store claim", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not claim the reward." }, { status: 500 });
  }
}
