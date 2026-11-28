// Run: npm test -- flagsmith
// The default HTTP client every Flagsmith call goes through (global fetch stubbed: no network).
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { createFetchClient } from "../server/http";

type Seen = { url: string; init: RequestInit };
const realFetch = globalThis.fetch;

function stubFetch(status: number, body: string): Seen[] {
  const seen: Seen[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    seen.push({ url, init });
    return new Response(body === "" ? null : body, { status });
  }) as typeof fetch;
  return seen;
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("createFetchClient", () => {
  it("sends JSON with the caller's headers and returns the parsed body", async () => {
    const seen = stubFetch(201, '{"id":42}');
    const res = await createFetchClient()({
      method: "POST",
      url: "https://api.flagsmith.com/api/v1/projects/1/features/",
      headers: { Authorization: "Api-Key x" },
      body: { name: "deck_a" },
    });
    assert.deepEqual(res, { status: 201, json: { id: 42 } });
    const { init } = seen[0];
    assert.equal(init.method, "POST");
    assert.equal(init.body, '{"name":"deck_a"}');
    assert.equal(init.cache, "no-store");
    assert.ok(init.signal instanceof AbortSignal, "every call has a timeout");
    const headers = init.headers as Record<string, string>;
    assert.equal(headers.Accept, "application/json");
    assert.equal(headers["Content-Type"], "application/json");
    assert.equal(headers.Authorization, "Api-Key x");
  });

  it("sends no body and no content type on a GET", async () => {
    const seen = stubFetch(200, "[]");
    const res = await createFetchClient()({ method: "GET", url: "https://x/flags/", headers: {} });
    assert.deepEqual(res.json, []);
    assert.equal(seen[0].init.body, undefined);
    assert.equal("Content-Type" in (seen[0].init.headers as Record<string, string>), false);
  });

  it("returns null JSON for an empty or non-JSON body, keeping the status", async () => {
    stubFetch(204, "");
    assert.deepEqual(await createFetchClient()({ method: "DELETE", url: "https://x", headers: {} }), { status: 204, json: null });
    stubFetch(502, "<html>Bad gateway</html>");
    assert.deepEqual(await createFetchClient()({ method: "GET", url: "https://x", headers: {} }), { status: 502, json: null });
  });

  it("lets the caller's headers win over the defaults", async () => {
    const seen = stubFetch(200, "{}");
    await createFetchClient()({ method: "GET", url: "https://x", headers: { Accept: "text/plain" } });
    assert.equal((seen[0].init.headers as Record<string, string>).Accept, "text/plain");
  });

  it("a body of false or 0 is still sent", async () => {
    const seen = stubFetch(200, "{}");
    await createFetchClient()({ method: "PUT", url: "https://x", headers: {}, body: false });
    assert.equal(seen[0].init.body, "false");
  });
});
