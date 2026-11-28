// The quality check on/off switch (src/features/quality/server/switch.ts).
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { qualityCheckEnabled, swiperCounts } from "../switch.ts";

describe("quality check switch", () => {
  it("is off unless NEXT_PUBLIC_QUALITY_CHECK says on", () => {
    assert.equal(qualityCheckEnabled(undefined), false);
    assert.equal(qualityCheckEnabled(""), false);
    assert.equal(qualityCheckEnabled("off"), false);
    assert.equal(qualityCheckEnabled("on"), true);
    assert.equal(qualityCheckEnabled(" ON "), true);
    assert.equal(qualityCheckEnabled("1"), true);
    assert.equal(qualityCheckEnabled("true"), true);
  });

  it("off: every signed-in swiper counts, whatever is stored", () => {
    assert.equal(swiperCounts(undefined, false), true);
    assert.equal(swiperCounts(false, false), true);
  });

  it("on: only a passed check counts", () => {
    assert.equal(swiperCounts(undefined, true), false);
    assert.equal(swiperCounts(false, true), false);
    assert.equal(swiperCounts(true, true), true);
  });
});
