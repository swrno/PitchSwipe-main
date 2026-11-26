// Run: node --import ./scripts/register-ts.mjs --test src/lib/ai/groq.test.ts
// The Groq provider and the provider choice, with a fake fetch: no network, no key.
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createGroqProvider, GROQ_DEFAULT_MODEL, GROQ_FAST_MODEL, LlmHttpError, stripReasoning } from "./groq-provider";
import { isLlmConfigured, llmVendor, translateModel } from "./llm-env";

type Call = { url: string; body: Record<string, unknown>; auth: string | null };

function fakeGroq(answers: ((model: string) => { status: number; json: unknown })[]) {
  const calls: Call[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    calls.push({ url, body, auth: new Headers(init.headers).get("authorization") });
    const next = answers[Math.min(calls.length - 1, answers.length - 1)](body.model);
    return new Response(JSON.stringify(next.json), { status: next.status, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

const ok = (content: string, finish = "stop") => (model: string) => ({
  status: 200,
  json: { model, choices: [{ finish_reason: finish, message: { content } }] },
});
const err = (status: number, code: string, message = "error") => () => ({ status, json: { error: { code, message } } });
const req = { task: "t", system: "sys", user: "hello" };
const env = { GROQ_API_KEY: "gsk_test" };

describe("Groq provider", () => {
  it("sends an OpenAI-style chat request to the main model, reasoning kept out of the answer", async () => {
    const { calls, fetchImpl } = fakeGroq([ok('{"english":"Hi"}')]);
    const p = createGroqProvider(env, { fetchImpl });
    const res = await p.complete(req);
    assert.equal(res.text, '{"english":"Hi"}');
    assert.equal(res.model, GROQ_DEFAULT_MODEL);
    assert.equal(p.name, "groq");
    assert.equal(calls[0].url, "https://api.groq.com/openai/v1/chat/completions");
    assert.equal(calls[0].auth, "Bearer gsk_test");
    assert.deepEqual(calls[0].body.messages, [
      { role: "system", content: "sys" },
      { role: "user", content: "hello" },
    ]);
    assert.equal(calls[0].body.reasoning_effort, "low");
    assert.equal(calls[0].body.include_reasoning, false);
  });

  it("moves to the fallback model when the main one is rate limited", async () => {
    const { calls, fetchImpl } = fakeGroq([err(429, "rate_limit_exceeded"), ok("fine")]);
    const res = await createGroqProvider(env, { fetchImpl }).complete(req);
    assert.equal(res.text, "fine");
    assert.deepEqual(calls.map((c) => c.body.model), [GROQ_DEFAULT_MODEL, GROQ_FAST_MODEL]);
  });

  it("moves to the fallback model when the main one is shut down", async () => {
    const { calls, fetchImpl } = fakeGroq([err(400, "model_decommissioned", "The model has been decommissioned"), ok("fine")]);
    await createGroqProvider(env, { fetchImpl }).complete(req);
    assert.equal(calls[1].body.model, GROQ_FAST_MODEL);
  });

  it("does not retry a rejected key", async () => {
    const { calls, fetchImpl } = fakeGroq([err(401, "invalid_api_key")]);
    await assert.rejects(createGroqProvider(env, { fetchImpl }).complete(req), (e: unknown) => e instanceof LlmHttpError && e.status === 401);
    assert.equal(calls.length, 1);
  });

  it("gives up after its passes when every model stays rate limited", async () => {
    const { calls, fetchImpl } = fakeGroq([err(429, "rate_limit_exceeded")]);
    await assert.rejects(createGroqProvider(env, { fetchImpl, maxRetries: 0 }).complete(req), { name: "LlmHttpError" });
    assert.equal(calls.length, 2, "one try per model, no retries");
  });

  it("a cut-off answer is never returned as complete", async () => {
    const { fetchImpl } = fakeGroq([ok('{"english":"Hal', "length")]);
    await assert.rejects(createGroqProvider(env, { fetchImpl }).complete(req), { name: "LlmTruncatedError" });
  });

  it("honours LLM_MODEL, LLM_FALLBACK_MODEL=none and the output cap", async () => {
    const { calls, fetchImpl } = fakeGroq([err(429, "rate_limit_exceeded")]);
    const p = createGroqProvider({ ...env, LLM_MODEL: GROQ_FAST_MODEL, LLM_FALLBACK_MODEL: "none" }, { fetchImpl, maxRetries: 0, maxTokens: 300 });
    await assert.rejects(p.complete(req));
    assert.equal(calls.length, 1);
    assert.equal(calls[0].body.model, GROQ_FAST_MODEL);
    assert.equal(calls[0].body.max_completion_tokens, 300);
  });

  it("strips inline <think> blocks", () => {
    assert.equal(stripReasoning("<think>let me see</think>\n{\"a\":1}"), '{"a":1}');
  });
});

describe("provider choice", () => {
  it("Groq key, Claude key, explicit choice, none", () => {
    assert.equal(llmVendor({ GROQ_API_KEY: "gsk_x" }), "groq");
    assert.equal(llmVendor({ LLM_API_KEY: "gsk_x" }), "groq");
    assert.equal(llmVendor({ LLM_API_KEY: "sk-ant-x" }), "anthropic");
    assert.equal(llmVendor({ LLM_API_KEY: "sk-ant-x", GROQ_API_KEY: "gsk_x", LLM_PROVIDER: "groq" }), "groq");
    assert.equal(llmVendor({ GROQ_API_KEY: "gsk_x", LLM_PROVIDER: "anthropic" }), null);
    assert.equal(llmVendor({}), null);
    assert.equal(isLlmConfigured({ GROQ_API_KEY: " " }), false);
  });

  it("voice-note translation uses the fast Groq model unless told otherwise", () => {
    assert.equal(translateModel({ GROQ_API_KEY: "gsk_x" }), GROQ_FAST_MODEL);
    assert.equal(translateModel({ GROQ_API_KEY: "gsk_x", LLM_TRANSLATE_MODEL: "qwen/qwen3.8-27b" }), "qwen/qwen3.8-27b");
    assert.equal(translateModel({ LLM_API_KEY: "sk-ant-x", LLM_MODEL: "claude-haiku-5-5" }), "claude-haiku-5-5");
  });
});
