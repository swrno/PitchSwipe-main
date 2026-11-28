import { createAnthropic } from "@ai-sdk/anthropic";
import { createGroq } from "@ai-sdk/groq";
import type { LanguageModelV4 } from "@ai-sdk/provider";
import type { LanguageModel } from "ai";

import { DEFAULT_MODEL as ANTHROPIC_DEFAULT_MODEL } from "./anthropic-provider";
import { GROQ_DEFAULT_MODEL, GROQ_FAST_MODEL } from "./groq-provider";
import { llmVendor } from "./llm-env";

type Env = Record<string, string | undefined>;

export interface SdkModel {
  model: LanguageModel;
  vendor: "groq" | "anthropic";
  modelId: string;
}

/** Rate limited, overloaded, or the model is gone: worth one try on the fallback model (its own rate-limit budget). */
export function shouldFallBack(error: unknown): boolean {
  const e = error as { statusCode?: number; status?: number; message?: string } | null;
  const status = e?.statusCode ?? e?.status;
  if (status === 429 || status === 413 || status === 503 || status === 529 || (typeof status === "number" && status >= 500)) return true;
  return /rate limit|tokens per minute|overloaded|model.*(not found|decommissioned)/i.test(e?.message ?? "");
}

/**
 * Tries `main`, and on a rate limit / outage before any output, the same call on `fallback`. Groq's free plan limits
 * each model separately (8,000 tokens a minute), so the fallback model usually still has budget when the main one
 * is spent. Errors that are not about capacity (bad request, auth) are not retried.
 */
export function withFallback(main: LanguageModelV4, fallback: LanguageModelV4): LanguageModelV4 {
  return {
    specificationVersion: "v4",
    provider: main.provider,
    modelId: main.modelId,
    supportedUrls: main.supportedUrls,
    async doGenerate(options) {
      try {
        return await main.doGenerate(options);
      } catch (error) {
        if (!shouldFallBack(error)) throw error;
        return fallback.doGenerate(options);
      }
    },
    async doStream(options) {
      try {
        return await main.doStream(options);
      } catch (error) {
        if (!shouldFallBack(error)) throw error;
        return fallback.doStream(options);
      }
    },
  };
}

/**
 * The Vercel AI SDK model for this process, picked from the same env as the rest of the app (llm-env.ts):
 * Groq (GROQ_API_KEY, or LLM_API_KEY starting "gsk_") or Claude (LLM_API_KEY). LLM_MODEL overrides the model id.
 * On Groq the model falls back to LLM_FALLBACK_MODEL (default the fast model; "none" turns it off) when the main
 * model is rate limited. Callers should pass `maxRetries: 0`-ish settings so a limit switches models at once.
 * Null when no key is set: callers then use their own scripted / template fallback.
 */
export function sdkModel(env: Env = process.env): SdkModel | null {
  const vendor = llmVendor(env);
  if (vendor === "groq") {
    const apiKey = (env.GROQ_API_KEY?.trim() || env.LLM_API_KEY?.trim()) ?? "";
    const groq = createGroq({ apiKey });
    const modelId = env.LLM_MODEL?.trim() || GROQ_DEFAULT_MODEL;
    const fallbackId = env.LLM_FALLBACK_MODEL?.trim() || GROQ_FAST_MODEL;
    const main = groq(modelId) as unknown as LanguageModelV4;
    const model = fallbackId === "none" || fallbackId === modelId ? main : withFallback(main, groq(fallbackId) as unknown as LanguageModelV4);
    return { model: model as unknown as LanguageModel, vendor, modelId };
  }
  if (vendor === "anthropic") {
    const apiKey = env.LLM_API_KEY?.trim() ?? "";
    const modelId = env.LLM_MODEL?.trim() || ANTHROPIC_DEFAULT_MODEL;
    return { model: createAnthropic({ apiKey })(modelId), vendor, modelId };
  }
  return null;
}

/** The fast Groq model on its own (no wrapper), for a plain-text retry when a structured call failed. Same model for Claude. */
export function sdkFastModel(env: Env = process.env): LanguageModel | null {
  const vendor = llmVendor(env);
  if (vendor === "groq") {
    const apiKey = (env.GROQ_API_KEY?.trim() || env.LLM_API_KEY?.trim()) ?? "";
    return createGroq({ apiKey })(GROQ_FAST_MODEL) as unknown as LanguageModel;
  }
  return sdkModel(env)?.model ?? null;
}
