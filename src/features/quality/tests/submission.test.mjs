// Practice round: the deck the server issues and how a submitted run is checked (src/features/quality/deck.ts, submission.ts).
// Run: npm test -- quality
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { CHECK_CARDS, NORMAL_CARDS, getLibraryCard } from "../cards.ts";
import { REPEAT_GAP, buildDeck, deckShape, parseMode } from "../deck.ts";
import { MAX_DWELL_MS, prepareSubmission } from "../submission.ts";

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const isCheck = (id) => Boolean(getLibraryCard(id)?.expected);
const run = (ids, answer = "yes", dwellMs = 3000) => ids.map((cardId) => ({ cardId, answer, dwellMs }));

describe("buildDeck", () => {
  for (const mode of ["initial", "recheck"]) {
    it(`${mode}: right size, check cards and repeats, over many seeds`, () => {
      const shape = deckShape(mode);
      for (let seed = 1; seed <= 50; seed++) {
        const deck = buildDeck(mode, seeded(seed));
        assert.equal(deck.length, shape.size);
        assert.equal(deck.filter(isCheck).length, shape.checks, "check cards");
        const counts = new Map();
        for (const id of deck) counts.set(id, (counts.get(id) ?? 0) + 1);
        const repeated = [...counts].filter(([, n]) => n === 2).map(([id]) => id);
        assert.equal(repeated.length, shape.repeats, "repeats");
        assert.ok([...counts.values()].every((n) => n <= 2), "no card three times");
        for (const id of repeated) {
          assert.equal(isCheck(id), false, "a check card is never repeated");
          const first = deck.indexOf(id);
          const second = deck.indexOf(id, first + 1);
          assert.ok(second - first >= REPEAT_GAP, `repeat of ${id} comes at least ${REPEAT_GAP} cards later`);
        }
      }
    });
  }

  it("is random across seeds", () => {
    const firsts = new Set(Array.from({ length: 20 }, (_, i) => buildDeck("initial", seeded(i + 1)).join(",")));
    assert.ok(firsts.size > 1);
  });

  it("only uses cards from the library", () => {
    const deck = buildDeck("initial", seeded(9));
    const known = new Set([...NORMAL_CARDS, ...CHECK_CARDS].map((c) => c.id));
    assert.ok(deck.every((id) => known.has(id)));
  });

  it("parseMode defaults to the initial round", () => {
    assert.equal(parseMode("recheck"), "recheck");
    assert.equal(parseMode("initial"), "initial");
    assert.equal(parseMode("anything"), "initial");
    assert.equal(parseMode(undefined), "initial");
  });
});

describe("prepareSubmission", () => {
  const issued = buildDeck("initial", seeded(4));

  it("accepts the run that was issued and attaches the answer key to check cards only", () => {
    const res = prepareSubmission("initial", run(issued));
    assert.equal(res.ok, true);
    assert.equal(res.swipes.length, issued.length);
    for (const s of res.swipes) {
      assert.equal(s.expected, getLibraryCard(s.cardId).expected);
    }
    assert.equal(res.swipes.filter((s) => s.expected).length, deckShape("initial").checks);
  });

  it("rounds reading times and clamps a tab left open", () => {
    const body = run(issued);
    body[0].dwellMs = 2500.6;
    body[1].dwellMs = 40 * 60_000;
    const res = prepareSubmission("initial", body);
    assert.equal(res.swipes[0].dwellMs, 2501);
    assert.equal(res.swipes[1].dwellMs, MAX_DWELL_MS);
  });

  it("rejects a body that is not a list, or the wrong length", () => {
    assert.deepEqual(prepareSubmission("initial", { swipes: [] }), { ok: false, error: "Send the list of swipes." });
    assert.equal(prepareSubmission("initial", run(issued.slice(1))).ok, false);
    assert.match(prepareSubmission("recheck", run(issued)).error, /Expected \d+ swipes/);
  });

  it("rejects malformed swipes", () => {
    const bad = (patch) => {
      const body = run(issued);
      body[3] = { ...body[3], ...patch };
      return prepareSubmission("initial", body);
    };
    assert.match(bad({ cardId: 7 }).error, /cardId/);
    assert.match(bad({ answer: "maybe" }).error, /yes or no/);
    assert.match(bad({ dwellMs: -1 }).error, /reading time/);
    assert.match(bad({ dwellMs: Number.NaN }).error, /reading time/);
    assert.match(bad({ dwellMs: "3000" }).error, /reading time/);
    assert.match(bad({ cardId: "not-a-card" }).error, /Unknown card/);
    const nullEntry = run(issued);
    nullEntry[0] = null;
    assert.match(prepareSubmission("initial", nullEntry).error, /cardId/);
  });

  it("rejects a check card answered twice", () => {
    const body = run(issued);
    const check = issued.find(isCheck);
    const other = body.findIndex((s) => s.cardId !== check);
    body[other] = { ...body[other], cardId: check };
    assert.match(prepareSubmission("initial", body).error, /repeats too often/);
  });

  it("rejects a normal card three times", () => {
    const body = run(issued);
    const repeated = issued.find((id, i) => issued.indexOf(id) !== i);
    const slots = body.map((s, i) => i).filter((i) => body[i].cardId !== repeated && !isCheck(body[i].cardId));
    body[slots[0]] = { ...body[slots[0]], cardId: repeated };
    assert.match(prepareSubmission("initial", body).error, /repeats too often/);
  });

  it("rejects a set the server did not issue (a check card swapped for a normal card)", () => {
    const body = run(issued);
    const checkAt = body.findIndex((s) => isCheck(s.cardId));
    const unused = NORMAL_CARDS.find((c) => !issued.includes(c.id));
    body[checkAt] = { ...body[checkAt], cardId: unused.id };
    assert.deepEqual(prepareSubmission("initial", body), { ok: false, error: "That is not a practice set we issued." });
  });
});
