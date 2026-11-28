/**
 * What "Draft with AI" / "Translate with AI" may do right now (pure; the route applies it).
 *  - not_configured: no LLM key (GROQ_API_KEY or LLM_API_KEY): answer 503.
 *  - live:           a key is set: the model drafts through `./ai-live` (checked by code before it is returned).
 */
import { isLlmConfigured } from "@/shared/lib/ai/llm-env";

export type DraftAvailability = "not_configured" | "live";

export const AI_NOT_CONFIGURED_MESSAGE = "AI drafts need an LLM key to be configured";

export function draftAvailability(opts: { env: Record<string, string | undefined> }): DraftAvailability {
  return isLlmConfigured(opts.env) ? "live" : "not_configured";
}

export interface LanguageBase {
  headline: string;
  description: string;
  reward: string;
  question: string;
  positiveLabel: string;
  negativeLabel: string;
}
