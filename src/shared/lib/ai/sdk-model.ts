import { createAnthropic } from "@ai-sdk/anthropic";
import { createGroq } from "@ai-sdk/groq";
import type { LanguageModel } from "ai";

import { DEFAULT_MODEL as ANTHROPIC_DEFAULT_MODEL } from "./anthropic-provider";
import { GROQ_DEFAULT_MODEL } from "./groq-provider";
import { llmVendor } from "./llm-env";

type Env = Record<string, string | undefined>;

export interface SdkModel {
  model: LanguageModel;
  vendor: "groq" | "anthropic";
  modelId: string;
}

/**
 * The Vercel AI SDK model for this process, picked from the same env as the rest of the app (llm-env.ts):
 * Groq (GROQ_API_KEY, or LLM_API_KEY starting "gsk_") or Claude (LLM_API_KEY). LLM_MODEL overrides the model id.
 * Null when no key is set: callers then use their own scripted / template fallback.
 */
export function sdkModel(env: Env = process.env): SdkModel | null {
  const vendor = llmVendor(env);
  if (vendor === "groq") {
    const apiKey = (env.GROQ_API_KEY?.trim() || env.LLM_API_KEY?.trim()) ?? "";
    const modelId = env.LLM_MODEL?.trim() || GROQ_DEFAULT_MODEL;
    return { model: createGroq({ apiKey })(modelId), vendor, modelId };
  }
  if (vendor === "anthropic") {
    const apiKey = env.LLM_API_KEY?.trim() ?? "";
    const modelId = env.LLM_MODEL?.trim() || ANTHROPIC_DEFAULT_MODEL;
    return { model: createAnthropic({ apiKey })(modelId), vendor, modelId };
  }
  return null;
}
