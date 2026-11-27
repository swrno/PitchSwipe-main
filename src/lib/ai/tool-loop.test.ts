// Run: node --import ./scripts/register-ts.mjs --test src/lib/ai/tool-loop.test.ts
// The generic tool loop behind Ask: JSON in, only listed tools run, failures go back to the model, never to the user.
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { LlmProvider, LlmRequest } from "./services-ai";
import { PROTOCOL, extractJson, runToolLoop, type ToolDef } from "./tool-loop";

/** A provider that answers with the scripted replies in order and records what it was sent. */
function scripted(replies: string[]): LlmProvider & { calls: LlmRequest[] } {
  const calls: LlmRequest[] = [];
  return {
    name: "scripted",
    model: "test-model",
    calls,
    async complete(request: LlmRequest) {
      calls.push(request);
      return { text: replies[Math.min(calls.length - 1, replies.length - 1)], model: "test-model" };
    },
  };
}

const segments: ToolDef<{ deck: string }> = {
  name: "get_segments",
  description: "Results by group",
  args: '{"by": "state"}',
  async run(args, ctx, ref) {
    return {
      result: { deck: ctx.deck, by: args.by },
      facts: [{ key: `${ref}.swipers`, value: 120, display: "120 swipers" }],
      summary: "Looked up results by state",
      call: `get_segments(by="${String(args.by)}")`,
    };
  },
};

const broken: ToolDef<{ deck: string }> = {
  name: "broken",
  description: "Always fails",
  args: "{}",
  async run() {
    throw new Error("No such deck.");
  },
};

const base = { task: "ask", system: "You answer founders.", input: { question: "Where do I win?" }, ctx: { deck: "headline" } };

describe("extractJson", () => {
  it("reads a bare object, a fenced block and an object inside prose", () => {
    assert.deepEqual(extractJson('{"a":1}'), { a: 1 });
    assert.deepEqual(extractJson('```json\n{"a":{"b":[1,2]}}\n```'), { a: { b: [1, 2] } });
    assert.deepEqual(extractJson('Sure! {"final":{"text":"ok"}} Hope that helps.'), { final: { text: "ok" } });
  });

  it("returns null for no object, broken JSON, arrays and primitives", () => {
    for (const text of ["", "no json here", "{broken", '{"a":}', "[1,2,3]", "}{", "42"]) {
      assert.equal(extractJson(text), null, text);
    }
  });
});

describe("runToolLoop", () => {
  it("returns the model's final answer straight away when it needs no tool", async () => {
    const provider = scripted(['{"final":{"text":"Gujarat leads."}}']);
    const res = await runToolLoop({ ...base, provider, tools: [segments] });
    assert.deepEqual(res.final, { text: "Gujarat leads." });
    assert.equal(res.steps.length, 0);
    assert.equal(res.model, "test-model");
    assert.ok(provider.calls[0].system.endsWith(PROTOCOL), "the protocol is appended to the system prompt");
    assert.equal(JSON.parse(provider.calls[0].user).question, "Where do I win?");
  });

  it("runs a tool, hands its facts back to the model, then returns the answer", async () => {
    const provider = scripted([
      '{"tool_calls":[{"tool":"get_segments","args":{"by":"state"}}]}',
      '{"final":{"text":"{get_segments1.swipers} in Gujarat."}}',
    ]);
    const res = await runToolLoop({ ...base, provider, tools: [segments] });
    assert.equal(res.steps.length, 1);
    const [step] = res.steps;
    assert.equal(step.id, "get_segments#1");
    assert.equal(step.ref, "get_segments1");
    assert.equal(step.ok, true);
    assert.deepEqual(step.result, { deck: "headline", by: "state" });
    const second = JSON.parse(provider.calls[1].user);
    assert.deepEqual(second.toolResults[0].facts, { "get_segments1.swipers": "120 swipers" }, "the model sees display text, keyed");
    assert.deepEqual(res.final, { text: "{get_segments1.swipers} in Gujarat." });
  });

  it("numbers repeated calls to the same tool", async () => {
    const provider = scripted([
      '{"tool_calls":[{"tool":"get_segments","args":{"by":"state"}},{"tool":"get_segments","args":{"by":"role"}}]}',
      '{"final":{}}',
    ]);
    const res = await runToolLoop({ ...base, provider, tools: [segments] });
    assert.deepEqual(res.steps.map((s) => s.id), ["get_segments#1", "get_segments#2"]);
    assert.equal(res.steps[1].facts[0].key, "get_segments2.swipers");
  });

  it("reports an unknown tool and a failing tool back to the model, not to the user", async () => {
    const provider = scripted(['{"tool_calls":[{"tool":"publish_deck","args":{}},{"tool":"broken","args":{}}]}', '{"final":{"text":"done"}}']);
    const res = await runToolLoop({ ...base, provider, tools: [segments, broken] });
    assert.equal(res.steps[0].ok, false);
    assert.match(String((res.steps[0].result as { error: string }).error), /Unknown tool publish_deck\. Tools: get_segments, broken\./);
    assert.equal(res.steps[1].ok, false);
    assert.deepEqual(res.steps[1].result, { error: "No such deck." });
    assert.deepEqual(res.final, { text: "done" });
    assert.equal(JSON.parse(provider.calls[1].user).toolResults.length, 2);
  });

  it("ignores malformed args and runs at most 3 calls a turn and maxCalls in all", async () => {
    const four = '{"tool_calls":[' + Array(4).fill('{"tool":"get_segments","args":[1]}').join(",") + "]}";
    const provider = scripted([four, four, '{"final":{}}']);
    const res = await runToolLoop({ ...base, provider, tools: [segments], maxCalls: 5 });
    assert.equal(res.steps.length, 5, "3 in the first turn, 2 more until maxCalls");
    assert.deepEqual(res.steps[0].args, {}, "array args become {}");
  });

  it("stops with an error when the model does not answer in JSON", async () => {
    const res = await runToolLoop({ ...base, provider: scripted(["I think Gujarat."]), tools: [segments] });
    assert.equal(res.final, null);
    assert.equal(res.error, "The model did not return JSON.");
  });

  it("stops with an error when the model makes no call and gives no answer", async () => {
    const res = await runToolLoop({ ...base, provider: scripted(['{"thoughts":"hmm"}']), tools: [segments] });
    assert.equal(res.error, "The model made no tool call and no answer.");
  });

  it("stops after maxSteps turns without an answer", async () => {
    const provider = scripted(['{"tool_calls":[{"tool":"get_segments","args":{}}]}']);
    const res = await runToolLoop({ ...base, provider, tools: [segments], maxSteps: 2, maxCalls: 10 });
    assert.equal(provider.calls.length, 2);
    assert.equal(res.steps.length, 2);
    assert.equal(res.error, "The model used all its steps without answering.");
  });
});
