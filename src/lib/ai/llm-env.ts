import { createAnthropicProvider, type AnthropicProviderOptions } from "./anthropic-provider";
import { createGroqProvider, GROQ_FAST_MODEL } from "./groq-provider";
import type { LlmProvider } from "./services-ai";

export type LlmVendor = "anthropic" | "groq";
type Env = Record<string, string | undefined>;

/**
 * Which live LLM this process uses, or null for none (then drafting says it needs a key, Ask uses its scripted
 * planner, insights use code templates and swipers type the English of a voice note).
 *
 *   LLM_PROVIDER=groq|anthropic  optional, wins when set
 *   GROQ_API_KEY                 Groq (free tier) — the key in use today
 *   LLM_API_KEY                  Claude; a key starting "gsk_" is a Groq key and is treated as one
 */
export function llmVendor(env: Env = process.env): LlmVendor | null {
  const groqKey = env.GROQ_API_KEY?.trim();
  const llmKey = env.LLM_API_KEY?.trim();
  const choice = env.LLM_PROVIDER?.trim().toLowerCase();
  if (choice === "groq") return groqKey || llmKey ? "groq" : null;
  if (choice === "anthropic") return llmKey ? "anthropic" : null;
  if (llmKey) return llmKey.startsWith("gsk_") ? "groq" : "anthropic";
  if (groqKey) return "groq";
  return null;
}

/** True when a live LLM key is configured (every "is AI on?" check in the app goes through this). */
export function isLlmConfigured(env: Env = process.env): boolean {
  return llmVendor(env) !== null;
}

/** The live provider for this env. Throws when none is configured (callers check isLlmConfigured first). */
export function createLlmProvider(env: Env = process.env, options: AnthropicProviderOptions = {}): LlmProvider {
  const vendor = llmVendor(env);
  if (vendor === "groq") return createGroqProvider(env, options);
  if (vendor === "anthropic") return createAnthropicProvider(env, options);
  throw new Error("No LLM key is set (GROQ_API_KEY or LLM_API_KEY).");
}

/**
 * Model for short voice-note translations: LLM_TRANSLATE_MODEL, else on Groq the fast model (its own rate-limit budget,
 * with the main model as its fallback), else LLM_MODEL like every other call.
 */
export function translateModel(env: Env = process.env): string | undefined {
  const set = env.LLM_TRANSLATE_MODEL?.trim();
  if (set) return set;
  return llmVendor(env) === "groq" ? GROQ_FAST_MODEL : env.LLM_MODEL;
}
