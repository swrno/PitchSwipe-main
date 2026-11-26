// Run: node --import ./scripts/register-ts.mjs --test src/lib/ratelimit/body.test.ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readBodyCapped } from "./body";

function streamed(chunks: number[], headers: Record<string, string> = {}) {
  let i = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i >= chunks.length) return controller.close();
      controller.enqueue(new Uint8Array(chunks[i++]).fill(1));
    },
  });
  return new Request("http://x.test", { method: "POST", body, headers, duplex: "half" } as RequestInit);
}

describe("readBodyCapped", () => {
  it("reads a body under the cap", async () => {
    const r = await readBodyCapped(streamed([10, 10]), 100);
    assert.ok(r.ok && r.bytes.length === 20);
  });
  it("rejects a chunked body over the cap with no Content-Length", async () => {
    const req = streamed([60, 60]);
    assert.equal(req.headers.get("content-length"), null);
    const r = await readBodyCapped(req, 100);
    assert.deepEqual(r, { ok: false, reason: "too_large" });
  });
  it("does not trust a Content-Length that lies low", async () => {
    const r = await readBodyCapped(streamed([200], { "content-length": "5" }), 100);
    assert.equal(r.ok, false);
  });
  it("rejects a big declared length early", async () => {
    const r = await readBodyCapped(new Request("http://x.test", { method: "POST", body: "x", headers: { "content-length": "999" } }), 100);
    assert.equal(r.ok, false);
  });
});
