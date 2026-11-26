// Run: node --import ./scripts/register-ts.mjs --test src/lib/quality/tests/
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CHECK_CARDS,
  NORMAL_CARDS,
  QUALITY,
  REPEAT_GAP,
  analyseStraightLining,
  buildDeck,
  deckShape,
  evaluateSwipes,
  getLibraryCard,
  isCounting,
  prepareSubmission,
  toPublicCard,
} from "../index.ts";

const sw = (cardId, answer, dwellMs = 3000, expected) => ({ cardId, answer, dwellMs, expected });

/** 20 clean first-showing swipes alternating yes/no, nothing fast. */
const clean = (n = 20) => Array.from({ length: n }, (_, i) => sw(`n${i}`, i % 2 ? "yes" : "no"));

// Seeded rng so deck tests are deterministic.
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe("thresholds", () => {
  it("fixes the spec numbers", () => {
    assert.equal(QUALITY.minReadMs, 2000);
    assert.equal(QUALITY.countingScore, 70);
    assert.equal(QUALITY.practiceCards, 30);
    assert.equal(QUALITY.recheckCards, 20);
    assert.equal(QUALITY.checkCards.initial, 3);
  });
  it("counts at exactly 70, not at 69", () => {
    assert.equal(isCounting(70), true);
    assert.equal(isCounting(69), false);
    assert.equal(isCounting(100), true);
  });
});

describe("reading time", () => {
  it("1999 ms is fast, 2000 ms is not", () => {
    const r = evaluateSwipes([sw("a", "yes", 1999), sw("b", "no", 2000)]);
    assert.equal(r.metrics.fastCount, 1);
    assert.equal(r.metrics.readPct, 50);
  });
  it("all fast loses the full 100 points", () => {
    const r = evaluateSwipes(clean().map((s) => ({ ...s, dwellMs: 500 })));
    assert.equal(r.score, 0);
    assert.equal(r.counting, false);
    assert.match(r.reasons[0], /^Too fast: under 2 seconds, 20 of 20 cards$/);
  });
  it("9 of 30 too fast alone still counts (score 70)", () => {
    const swipes = clean(30).map((s, i) => (i < 9 ? { ...s, dwellMs: 800 } : s));
    const r = evaluateSwipes(swipes);
    assert.equal(r.score, 70);
    assert.equal(r.counting, true);
  });
  it("a clean run scores 100", () => {
    const r = evaluateSwipes(clean());
    assert.equal(r.score, 100);
    assert.deepEqual(r.reasons, []);
  });
});

describe("straight-lining", () => {
  it("flags >= 90% one answer over >= 10 swipes", () => {
    const a = Array(9).fill("yes").concat(["no"]);
    assert.equal(analyseStraightLining(a).flagged, true);
    const b = ["yes", "yes", "yes", "yes", "yes", "yes", "no", "yes", "yes", "no", "no"].slice(0, 10).map((x, i) => (i === 5 ? "no" : x)); // 8 of 10 yes, longest run 3
    assert.equal(analyseStraightLining(b).flagged, false);
  });
  it("flags a run of >= 60% even when the share is lower", () => {
    const a = [...Array(12).fill("yes"), ...["no", "yes", "no", "yes", "no", "yes", "no", "no"]];
    assert.equal(a.length, 20);
    assert.equal(analyseStraightLining(a).flagged, true);
  });
  it("does not judge fewer than 10 swipes", () => {
    assert.equal(analyseStraightLining(Array(9).fill("yes")).flagged, false);
  });
  it("costs 40 points and says so", () => {
    const swipes = clean(20).map((s) => ({ ...s, answer: "yes" }));
    const r = evaluateSwipes(swipes);
    assert.equal(r.score, 60);
    assert.equal(r.counting, false);
    assert.ok(r.reasons.includes("Always the same answer"));
  });
  it("yes and no are treated the same", () => {
    const yes = evaluateSwipes(clean(20).map((s) => ({ ...s, answer: "yes" })));
    const no = evaluateSwipes(clean(20).map((s) => ({ ...s, answer: "no" })));
    assert.equal(yes.score, no.score);
  });
  it("ignores check cards when judging runs", () => {
    const normals = clean(20);
    const checks = [sw("c1", "no", 3000, "no"), sw("c2", "yes", 3000, "yes")];
    assert.equal(evaluateSwipes([...normals, ...checks]).metrics.straight.analysed, 20);
  });
});

describe("repeat cards", () => {
  it("same answer on a repeat is consistent", () => {
    const r = evaluateSwipes([...clean(10), sw("n0", "no")]);
    assert.equal(r.metrics.repeats.total, 1);
    assert.equal(r.metrics.repeats.differing, 0);
    assert.equal(r.metrics.repeats.samePct, 100);
  });
  it("a different answer costs 40 points per fully inconsistent set", () => {
    const base = clean(10);
    const repeats = [sw("n0", "yes"), sw("n1", "no")]; // both flip (n0 was no, n1 was yes)
    const r = evaluateSwipes([...base, ...repeats]);
    assert.equal(r.metrics.repeats.differing, 2);
    assert.equal(r.score, 60);
    assert.ok(r.reasons.includes("Different answers on a repeated card: 2 of 2"));
  });
  it("2 of 3 differing is 27 points off", () => {
    const base = clean(10);
    const r = evaluateSwipes([...base, sw("n0", "yes"), sw("n1", "no"), sw("n2", "no")]);
    assert.equal(r.metrics.repeats.differing, 2);
    assert.equal(r.score, 73); // 100 - round(40 * 2/3)
  });
  it("no repeats means the rule is not applied", () => {
    assert.equal(evaluateSwipes(clean(10)).metrics.repeats.samePct, null);
  });
});

describe("check cards", () => {
  it("missing 1 of 3 loses about 17 points", () => {
    const swipes = [
      ...clean(10),
      sw("c1", "no", 3000, "no"),
      sw("c2", "yes", 3000, "yes"),
      sw("c3", "yes", 3000, "no"),
    ];
    const r = evaluateSwipes(swipes);
    assert.equal(r.metrics.checks.missed, 1);
    assert.equal(r.score, 83);
    assert.ok(r.reasons.includes("Check cards missed: 1 of 3"));
  });
  it("missing every check card loses 50 points", () => {
    const swipes = [...clean(10), sw("c1", "yes", 3000, "no"), sw("c2", "no", 3000, "yes")];
    assert.equal(evaluateSwipes(swipes).score, 50);
  });
});

describe("combined", () => {
  it("rules stack and clamp at 0", () => {
    const swipes = [
      ...Array.from({ length: 12 }, (_, i) => sw(`n${i}`, "yes", 100)),
      sw("n0", "no", 100),
      sw("c1", "yes", 100, "no"),
    ];
    const r = evaluateSwipes(swipes);
    assert.equal(r.score, 0);
    assert.equal(r.counting, false);
  });
  it("empty input scores 0", () => {
    assert.equal(evaluateSwipes([]).score, 0);
  });
  it("is deterministic and ignores order of reasons", () => {
    const swipes = clean(12);
    assert.deepEqual(evaluateSwipes(swipes), evaluateSwipes(swipes));
  });
});

describe("deck", () => {
  for (const mode of ["initial", "recheck"]) {
    it(`${mode}: right size, check cards and repeats`, () => {
      for (let seed = 1; seed <= 25; seed += 1) {
        const ids = buildDeck(mode, rng(seed));
        const shape = deckShape(mode);
        assert.equal(ids.length, shape.size);
        assert.equal(ids.filter((id) => id.startsWith("c-")).length, shape.checks);
        const counts = new Map();
        ids.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));
        const repeated = [...counts].filter(([, n]) => n === 2);
        assert.equal(repeated.length, shape.repeats);
        assert.ok([...counts.values()].every((n) => n <= 2));
        for (const [id] of repeated) {
          const first = ids.indexOf(id);
          const second = ids.lastIndexOf(id);
          assert.ok(second - first >= REPEAT_GAP, `gap for ${id}`);
          assert.ok(!id.startsWith("c-"));
        }
      }
    });
  }
  it("library is big enough for both decks", () => {
    assert.ok(NORMAL_CARDS.length >= 24);
    assert.ok(CHECK_CARDS.length >= 3);
  });
  it("public cards never leak the answer key", () => {
    for (const c of CHECK_CARDS) assert.equal("expected" in toPublicCard(c), false);
  });
});

describe("server-side submission check", () => {
  const swipesFor = (mode, rngSeed = 7, answer = (i) => (i % 2 ? "yes" : "no")) =>
    buildDeck(mode, rng(rngSeed)).map((cardId, i) => ({ cardId, answer: answer(i), dwellMs: 3000 }));

  it("accepts an issued deck and attaches the answer key", () => {
    const res = prepareSubmission("initial", swipesFor("initial"));
    assert.equal(res.ok, true);
    assert.equal(res.swipes.filter((s) => s.expected).length, 3);
    for (const s of res.swipes.filter((x) => x.expected)) assert.equal(s.expected, getLibraryCard(s.cardId).expected);
  });
  it("rejects wrong length, unknown cards, bad answers, duplicates", () => {
    assert.equal(prepareSubmission("initial", swipesFor("recheck")).ok, false);
    assert.equal(prepareSubmission("initial", "nope").ok, false);
    const unknown = swipesFor("recheck");
    unknown[0] = { ...unknown[0], cardId: "zzz" };
    assert.equal(prepareSubmission("recheck", unknown).ok, false);
    const bad = swipesFor("recheck");
    bad[1] = { ...bad[1], answer: "maybe" };
    assert.equal(prepareSubmission("recheck", bad).ok, false);
    const dup = swipesFor("recheck");
    const first = dup.find((s) => !s.cardId.startsWith("c-"));
    dup[dup.length - 1] = { ...first };
    dup[dup.length - 2] = { ...first };
    assert.equal(prepareSubmission("recheck", dup).ok, false);
  });
  it("rejects a set with no check cards", () => {
    const ids = NORMAL_CARDS.slice(0, 20).map((c) => ({ cardId: c.id, answer: "yes", dwellMs: 3000 }));
    assert.equal(prepareSubmission("recheck", ids).ok, false);
  });
  it("clamps absurd reading times", () => {
    const body = swipesFor("recheck").map((s) => ({ ...s, dwellMs: 9e9 }));
    const res = prepareSubmission("recheck", body);
    assert.equal(res.ok, true);
    assert.ok(res.swipes.every((s) => s.dwellMs <= 120000));
  });
  it("end to end: careful run counts, rushed run does not", () => {
    const careful = prepareSubmission("initial", swipesFor("initial"));
    // answer check cards correctly
    const fixed = careful.swipes.map((s) => (s.expected ? { ...s, answer: s.expected } : s));
    assert.equal(evaluateSwipes(fixed).counting, true);
    const rushed = fixed.map((s) => ({ ...s, dwellMs: 400 }));
    assert.equal(evaluateSwipes(rushed).counting, false);
  });
});
