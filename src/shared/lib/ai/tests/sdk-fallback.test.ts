import assert from "node:assert/strict";
import { test } from "node:test";

import type { LanguageModelV4 } from "@ai-sdk/provider";

import { shouldFallBack, withFallback } from "../sdk-model";

function fake(id: string, behaviour: "ok" | Error): LanguageModelV4 & { calls: number } {
  const model = {
    specificationVersion: "v4" as const,
    provider: "fake",
    modelId: id,
    supportedUrls: {},
    calls: 0,
    async doGenerate() {
      model.calls += 1;
      if (behaviour instanceof Error) throw behaviour;
      return { text: id } as never;
    },
    async doStream() {
      model.calls += 1;
      if (behaviour instanceof Error) throw behaviour;
      return { stream: id } as never;
    },
  };
  return model;
}

const rateLimit = Object.assign(new Error("Rate limit reached for model on tokens per minute (TPM)"), { statusCode: 429 });
const badRequest = Object.assign(new Error("Invalid request"), { statusCode: 400 });

test("rate limits, overloads and outages fall back; bad requests do not", () => {
  assert.equal(shouldFallBack(rateLimit), true);
  assert.equal(shouldFallBack({ statusCode: 503 }), true);
  assert.equal(shouldFallBack({ message: "model has been decommissioned" }), true);
  assert.equal(shouldFallBack(badRequest), false);
  assert.equal(shouldFallBack(null), false);
});

test("a rate-limited main model hands the same call to the fallback", async () => {
  const main = fake("main", rateLimit);
  const backup = fake("backup", "ok");
  const model = withFallback(main, backup);
  assert.deepEqual(await model.doGenerate({} as never), { text: "backup" });
  assert.deepEqual(await model.doStream({} as never), { stream: "backup" });
  assert.equal(main.calls, 2);
  assert.equal(backup.calls, 2);
});

test("a healthy main model never calls the fallback, and other errors are not retried", async () => {
  const main = fake("main", "ok");
  const backup = fake("backup", "ok");
  assert.deepEqual(await withFallback(main, backup).doGenerate({} as never), { text: "main" });
  assert.equal(backup.calls, 0);

  const broken = withFallback(fake("main", badRequest), backup);
  await assert.rejects(async () => {
    await broken.doStream({} as never);
  }, /Invalid request/);
  assert.equal(backup.calls, 0);
});
