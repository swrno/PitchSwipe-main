import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { cellCount, inRange, move, numericSum, rangeLabel, rangeOf, selectAll, selectColumn, selectRow, single, toTsv } from "../sheet-selection";

const B = { rows: 5, cols: 3 };
const ROWS = [["email", "version", "n"], ["a@x.com", "A", "1"], ["b@x.com", "B", "2,000"], ["c\td", 'say "hi"', "x"], ["", "", ""]];

describe("sheet selection", () => {
  it("normalises a backwards drag into a range", () => {
    const r = rangeOf({ anchor: { r: 3, c: 2 }, active: { r: 1, c: 0 } });
    assert.deepEqual(r, { r0: 1, r1: 3, c0: 0, c1: 2 });
    assert.equal(cellCount(r), 9);
    assert.equal(inRange(r, 2, 1), true);
    assert.equal(inRange(r, 4, 1), false);
  });
  it("selects all, a column and a row", () => {
    assert.deepEqual(rangeOf(selectAll(B)), { r0: 0, r1: 4, c0: 0, c1: 2 });
    assert.deepEqual(rangeOf(selectColumn(1, B)), { r0: 0, r1: 4, c0: 1, c1: 1 });
    assert.deepEqual(rangeOf(selectRow(2, B)), { r0: 2, r1: 2, c0: 0, c1: 2 });
  });
  it("moves, clamps at the edges and extends from the anchor", () => {
    let s = single({ r: 0, c: 0 });
    s = move(s, "up", B, false);
    assert.deepEqual(s.active, { r: 0, c: 0 });
    s = move(s, "down", B, true);
    s = move(s, "right", B, true);
    assert.deepEqual(rangeOf(s), { r0: 0, r1: 1, c0: 0, c1: 1 });
    s = move(s, "right", B, false);
    assert.deepEqual(s, single({ r: 1, c: 2 }));
    assert.deepEqual(move(s, "right", B, false).active, { r: 1, c: 2 });
    assert.deepEqual(move(s, "home", B, false).active, { r: 1, c: 0 });
    assert.deepEqual(move(s, "end", B, false).active, { r: 1, c: 2 });
    assert.deepEqual(move(s, "pageDown", B, false, 10).active, { r: 4, c: 2 });
    assert.deepEqual(move(s, "pageUp", B, false).active, { r: 0, c: 2 });
  });
  it("labels cells and ranges like a spreadsheet", () => {
    assert.equal(rangeLabel({ r0: 1, c0: 0, r1: 4, c1: 2 }), "A2:C5");
    assert.equal(rangeLabel({ r0: 2, c0: 1, r1: 2, c1: 1 }), "B3");
  });
  it("builds tab-separated text, quoting tabs and quotes", () => {
    assert.equal(toTsv(ROWS, { r0: 1, c0: 0, r1: 2, c1: 1 }), "a@x.com\tA\nb@x.com\tB");
    assert.equal(toTsv(ROWS, { r0: 3, c0: 0, r1: 3, c1: 1 }), '"c\td"\t"say ""hi"""');
    assert.equal(toTsv(ROWS, { r0: 4, c0: 5, r1: 4, c1: 5 }), "");
  });
  it("sums numeric cells only", () => {
    assert.equal(numericSum(ROWS, { r0: 1, c0: 2, r1: 2, c1: 2 }), 2001);
    assert.equal(numericSum(ROWS, { r0: 1, c0: 0, r1: 2, c1: 1 }), null);
  });
});
