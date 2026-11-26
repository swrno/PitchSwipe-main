import { LlmDeclinedError, LlmTruncatedError, type AnthropicProviderOptions } from "./anthropic-provider";
import type { LlmProvider, LlmRequest, LlmResponse } from "./services-ai";

/**
 * The LLM provider for a Groq key (free tier): Groq's OpenAI-compatible chat API over plain fetch, no SDK.
 * Same contract as the Claude provider (`complete({ task, system, user })` -> `{ text, model }`), so drafting, Ask,
 * insights wording, comment themes and voice-note translation run on it unchanged, and code still checks every answer.
 *
 *   GROQ_API_KEY (or LLM_API_KEY starting gsk_)  required, server only, never logged
 *   LLM_MODEL           optional, default openai/gpt-oss-120b
 *   LLM_FALLBACK_MODEL  optional, default openai/gpt-oss-20b ("none" turns the fallback off)
 *   LLM_BASE_URL        optional, default https://api.groq.com/openai/v1
 *
 * Why these two models (checked 26 Nov 2026): both are Groq "production" models (preview models can be removed at short
 * notice), and gpt-oss-120b is Groq's named replacement for nearly every model it retired in 2025-26. The free plan
 * limits each model separately (1,000 requests a day, 8,000 tokens a minute), so when the main model is rate limited,
 * shut down or failing, the call moves to the fallback model and its own budget.
 */
export const GROQ_DEFAULT_MODEL = "openai/gpt-oss-120b";
export const GROQ_FAST_MODEL = "openai/gpt-oss-20b";
export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

/** Default output cap when the template sets none. Reasoning counts towards it, and towards the 8k tokens a minute. */
const DEFAULT_MAX_TOKENS = 2_000;
const DEFAULT_TIMEOUT_MS = 30_000;

/** Groq answered with an error status (or could not be reached: status 0). */
export class LlmHttpError extends Error {
  readonly status: number;
  readonly code: string | null;
  constructor(status: number, code: string | null, message: string) {
    super(message);
    this.name = "LlmHttpError";
    this.status = status;
    this.code = code;
  }
}

export type GroqProviderOptions = AnthropicProviderOptions;

/** Rate limited, shut down or unknown model, or a server-side failure: worth one try on the other model. */
function shouldTryNext(e: unknown): boolean {
  if (!(e instanceof LlmHttpError)) return false;
  if (e.status === 0 || e.status === 429 || e.status >= 500) return true;
  return (e.status === 400 || e.status === 404) && /model/i.test(`${e.code ?? ""} ${e.message}`);
}

/** gpt-oss reasons on a separate channel; Qwen-style models may inline <think> blocks. Never part of the answer. */
export function stripReasoning(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

function reasoningParams(model: string, effort: GroqProviderOptions["effort"]): Record<string, unknown> {
  if (model.startsWith("openai/gpt-oss")) return { reasoning_effort: effort ?? "low", include_reasoning: false };
  if (model.startsWith("qwen/")) return { reasoning_format: "hidden" };
  return {};
}

export function createGroqProvider(env: Record<string, string | undefined>, options: GroqProviderOptions = {}): LlmProvider {
  const apiKey = env.GROQ_API_KEY?.trim() || env.LLM_API_KEY?.trim();
  if (!apiKey) throw new Error("GROQ_API_KEY is not set.");
  const model = env.LLM_MODEL?.trim() || GROQ_DEFAULT_MODEL;
  const fallbackSetting = env.LLM_FALLBACK_MODEL?.trim();
  const fallback = fallbackSetting === "none" ? undefined : fallbackSetting || (model === GROQ_FAST_MODEL ? GROQ_DEFAULT_MODEL : GROQ_FAST_MODEL);
  const models = fallback && fallback !== model ? [model, fallback] : [model];
  const baseUrl = (env.LLM_BASE_URL?.trim() || GROQ_BASE_URL).replace(/\/+$/, "");
  const doFetch = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  async function call(m: string, request: LlmRequest): Promise<LlmResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await doFetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: m,
          messages: [
            { role: "system", content: request.system },
            { role: "user", content: request.user },
          ],
          max_completion_tokens: options.maxTokens ?? Math.max(request.maxTokens ?? 0, DEFAULT_MAX_TOKENS),
          ...reasoningParams(m, options.effort),
        }),
        signal: controller.signal,
      });
    } catch (e) {
      throw new LlmHttpError(0, null, controller.signal.aborted ? "Groq timed out." : `Groq could not be reached: ${e instanceof Error ? e.name : "error"}`);
    } finally {
      clearTimeout(timer);
    }
    const json = (await res.json().catch(() => null)) as {
      model?: string;
      error?: { message?: string; code?: string; type?: string };
      choices?: { finish_reason?: string; message?: { content?: string | null } }[];
    } | null;
    if (!res.ok) {
      throw new LlmHttpError(res.status, json?.error?.code ?? json?.error?.type ?? null, json?.error?.message?.slice(0, 200) || `Groq answered ${res.status}.`);
    }
    const choice = json?.choices?.[0];
    if (choice?.finish_reason === "length") throw new LlmTruncatedError();
    if (choice?.finish_reason === "content_filter") throw new LlmDeclinedError(null);
    return { text: stripReasoning(choice?.message?.content ?? ""), model: json?.model ?? m };
  }

  return {
    name: "groq",
    model,
    async complete(request: LlmRequest): Promise<LlmResponse> {
      let last: unknown;
      // One try per model, plus the SDK-style retries the caller asked for (default 1 extra pass, 0 for voice notes).
      const passes = 1 + Math.max(0, Math.min(options.maxRetries ?? 1, 2));
      for (let pass = 0; pass < passes; pass++) {
        for (const m of models) {
          try {
            return await call(m, request);
          } catch (e) {
            last = e;
            if (!shouldTryNext(e)) throw e;
          }
        }
      }
      throw last;
    },
  };
}
