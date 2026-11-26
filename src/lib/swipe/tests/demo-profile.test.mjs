// Run: node --import ./scripts/register-ts.mjs --test src/lib/swipe/tests/demo-profile.test.mjs
// The demo-only `?demo=notcounted` switch for the swipe feed (see ../demo-profile.ts).
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEMO_PROFILE_COOKIE, demoNotCounted, demoProfileCookie, demoProfileFromSearch } from "../demo-profile.ts";

describe("demo profile query and cookie", () => {
  it("reads only the two known values from ?demo=", () => {
    assert.equal(demoProfileFromSearch("?demo=notcounted"), "notcounted");
    assert.equal(demoProfileFromSearch("?x=1&demo=counting"), "counting");
    assert.equal(demoProfileFromSearch("?demo=1"), null);
    assert.equal(demoProfileFromSearch("?demo=NOTCOUNTED"), null);
    assert.equal(demoProfileFromSearch(""), null);
  });

  it("the cookie round-trips: set then read, cleared by 'counting'", () => {
    const set = demoProfileCookie("notcounted");
    assert.match(set, new RegExp(`^${DEMO_PROFILE_COOKIE}=notcounted; path=/; max-age=3600`));
    assert.equal(demoNotCounted(set.split(";")[0]), true);
    assert.equal(demoNotCounted(`a=b; ${DEMO_PROFILE_COOKIE}=notcounted; c=d`), true);
    const cleared = demoProfileCookie("counting");
    assert.match(cleared, /max-age=0/);
    assert.equal(demoNotCounted(cleared.split(";")[0]), false);
  });

  it("is false for no cookie, other cookies and look-alike names", () => {
    assert.equal(demoNotCounted(null), false);
    assert.equal(demoNotCounted(undefined), false);
    assert.equal(demoNotCounted("a=b"), false);
    assert.equal(demoNotCounted(`x${DEMO_PROFILE_COOKIE}=notcounted`), false);
    assert.equal(demoNotCounted(`${DEMO_PROFILE_COOKIE}=notcounted2`), false);
  });
});
