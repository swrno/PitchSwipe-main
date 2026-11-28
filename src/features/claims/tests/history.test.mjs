// Run: npm test -- history
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildHistoryPage, filterItems, groupByDay, parseCursor, summarize } from "../history.ts";
import { sampleSwipeDecks } from "../../../shared/lib/testing/sample-swipe-decks.ts";

const deck = sampleSwipeDecks()[0];
const row = (i, extra = {}) => ({
  responseId: `r${i}`,
  deckId: deck.id,
  cardId: deck.cards[0].id,
  answer: i % 2 ? "yes" : "no",
  valid: true,
  counted: true,
  createdAt: new Date(Date.UTC(2026, 10, 20, 12, 0, 0) - i * 60_000),
  ...extra,
});

describe("history", () => {
  it("maps rows, earnings and claim status, and pages with the extra row", () => {
    const rows = [row(1), row(2), row(3)];
    const entries = new Map([["r1", { responseId: "r1", amountRs: 0.25, note: "valid" }]]);
    const page = buildHistoryPage(rows, new Map([[deck.id, deck]]), entries, new Set([deck.id]), 2);
    assert.equal(page.items.length, 2);
    assert.equal(page.nextCursor, String(rows[1].createdAt.getTime()));
    assert.equal(page.items[0].earnedRs, 0.25);
    assert.equal(page.items[0].paid, true);
    assert.equal(page.items[0].answer, "yes");
    assert.equal(page.items[0].product, deck.product.name);
    assert.equal(page.items[1].earnedRs, 0);
    assert.equal(page.items[1].claimed, true);
    assert.equal(Object.hasOwn(page.items[0], "swiperKey"), false);
  });

  it("has no next cursor on the last page and tolerates a missing deck", () => {
    const page = buildHistoryPage([row(1)], new Map(), new Map(), new Set(), 50);
    assert.equal(page.nextCursor, null);
    assert.equal(page.items[0].product, "Removed product");
  });

  it("parses cursors", () => {
    assert.equal(parseCursor(null), null);
    assert.equal(parseCursor("abc"), "invalid");
    assert.equal(parseCursor("1000").getTime(), 1000);
  });

  it("summarizes, filters and groups by day", () => {
    const now = Date.UTC(2026, 10, 21, 12, 0, 0);
    const page = buildHistoryPage([row(1), row(2), row(3, { createdAt: new Date(now - 86_400_000) })], new Map([[deck.id, deck]]), new Map(), new Set(), 50);
    assert.deepEqual(summarize(page.items), { total: 3, yes: 2, earnedRs: 0 });
    assert.equal(filterItems(page.items, "no").length, 1);
    assert.equal(filterItems(page.items, "claimed").length, 0);
    const labels = groupByDay(page.items, now).map((g) => g.label);
    assert.equal(labels[0], "Yesterday");
  });
});
