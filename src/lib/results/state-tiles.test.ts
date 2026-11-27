// Run: node --import ./scripts/register-ts.mjs --test src/lib/results/state-tiles.test.ts
// The state tile map on the results screen, and the demo price text pinned to the design values.
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PRICE_TEST_ARMS, PRICE_TEST_DESIGN_VALUES } from "@/fixtures";
import { shapeDemandCurve } from "@/lib/demand-curve/shape";
import { STATES } from "@/lib/lists";

import { pinDemoPriceCurve } from "./payload";
import { STATE_TILES, rateBucket } from "./state-tiles";

describe("STATE_TILES", () => {
  it("every tile names a state from the standard list", () => {
    for (const tile of STATE_TILES) assert.ok((STATES as readonly string[]).includes(tile.state), tile.state);
  });

  it("no two tiles share a state, an abbreviation or a grid cell", () => {
    const unique = (xs: string[]) => new Set(xs).size === xs.length;
    assert.ok(unique(STATE_TILES.map((t) => t.state)));
    assert.ok(unique(STATE_TILES.map((t) => t.abbr)));
    assert.ok(unique(STATE_TILES.map((t) => `${t.row},${t.col}`)));
  });

  it("abbreviations are two capital letters and cells sit on the 7 x 8 grid", () => {
    for (const t of STATE_TILES) {
      assert.match(t.abbr, /^[A-Z]{2}$/);
      assert.ok(t.row >= 0 && t.row <= 6 && t.col >= 0 && t.col <= 7, `${t.abbr} at ${t.row},${t.col}`);
    }
  });
});

describe("rateBucket (legend: under 10%, 10-14%, 15-19%, 20% or more)", () => {
  it("puts each band edge in the right bucket", () => {
    const cases: [number, number][] = [
      [0, 0],
      [0.094, 0],
      [0.1, 1],
      [0.144, 1],
      [0.15, 2],
      [0.194, 2],
      [0.2, 3],
      [1, 3],
    ];
    for (const [rate, bucket] of cases) assert.equal(rateBucket(rate), bucket, String(rate));
  });

  it("rounds to a whole percent first, like the label next to it", () => {
    assert.equal(rateBucket(0.095), 1, "9.5% shows as 10%, so it is in the 10-14% band");
    assert.equal(rateBucket(0.1949), 2, "19.49% shows as 19%");
  });
});

describe("pinDemoPriceCurve", () => {
  const curve = shapeDemandCurve({ arms: PRICE_TEST_ARMS, seed: 1 });
  const pinned = pinDemoPriceCurve(curve);

  it("pins the chances and the swiper count to the design's values", () => {
    for (const row of pinned.rows) assert.equal(row.chancePct, PRICE_TEST_DESIGN_VALUES.chancePctByPrice[row.price]);
    assert.equal(pinned.chanceBadge, "88% chance · not decided yet");
  });

  it("rewrites the 'About N more swipers' sentence to the pinned number", () => {
    assert.match(curve.leadText ?? "", /About \d+ more swipers/, "the computed text has the sentence");
    assert.match(pinned.leadText ?? "", new RegExp(`About ${PRICE_TEST_DESIGN_VALUES.moreSwipersPerPrice} more swipers`));
    assert.equal(pinned.moreSwipersPerPrice, PRICE_TEST_DESIGN_VALUES.moreSwipersPerPrice);
  });

  it("leaves a curve with other prices alone", () => {
    const other = shapeDemandCurve({ arms: PRICE_TEST_ARMS.map((a) => ({ ...a, price: a.price + 1 })), seed: 1 });
    assert.equal(pinDemoPriceCurve(other), other);
  });
});
