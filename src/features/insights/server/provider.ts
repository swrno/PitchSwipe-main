/**
 * The LLM provider for the insights page.
 *  - a live key set (GROQ_API_KEY or LLM_API_KEY): the live provider (through @/shared/lib/ai).
 *  - Otherwise a deterministic mock that answers with nothing, so code's templates are used.
 * Server only. The key is never logged or sent to the browser.
 */
import { ai, getLlmProvider, isLlmConfigured, type LlmProvider } from "@/shared/lib/ai";

import { THEMES_TASK, WORDING_TASK } from "../build";

export function insightsProvider(env: Record<string, string | undefined> = process.env): LlmProvider {
  if (isLlmConfigured(env)) return getLlmProvider({ env, mock: { task: WORDING_TASK, respond: () => "{}" } });
  return ai.createMockProvider({
    responses: {
      [WORDING_TASK]: () => "{}",
      [THEMES_TASK]: () => '{"themes":[]}',
    },
  });
}
