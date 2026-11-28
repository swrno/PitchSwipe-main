// Run: npm test -- results
// The state tile map on the results screen.
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { STATES } from "@/shared/lib/lists";

import { STATE_TILES, rateBucket } from "../state-tiles";

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
