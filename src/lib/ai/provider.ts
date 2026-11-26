import { createLlmProvider, isLlmConfigured } from "./llm-env";
import { ai } from "./services";
import type { LlmProvider, LlmRequest } from "./services-ai";

export type MockResponder = (request: LlmRequest) => string;

/**
 * The LLM provider for this process.
 *  - a live key set: Groq (GROQ_API_KEY, groq-provider.ts) or Claude (LLM_API_KEY, anthropic-provider.ts); see llm-env.ts.
 *  - otherwise: the deterministic mock. `mock` answers the given task name; any other task
 *    falls back to the services/ai canned answers.
 * Tests pass their own provider and never reach this.
 */
export function getLlmProvider(options: {
  env?: Record<string, string | undefined>;
  mock: { task: string; respond: MockResponder };
  fetchImpl?: typeof fetch;
}): LlmProvider {
  const env = options.env ?? process.env;
  if (isLlmConfigured(env)) return createLlmProvider(env, { fetchImpl: options.fetchImpl });
  return ai.createMockProvider({ responses: { [options.mock.task]: options.mock.respond } });
}
