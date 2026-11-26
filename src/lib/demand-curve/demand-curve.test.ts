// Run: node --import ./scripts/register-ts.mjs --test src/lib/demand-curve/demand-curve.test.ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { betaCdf, betaQuantile, createRng } from "./beta";
import { armStats, chanceEarnsMost, classifyDemand, type PriceArm } from "./compute";
import { shapeDemandCurve } from "./shape";

/** spec/02 5.13 and spec/08: Voice Khata price test, 120 swipers per price. */
const DEMO: PriceArm[] = [
  { key: "p99", price: 99, swipers: 120, saidYes: 71, joined: 29 },
  { key: "p199", price: 199, swipers: 120, saidYes: 64, joined: 29 },
  { key: "p299", price: 299, swipers: 120, saidYes: 43, joined: 13 },
  { key: "p399", price: 399, swipers: 120, saidYes: 25, joined: 5 },
];

// Spec table: [joined %, low %, high %, revenue, rev low, rev high, chance %].
const SPEC = [
  [24, 18, 31, 2392, 1826, 3088, 0],
  [24, 18, 31, 4809, 3666, 6210, 88],
  [11, 7, 17, 3239, 2131, 4942, 11],
  [4, 2, 9, 1662, 876, 3390, 1],
];

/*
 * Tolerances (why they are not zero):
 * - Point revenue is price x joined / swipers, exact: 1 Rs allowed only for rounding of exact halves.
 * - Joined % (point) must match exactly; its range ends are whole percents of exact Beta quantiles and
 *   match within 1 point (the 399 upper end is 8.49% exact, the spec prints 9%).
 * - Revenue ranges: our exact Beta(1+j, 1+n-j) quantiles differ from the spec's printed ranges by
 *   at most 6 Rs (0.7%), so the printed ranges look hand-rounded or from a slightly different
 *   quantile method. Allow 1% relative.
 * - Chance it earns most: the spec prints 88/11/1/0, a uniform-prior Monte Carlo gives about
 *   89/10/0.5/0.05. 200k draws has a standard error under 0.1 pt, so the gap is a spec rounding
 *   difference, not noise. Allow 1.5 points.
 */
describe("demo price table (spec/02 5.13)", () => {
  const stats = DEMO.map(armStats);
  const chances = chanceEarnsMost(DEMO, { seed: 7 });

  it("join rates match exactly and 90% range ends within 1 point", () => {
    stats.forEach((s, i) => {
      assert.equal(Math.round(s.joinRate * 100), SPEC[i][0]);
      assert.ok(Math.abs(s.joinRateLow * 100 - SPEC[i][1]) <= 1);
      assert.ok(Math.abs(s.joinRateHigh * 100 - SPEC[i][2]) <= 1);
    });
  });

  it("revenue per 100 swipers matches within 1 Rs", () => {
    stats.forEach((s, i) => assert.ok(Math.abs(s.revenuePer100 - SPEC[i][3]) <= 1, `row ${i}: ${s.revenuePer100}`));
  });

  it("revenue ranges match within 1%", () => {
    stats.forEach((s, i) => {
      assert.ok(Math.abs(s.revenueLow - SPEC[i][4]) / SPEC[i][4] <= 0.01, `low ${i}: ${s.revenueLow}`);
      assert.ok(Math.abs(s.revenueHigh - SPEC[i][5]) / SPEC[i][5] <= 0.01, `high ${i}: ${s.revenueHigh}`);
    });
  });

  it("chance each price earns the most is within 1.5 points", () => {
    chances.forEach((c, i) => assert.ok(Math.abs(c * 100 - SPEC[i][6]) <= 1.5, `row ${i}: ${c}`));
    assert.ok(Math.abs(chances.reduce((a, b) => a + b, 0) - 1) < 1e-9);
  });

  it("is a Lead, not a Result, at 88-89%", () => {
    const { verdict, bestIndex } = classifyDemand(DEMO, chances, false);
    assert.equal(verdict, "lead");
    assert.equal(DEMO[bestIndex].price, 199);
  });
});

describe("determinism and maths", () => {
  it("same seed gives identical chances; default draws are 200k", () => {
    assert.deepEqual(chanceEarnsMost(DEMO, { seed: 3 }), chanceEarnsMost(DEMO, { seed: 3 }));
    assert.deepEqual(chanceEarnsMost(DEMO), chanceEarnsMost(DEMO));
  });

  it("rng is uniform in [0,1)", () => {
    const r = createRng(1);
    for (let i = 0; i < 1000; i++) {
      const x = r();
      assert.ok(x >= 0 && x < 1);
    }
  });

  it("beta quantile inverts the cdf and Beta(1,1) is uniform", () => {
    assert.ok(Math.abs(betaQuantile(0.3, 1, 1) - 0.3) < 1e-9);
    const q = betaQuantile(0.95, 30, 92);
    assert.ok(Math.abs(betaCdf(q, 30, 92) - 0.95) < 1e-9);
  });

  it("an empty arm does not break", () => {
    const s = armStats({ key: "x", price: 99, swipers: 0, saidYes: 0, joined: 0 });
    assert.equal(s.joinRate, 0);
    assert.equal(s.revenuePer100, 0);
  });
});

describe("Result vs Lead (95%, 50 identities, no SRM)", () => {
  const dominant: PriceArm[] = [
    { key: "a", price: 100, swipers: 400, saidYes: 200, joined: 160 },
    { key: "b", price: 200, swipers: 400, saidYes: 100, joined: 20 },
  ];
  const chances = chanceEarnsMost(dominant, { seed: 1, draws: 20000 });

  it("is a Result when clear", () => {
    assert.equal(classifyDemand(dominant, chances, false).verdict, "result");
  });
  it("is a Lead with an SRM warning", () => {
    assert.equal(classifyDemand(dominant, chances, true).verdict, "lead");
  });
  it("is a Lead when any price has fewer than 50 identities", () => {
    const small = [dominant[0], { ...dominant[1], swipers: 40, joined: 4, saidYes: 10 }];
    assert.equal(classifyDemand(small, [0.99, 0.01], false).verdict, "lead");
  });
});

describe("shapeDemandCurve", () => {
  const data = shapeDemandCurve({ arms: [...DEMO].reverse(), unitLabel: "/ mo", seed: 7 });

  it("orders by price and gives the table the design shows", () => {
    assert.deepEqual(data.rows.map((r) => r.priceLabel), ["Rs 99 / mo", "Rs 199 / mo", "Rs 299 / mo", "Rs 399 / mo"]);
    assert.equal(data.rows[0].revenueText.startsWith("Rs 2,392 ("), true);
    assert.equal(data.rows[1].revenueText.startsWith("Rs 4,809 ("), true);
    assert.equal(data.rows[3].revenue, 1662);
    assert.equal(data.rows[0].joinedText, "24% (18–31%)");
    assert.equal(data.rows[2].joinedOfText, "13 of 120 joined");
    assert.equal(data.rows[1].isBest, true);
  });

  it("gives headline, badge and totals", () => {
    assert.equal(data.headline, "Rs 199 earns the most.");
    assert.match(data.chanceBadge, /^\d+% chance · not decided yet$/);
    assert.equal(data.verdict, "lead");
    assert.deepEqual(
      [data.totals.swipers, data.totals.saidYes, data.totals.saidYesPct, data.totals.joined, data.totals.joinedPct],
      [480, 203, 42, 76, 16],
    );
    assert.equal(data.totals.perPriceSwipers, 120);
  });

  it("gives both charts", () => {
    assert.equal(data.lineChart.yMax, 0.3);
    assert.deepEqual(data.lineChart.ticks, [0, 0.1, 0.2, 0.3]);
    assert.equal(data.lineChart.points.length, 4);
    assert.equal(data.lineChart.points[1].isBest, true);
    assert.equal(data.barChart.bars[1].valueText, "Rs 4,809");
    assert.equal(data.barChart.yMax, data.barChart.bars[1].value);
  });

  it("writes the lead text from code with the real numbers", () => {
    assert.ok(data.leadText?.startsWith("Rs 99 gets no more sign-ups than Rs 199. Both 24%"));
    assert.ok(data.leadText?.includes("Above Rs 199, sign-ups halve."));
    assert.ok(data.moreSwipersPerPrice === null || data.moreSwipersPerPrice > 0);
  });
});

describe("no sign-ups at any price", () => {
  // Live screen, 26 Nov 2026: "Rs 25 gets no more sign-ups than Rs 35. Both 0%, so Rs 35 earns about 1.4x as much."
  const data = shapeDemandCurve({
    arms: [
      { key: "A", price: 25, swipers: 3, saidYes: 1, joined: 0 },
      { key: "B", price: 35, swipers: 4, saidYes: 0, joined: 0 },
    ],
    seed: 1,
  });

  it("names no price as earning the most", () => {
    assert.equal(data.bestKey, null);
    assert.equal(data.headline, "Not enough data yet.");
    assert.ok(data.rows.every((r) => !r.isBest));
    assert.equal(data.bestTileValue, "–");
  });

  it("says plainly that nobody has joined, with no revenue ratio", () => {
    assert.equal(data.leadText, "No sign-ups at any price yet. Until someone joins, no price earns more than another.");
    assert.doesNotMatch(data.leadText ?? "", /as much|twice/);
    assert.equal(data.chanceBadge, "No sign-ups yet · not decided yet");
  });
});

describe("a 0% tie below a price that has sign-ups", () => {
  it("is not called a tie", () => {
    const data = shapeDemandCurve({
      arms: [
        { key: "A", price: 25, swipers: 40, saidYes: 10, joined: 0 },
        { key: "B", price: 35, swipers: 40, saidYes: 12, joined: 4 },
      ],
      seed: 1,
    });
    assert.doesNotMatch(data.leadText ?? "", /gets no more sign-ups/);
  });
});
