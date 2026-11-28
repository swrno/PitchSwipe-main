// Run: npm test -- ai
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ai, buildFactTable, checkAndFill, extractJson, factSlug, getLlmProvider, runToolLoop, type ToolDef } from "../index";

const facts = [
  { key: "t1.gujarat.joinRate", value: 22, display: "22%" },
  { key: "t1.gujarat.swipers", value: 41, display: "41" },
];

describe("checkAndFill", () => {
  const table = buildFactTable(facts);
  it("fills placeholders from the table", () => {
    const r = checkAndFill("Joins {t1.gujarat.joinRate} of {t1.gujarat.swipers}.", table);
    assert.deepEqual(r.ok && r.text, "Joins 22% of 41.");
  });
  it("rejects typed figures and unknown facts", () => {
    assert.equal(checkAndFill("Joins 22%.", table).ok, false);
    assert.equal(checkAndFill("Joins {t1.nope}.", table).ok, false);
  });
  it("accepts text with no figures", () => {
    assert.equal(checkAndFill("Gujarat leads.", table).ok, true);
  });
});

describe("helpers", () => {
  it("factSlug is placeholder-safe", () => {
    assert.equal(factSlug("Uttar Pradesh"), "uttar_pradesh");
    assert.equal(factSlug("???"), "x");
  });
  it("extractJson tolerates fences and prose", () => {
    assert.deepEqual(extractJson('Here:\n```json\n{"a":1}\n```'), { a: 1 });
    assert.equal(extractJson("no json"), null);
    assert.equal(extractJson("[1]"), null);
  });
});

describe("provider selection", () => {
  const mock = { task: "t", respond: () => '{"final":{}}' };
  it("uses the mock without LLM_API_KEY", () => {
    assert.equal(getLlmProvider({ env: {}, mock }).name, "mock");
  });
  // A fake Messages API: records each request and answers with the given message fields (no network).
  function fakeApi(reply: Record<string, unknown>) {
    const sent: { url: string; headers: Headers; body: Record<string, unknown> }[] = [];
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      sent.push({ url: String(url), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
      const message = {
        id: "msg_1",
        type: "message",
        role: "assistant",
        model: "claude-opus-5-5",
        content: [],
        stop_reason: "end_turn",
        stop_details: null,
        usage: { input_tokens: 1, output_tokens: 1 },
        ...reply,
      };
      return new Response(JSON.stringify(message), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;
    return { sent, fetchImpl };
  }

  it("uses Claude through the Anthropic SDK with LLM_API_KEY (injected fetch, no network)", async () => {
    const api = fakeApi({
      content: [
        { type: "thinking", thinking: "", signature: "x" },
        { type: "text", text: '{"final":{"text":"hi"}}' },
      ],
    });
    const p = getLlmProvider({ env: { LLM_API_KEY: "test-key" }, mock, fetchImpl: api.fetchImpl });
    assert.equal(p.name, "anthropic");
    const out = await p.complete({ task: "t", system: "s", user: "u", maxTokens: 800 });
    assert.equal(out.text, '{"final":{"text":"hi"}}');
    const req = api.sent[0];
    assert.match(req.url, /\/v1\/messages/);
    // The key is sent; which header carries it is the SDK's business (1.x uses a bearer token).
    assert.ok(req.headers.get("x-api-key") === "test-key" || req.headers.get("authorization") === "Bearer test-key");
    assert.match(req.headers.get("anthropic-beta") ?? "", /server-side-fallback-2026-07-01/);
    assert.equal(req.body.model, "claude-opus-5-5");
    assert.equal(req.body.fallbacks, "default");
    assert.equal(req.body.system, "s");
    assert.deepEqual(req.body.messages, [{ role: "user", content: "u" }]);
    // A template's short output cap is raised so thinking cannot crowd out the answer.
    assert.ok((req.body.max_tokens as number) >= 16_000);
    assert.equal("thinking" in req.body, false);
    // Effort stays the model default here; only the voice translation call lowers it.
    assert.equal("output_config" in req.body, false);
  });

  it("LLM_MODEL overrides the model", async () => {
    const api = fakeApi({ content: [{ type: "text", text: "ok" }] });
    await getLlmProvider({ env: { LLM_API_KEY: "k", LLM_MODEL: "m1" }, mock, fetchImpl: api.fetchImpl }).complete({ task: "t", system: "s", user: "u" });
    assert.equal(api.sent[0].body.model, "m1");
  });

  it("a declined request throws instead of returning partial text", async () => {
    const api = fakeApi({ content: [], stop_reason: "refusal", stop_details: { type: "refusal", category: "cyber", explanation: null } });
    const p = getLlmProvider({ env: { LLM_API_KEY: "k" }, mock, fetchImpl: api.fetchImpl });
    await assert.rejects(p.complete({ task: "t", system: "s", user: "u" }), (e: Error & { category?: string }) => {
      assert.equal(e.name, "LlmDeclinedError");
      assert.equal(e.category, "cyber");
      return true;
    });
  });

  it("an answer cut off at max_tokens throws", async () => {
    const api = fakeApi({ content: [{ type: "text", text: '{"fin' }], stop_reason: "max_tokens" });
    const p = getLlmProvider({ env: { LLM_API_KEY: "k" }, mock, fetchImpl: api.fetchImpl });
    await assert.rejects(p.complete({ task: "t", system: "s", user: "u" }), { name: "LlmTruncatedError" });
  });
});

describe("runToolLoop", () => {
  const echo: ToolDef<{ n: number }> = {
    name: "echo",
    description: "d",
    args: "{}",
    async run(args, ctx, ref) {
      return { result: { got: args.x, n: ctx.n }, facts: [{ key: `${ref}.n`, value: 3, display: "3" }], summary: "Echoed", call: "echo()" };
    },
  };
  const boom: ToolDef<{ n: number }> = { ...echo, name: "boom", async run() { throw new Error("nope"); } };

  it("runs tools, feeds results back with fact displays, and returns the final", async () => {
    const seen: string[] = [];
    let turn = 0;
    const provider = ai.createMockProvider({
      responses: {
        t: (req) => {
          seen.push(req.user);
          return turn++ === 0 ? '{"tool_calls":[{"tool":"echo","args":{"x":1}},{"tool":"boom","args":{}}]}' : '{"final":{"text":"done"}}';
        },
      },
    });
    const r = await runToolLoop({ provider, task: "t", system: "s", input: { question: "q" }, tools: [echo, boom], ctx: { n: 7 } });
    assert.deepEqual(r.final, { text: "done" });
    assert.equal(r.steps[0].id, "echo#1");
    assert.equal(r.steps[1].ok, false);
    const second = JSON.parse(seen[1]);
    assert.equal(second.toolResults[0].facts["echo1.n"], "3");
    assert.deepEqual(second.toolResults[1].result, { error: "nope" });
  });
});
