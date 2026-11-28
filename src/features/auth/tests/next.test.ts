// Run: npm test -- auth
// Contract C1: `?next=` may only ever point back into this site (no open redirect).
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEFAULT_NEXT, explicitNext, isSafeNext, safeNext, withNext } from "../next";

describe("isSafeNext", () => {
  it("accepts same-site paths, with query and hash", () => {
    for (const ok of ["/", "/swipe", "/decks/abc?tab=results", "/profile?complete=1&next=%2Fswipe", "/d/voice-khata#top"]) {
      assert.equal(isSafeNext(ok), true, ok);
    }
  });

  it("rejects other sites and protocol tricks", () => {
    const bad = [
      "https://evil.com",
      "http://evil.com/swipe",
      "//evil.com",
      "//evil.com/swipe",
      "/\\evil.com",
      "\\\\evil.com",
      "javascript:alert(1)",
      "data:text/html,hi",
      "swipe",
      "evil.com/swipe",
    ];
    for (const value of bad) assert.equal(isSafeNext(value), false, value);
  });

  it("rejects whitespace and control characters a browser would strip into //host", () => {
    for (const value of ["/\t/evil.com", "/\n/evil.com", "/\r/evil.com", "/ /evil.com", "/swipe\u0000", "/a\u007fb", "/a\u0085b"]) {
      assert.equal(isSafeNext(value), false, JSON.stringify(value));
    }
  });

  it("rejects anything that is not a non-empty string of sane length", () => {
    for (const value of [undefined, null, 42, {}, ["/swipe"], "", "/" + "a".repeat(2048)]) {
      assert.equal(isSafeNext(value), false, String(value));
    }
    assert.equal(isSafeNext("/" + "a".repeat(2047)), true, "2048 characters is the limit");
  });
});

describe("safeNext and explicitNext", () => {
  it("fall back when the value is not safe", () => {
    assert.equal(DEFAULT_NEXT, "/swipe");
    assert.equal(safeNext("https://evil.com"), "/swipe");
    assert.equal(safeNext(undefined, "/decks"), "/decks");
    assert.equal(explicitNext("//evil.com"), null);
    assert.equal(explicitNext(undefined), null);
  });

  it("keep a safe value as it is", () => {
    assert.equal(safeNext("/wallet"), "/wallet");
    assert.equal(explicitNext("/decks/new"), "/decks/new");
  });

  it("take the first value of a repeated query parameter", () => {
    assert.equal(safeNext(["/wallet", "https://evil.com"]), "/wallet");
    assert.equal(safeNext(["https://evil.com", "/wallet"]), "/swipe");
    assert.equal(explicitNext(["/profile"]), "/profile");
  });
});

describe("withNext", () => {
  it("adds next as an encoded query parameter", () => {
    assert.equal(withNext("/login", "/decks/new?x=1"), "/login?next=%2Fdecks%2Fnew%3Fx%3D1");
  });

  it("uses & when the path already has a query", () => {
    assert.equal(withNext("/profile?complete=1", "/swipe"), "/profile?complete=1&next=%2Fswipe");
  });

  it("leaves the path alone without a next", () => {
    assert.equal(withNext("/login", null), "/login");
    assert.equal(withNext("/login", undefined), "/login");
    assert.equal(withNext("/login", ""), "/login");
  });

  it("round-trips: the encoded next decodes back to a safe value", () => {
    const url = new URL(withNext("/login", "/decks/abc?tab=results"), "https://pitchswipe.invalid");
    assert.equal(safeNext(url.searchParams.get("next")), "/decks/abc?tab=results");
  });
});
