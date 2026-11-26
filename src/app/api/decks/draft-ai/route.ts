import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { getLlmProvider } from "@/lib/ai";
import { LlmDeclinedError, LlmTruncatedError } from "@/lib/ai/anthropic-provider";
import { LlmHttpError } from "@/lib/ai/groq-provider";
import { LANGUAGE_FIELD_LIMITS, draftLanguageVersionsLive, draftTextVersionsLive, isLiveTextVariable } from "@/lib/decks/ai-live";
import { AI_NOT_CONFIGURED_MESSAGE, draftAvailability, draftLanguageVersions, draftTextVersions, type LanguageBase } from "@/lib/decks/ai-stub";
import { CARD_LANGUAGES, LANGUAGE_TEXT_KEYS, type CardLanguage } from "@/lib/decks/fields";
import { readJson, resolveOwnerId } from "@/lib/decks/owner";
import { getStore, isDemoMode } from "@/lib/decks/store";
import { limitKey, limitRequest } from "@/lib/ratelimit";

/**
 * POST /api/decks/draft-ai
 * { kind: "language", base: {headline,...}, languages: ["Hindi","Bengali"] }               -> { versions, failed? }
 * { kind: "versions", variable, count, productId, idea: { headline, description } }       -> { versions }
 * Demo mode: fixture copy ("demo: true", the UI labels it Demo data). Real mode never returns fixture copy:
 * 503 not_configured without LLM_API_KEY; with one, Claude drafts and code checks every draft (src/lib/decks/ai-live.ts).
 * AI only drafts text; it never publishes, ships or invents numbers.
 */
export async function POST(request: Request) {
  const early = limitRequest(request, "draft-ai:ip", { limit: 60, windowMs: 60_000 });
  if (early) return early;
  const who = await resolveOwnerId(request);
  if ("response" in who) return who.response;
  // Each call is a paid model request: cap per founder.
  const limited = limitKey(`draft-ai:owner:${who.ownerId}`, { limit: 15, windowMs: 60_000 });
  if (limited) return limited;
  const availability = draftAvailability({ demo: isDemoMode(), env: process.env });
  if (availability === "not_configured") {
    return NextResponse.json({ error: AI_NOT_CONFIGURED_MESSAGE, code: "not_configured" }, { status: 503 });
  }
  const live = availability === "live";
  const body = (await readJson(request)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Send a JSON object." }, { status: 400 });

  try {
    if (body.kind === "language") {
      const base = body.base as Record<string, unknown> | undefined;
      const languages = Array.isArray(body.languages) ? body.languages : [];
      // Deduped, so one request costs at most one model call per supported language.
      const validLanguages = [...new Set(languages.map(String))].filter((l): l is CardLanguage => (CARD_LANGUAGES as readonly string[]).includes(l));
      if (!base || LANGUAGE_TEXT_KEYS.some((k) => typeof base[k] !== "string") || validLanguages.length === 0) {
        return NextResponse.json({ error: "Send the English card text and the languages to draft." }, { status: 422 });
      }
      if (LANGUAGE_TEXT_KEYS.some((k) => (base[k] as string).length > LANGUAGE_FIELD_LIMITS[k])) {
        return NextResponse.json({ error: "A field of the English card is too long to translate." }, { status: 422 });
      }
      if (!live) return NextResponse.json({ versions: await draftLanguageVersions(base as never, validLanguages), demo: true });
      const out = await draftLanguageVersionsLive(liveProvider(), base as unknown as LanguageBase, validLanguages);
      return NextResponse.json({ versions: out.versions, failed: out.failed, demo: false });
    }
    if (body.kind === "versions") {
      const count = Math.min(3, Math.max(2, Number(body.count) || 3));
      const variable = String(body.variable);
      if (!live) return NextResponse.json({ versions: await draftTextVersions(variable, count), demo: true });
      // Only headline and description are drafted live; the UI asks for the rest by hand.
      if (!isLiveTextVariable(variable)) return NextResponse.json({ versions: [], demo: false });
      const product = typeof body.productId === "string" ? await (await getStore()).getProduct(who.ownerId, body.productId) : null;
      if (!product) return NextResponse.json({ error: "Pick one of your products first." }, { status: 422 });
      const idea = (body.idea ?? {}) as Record<string, unknown>;
      const versions = await draftTextVersionsLive(liveProvider(), {
        variable,
        count,
        product: { name: product.name, category: product.category, targetUsers: product.targetUsers },
        idea: { headline: String(idea.headline ?? "").slice(0, 300), description: String(idea.description ?? "").slice(0, 600) },
      });
      return NextResponse.json({ versions, demo: false });
    }
    return NextResponse.json({ error: "kind must be 'language' or 'versions'." }, { status: 400 });
  } catch (e) {
    return aiFailure(e);
  }
}

function liveProvider() {
  // A live LLM key is set on this path (draftAvailability), so the mock is never used.
  return getLlmProvider({ mock: { task: "unused", respond: () => "{}" } });
}

function aiFailure(e: unknown) {
  if (e instanceof LlmDeclinedError) {
    return NextResponse.json({ error: "The AI would not draft this. Write these versions by hand.", code: "declined" }, { status: 422 });
  }
  if (e instanceof LlmHttpError) {
    if (e.status === 429) return NextResponse.json({ error: "The AI is busy. Try again in a minute.", code: "busy" }, { status: 503 });
    if (e.status === 401 || e.status === 403) {
      console.error("draft-ai: the LLM key was rejected");
      return NextResponse.json({ error: "AI drafting is not set up correctly.", code: "misconfigured" }, { status: 503 });
    }
    console.error("draft-ai failed", e.status, e.code ?? "");
    return NextResponse.json({ error: "AI drafting failed. Try again.", code: "failed" }, { status: 502 });
  }
  if (e instanceof Anthropic.RateLimitError) {
    return NextResponse.json({ error: "The AI is busy. Try again in a minute.", code: "busy" }, { status: 503 });
  }
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
    console.error("draft-ai: the LLM key was rejected");
    return NextResponse.json({ error: "AI drafting is not set up correctly.", code: "misconfigured" }, { status: 503 });
  }
  if (e instanceof LlmTruncatedError || e instanceof Anthropic.APIError || e instanceof Anthropic.APIConnectionError) {
    console.error("draft-ai failed", e instanceof Anthropic.APIError ? e.status : e instanceof Error ? e.name : "");
    return NextResponse.json({ error: "AI drafting failed. Try again.", code: "failed" }, { status: 502 });
  }
  throw e;
}
