// Run: npm test -- export
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { columnLetter, toSheet } from "../sheet";

describe("columnLetter", () => {
  it("counts like a spreadsheet", () => {
    assert.deepEqual([0, 1, 25, 26, 27, 51, 52, 701, 702].map(columnLetter), ["A", "B", "Z", "AA", "AB", "AZ", "BA", "ZZ", "AAA"]);
  });
});

describe("toSheet", () => {
  it("handles quotes, escaped quotes, commas and newlines inside quotes", () => {
    const s = toSheet('a,b\r\n"x, y","He said ""hi"""\r\n"line1\nline2",z\r\n');
    assert.deepEqual(s.rows, [["a", "b"], ["x, y", 'He said "hi"'], ["line1\nline2", "z"]]);
    assert.equal(s.total, 2);
    assert.equal(s.columns, 2);
  });

  it("strips the BOM and blank lines", () => {
    const s = toSheet("﻿a,b\n\n1,2\n");
    assert.deepEqual(s.rows, [["a", "b"], ["1", "2"]]);
  });

  it("cuts to the limit but reports the real total", () => {
    const csv = ["n", ...Array.from({ length: 10 }, (_, i) => String(i))].join("\n");
    const s = toSheet(csv, 3);
    assert.equal(s.rows.length, 4);
    assert.equal(s.total, 10);
  });

  it("header-only and empty files", () => {
    assert.equal(toSheet("a,b\n").total, 0);
    assert.deepEqual(toSheet("").rows, []);
  });
});
