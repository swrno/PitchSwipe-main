import Anthropic from "@anthropic-ai/sdk";
import type { LlmProvider, LlmRequest, LlmResponse } from "./services-ai";

/**
 * The live LLM provider: Claude through the official Anthropic SDK. Same contract as the engine's providers
 * (`complete({ task, system, user })` -> `{ text, model }`), so every service (drafting, Ask, insights wording)
 * runs on it unchanged and its rules engine still checks every answer.
 *
 *   LLM_API_KEY   required (server only, never logged)
 *   LLM_MODEL     optional, default claude-opus-5-5
 *   LLM_BASE_URL  optional API base (e.g. https://api.anthropic.com), not a /v1/messages URL
 */
export const DEFAULT_MODEL = "claude-opus-5-5";

/**
 * Thinking is on for this model and counts against max_tokens, so a template's short output cap (often 600-800)
 * is not used as the request cap: the floor below leaves room for both.
 */
const MIN_MAX_TOKENS = 16_000;

/** The model declined the request (safety stop) and the server-side fallback declined too. */
export class LlmDeclinedError extends Error {
  readonly category: string | null;
  constructor(category: string | null) {
    super("The AI declined this request.");
    this.name = "LlmDeclinedError";
    this.category = category;
  }
}

/** The answer was cut off at max_tokens, so it cannot be trusted as complete JSON. */
export class LlmTruncatedError extends Error {
  constructor() {
    super("The AI answer was cut off.");
    this.name = "LlmTruncatedError";
  }
}

/** True for models that take `output_config.effort` (Claude 4.6 and later families). Unknown names: false. */
export function takesEffort(model: string): boolean {
  const m = /^claude-(?:opus|sonnet|haiku|fable|mythos)-(\d+)(?:-(\d{1,2})(?!\d))?/.exec(model);
  if (!m) return false;
  const major = Number(m[1]);
  const minor = m[2] ? Number(m[2]) : 0;
  return major > 4 || (major === 4 && minor >= 6);
}

export interface AnthropicProviderOptions {
  fetchImpl?: typeof fetch;
  /**
   * A hard output cap (thinking included) instead of the 16k floor, for short, cheap calls. An answer that hits it
   * throws LlmTruncatedError.
   */
  maxTokens?: number;
  /** Sent as output_config.effort when the model takes it. Unset: the model's default effort. */
  effort?: "low" | "medium" | "high";
  /** Per-request timeout in ms (SDK default: 10 minutes). */
  timeoutMs?: number;
  /** SDK retries (SDK default: 2). */
  maxRetries?: number;
}

export function createAnthropicProvider(
  env: Record<string, string | undefined>,
  options: AnthropicProviderOptions = {},
): LlmProvider {
  const apiKey = env.LLM_API_KEY;
  if (!apiKey) throw new Error("LLM_API_KEY is not set.");
  const model = env.LLM_MODEL?.trim() || DEFAULT_MODEL;
  const client = new Anthropic({
    apiKey,
    ...(env.LLM_BASE_URL?.trim() ? { baseURL: env.LLM_BASE_URL.trim() } : {}),
    ...(options.fetchImpl ? { fetch: options.fetchImpl } : {}),
    ...(options.timeoutMs !== undefined ? { timeout: options.timeoutMs } : {}),
    ...(options.maxRetries !== undefined ? { maxRetries: options.maxRetries } : {}),
  });
  const effort = options.effort && takesEffort(model) ? options.effort : undefined;

  return {
    name: "anthropic",
    model,
    async complete(request: LlmRequest): Promise<LlmResponse> {
      const response = await client.beta.messages.create({
        model,
        max_tokens: options.maxTokens ?? Math.max(request.maxTokens ?? 0, MIN_MAX_TOKENS),
        ...(effort ? { output_config: { effort } } : {}),
        system: request.system,
        messages: [{ role: "user", content: request.user }],
        // On a safety decline the API re-runs the request on a fallback model it picks, in the same call.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      });
      if (response.stop_reason === "refusal") {
        throw new LlmDeclinedError(response.stop_details?.category ?? null);
      }
      if (response.stop_reason === "max_tokens") throw new LlmTruncatedError();
      const text = response.content
        .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
        .map((block) => block.text)
        .join("");
      return { text, model: response.model };
    },
  };
}
