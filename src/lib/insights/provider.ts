/**
 * The LLM provider for the insights page.
 *  - a live key set (GROQ_API_KEY or LLM_API_KEY): the live provider (through @/lib/ai).
 *  - Otherwise the deterministic mock. In demo mode it words the two design cards and groups the demo
 *    comments; for any other data it answers with nothing, so code's templates are used.
 * Server only. The key is never logged or sent to the browser.
 */
import { ai, getLlmProvider, isLlmConfigured, type LlmProvider } from "@/lib/ai";

import { THEMES_TASK, WORDING_TASK } from "./build";
import { demoThemes, demoWording } from "./demo";

export function insightsProvider(demo: boolean, env: Record<string, string | undefined> = process.env): LlmProvider {
  if (isLlmConfigured(env)) return getLlmProvider({ env, mock: { task: WORDING_TASK, respond: demoWording } });
  return ai.createMockProvider({
    responses: {
      [WORDING_TASK]: demo ? demoWording : () => "{}",
      [THEMES_TASK]: demo ? demoThemes : () => '{"themes":[]}',
    },
  });
}
