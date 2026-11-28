import { NextResponse } from "next/server";
import { notConfiguredResponse } from "@/shared/lib/not-configured";
import { clientKey, rateLimit } from "@/shared/lib/ratelimit";
import { stateFromHeaders } from "@/features/swipe/server/region";
import { AuthError, ServiceUnavailableError, defaultDeps, resolveSwiper } from "@/features/swipe/server/server";
import { parseSubmitBody, submitResponse } from "@/features/swipe/server/service";

export const runtime = "nodejs";

function tooManyRequests(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Too many requests. Try again shortly." },
    { status: 429, headers: { "retry-after": String(Math.max(1, Math.ceil(retryAfterSeconds))) } },
  );
}

/**
 * POST /api/responses: record one swipe.
 * Stored in MongoDB; sent to Flagsmith (answer_positive) ONLY if the swipe is valid AND counted.
 * Invalid (under 2 s) or not-counted swipes never reach Flagsmith; under 300 ms is ignored entirely.
 * Requires the signed `token` from /api/responses/next: the card, the source (feed or link) and the
 * served time come from it, never from the body. The role is stored as it is at swipe time; isTargetUser is computed from it. The state comes from
 * the request IP at the edge; the raw IP is never read, stored or returned.
 */
export async function POST(request: Request) {
  const limited = rateLimit(clientKey(request, "responses:submit"), { limit: 60, windowMs: 60_000 });
  if (!limited.ok) return tooManyRequests(limited.retryAfterSeconds);
  const body = await request.json().catch(() => null);
  const parsed = parseSubmitBody(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const swiper = await resolveSwiper(request, parsed.guid);
    const outcome = await submitResponse(await defaultDeps(), parsed.value, {
      swiper,
      region: stateFromHeaders(request.headers),
    });
    if (outcome.ok) return NextResponse.json(outcome, { status: 201 });
    if (outcome.ignored) return NextResponse.json({ recorded: false, ignored: true, reason: outcome.reason });
    return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof ServiceUnavailableError) {
      return notConfiguredResponse();
    }
    console.error("responses: could not record swipe", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not save your answer." }, { status: 500 });
  }
}
