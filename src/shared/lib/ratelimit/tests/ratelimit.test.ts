// Run: npm test -- ratelimit
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { clientKey, limitRequest, rateLimit, resetRateLimits, trackedKeys } from "../index";

const opts = { limit: 3, windowMs: 1000 };
const req = (headers: Record<string, string> = {}) => new Request("http://x.test/api", { headers });

describe("rateLimit", () => {
  beforeEach(resetRateLimits);

  it("allows up to the limit then blocks with a retry time", () => {
    for (let i = 0; i < 3; i++) assert.equal(rateLimit("k", opts, 1000).ok, true);
    const blocked = rateLimit("k", opts, 1200);
    assert.equal(blocked.ok, false);
    assert.equal(blocked.retryAfterSeconds, 1);
  });

  it("starts a new window after windowMs", () => {
    for (let i = 0; i < 4; i++) rateLimit("k", opts, 1000);
    assert.equal(rateLimit("k", opts, 2001).ok, true);
  });

  it("keeps keys independent", () => {
    for (let i = 0; i < 4; i++) rateLimit("a", opts, 1000);
    assert.equal(rateLimit("b", opts, 1000).ok, true);
  });

  it("bounds memory and sweeps expired keys", () => {
    for (let i = 0; i < 12_000; i++) rateLimit(`k${i}`, { limit: 1, windowMs: 60_000 }, 5000);
    assert.ok(trackedKeys() <= 10_000);
    rateLimit("later", opts, 5000 + 120_000);
    assert.equal(trackedKeys(), 1);
  });
});

describe("clientKey", () => {
  it("hashes the IP and never contains it raw", () => {
    const key = clientKey(req({ "x-real-ip": "203.0.113.9" }), "voice");
    assert.match(key, /^voice:[0-9a-f]{32}$/);
    assert.ok(!key.includes("203.0.113.9"));
    assert.notEqual(key, clientKey(req({ "x-real-ip": "203.0.113.10" }), "voice"));
  });

  it("prefers x-real-ip, so a client-supplied x-forwarded-for cannot change the key", () => {
    const a = clientKey(req({ "x-real-ip": "203.0.113.9", "x-forwarded-for": "1.1.1.1" }), "voice");
    const b = clientKey(req({ "x-real-ip": "203.0.113.9", "x-forwarded-for": "2.2.2.2, 203.0.113.9" }), "voice");
    assert.equal(a, b);
    assert.equal(a, clientKey(req({ "x-real-ip": "203.0.113.9" }), "voice"));
  });

  it("uses the LAST x-forwarded-for hop (added by our proxy), never the spoofable first one", () => {
    const key = clientKey(req({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" }));
    assert.equal(key, clientKey(req({ "x-forwarded-for": "203.0.113.9" })));
    assert.equal(key, clientKey(req({ "x-forwarded-for": "7.7.7.7, 203.0.113.9" })));
    assert.notEqual(key, clientKey(req({ "x-forwarded-for": "6.6.6.6" })));
  });

  it("falls back to x-vercel-forwarded-for, then a constant", () => {
    assert.equal(clientKey(req({ "x-vercel-forwarded-for": "1.2.3.4" })), clientKey(req({ "x-real-ip": "1.2.3.4" })));
    assert.equal(clientKey(req({ "x-forwarded-for": "1.2.3.4" })), clientKey(req({ "x-real-ip": "1.2.3.4" })));
    assert.equal(clientKey(req()), clientKey(req()));
  });
});

describe("limitRequest", () => {
  beforeEach(resetRateLimits);
  it("returns null then a 429 with Retry-After", async () => {
    const r = req({ "x-forwarded-for": "9.9.9.9" });
    for (let i = 0; i < 3; i++) assert.equal(limitRequest(r, "t", opts), null);
    const res = limitRequest(r, "t", opts);
    assert.equal(res?.status, 429);
    assert.ok(Number(res?.headers.get("retry-after")) >= 1);
  });
});
