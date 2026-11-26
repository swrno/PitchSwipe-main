// Run: node --import ./scripts/register-ts.mjs --test src/lib/results/results.test.ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { aggregateSwipes, toSwipeRows, type ResponseInput } from "./aggregate";
import { demoDeckData } from "./demo";
import { buildVerdict, csvCell, waitlistCsv } from "./leaderboard";
import { buildResultsPayload, type PayloadInput } from "./payload";
import { rollUp } from "./segments";
import type { DeckMeta } from "./types";

const NOW = new Date("2026-11-15T12:00:00+05:30");

const META: DeckMeta = {
  id: "voice-khata-headline",
  productId: "voice-khata",
  productName: "Voice Khata",
  label: "Headline test",
  variable: "headline",
  noun: "headline",
  flagName: "deck_voice-khata-headline",
  status: "live",
  statusLabel: "Live",
};

function demoPayload(id = "voice-khata-headline", meta: Partial<DeckMeta> = {}) {
  const d = demoDeckData(id, NOW)!;
  const input: PayloadInput = {
    demo: true,
    deck: { ...META, id, ...meta },
    cards: d.cards,
    controlKey: d.controlKey,
    aggregates: d.aggregates,
    flagsmith: d.flagsmith,
    claimants: d.claimants,
    reward: d.reward,
    targetRoles: d.targetRoles,
    now: NOW,
  };
  return buildResultsPayload(input);
}

describe("only counted swipes count", () => {
  const base: ResponseInput = {
    cardKey: "A",
    source: "feed",
    isTargetUser: false,
    answer: "positive",
    interests: [],
    joined: false,
    valid: true,
    counted: true,
  };
  it("drops uncounted and invalid swipes", () => {
    const rows = toSwipeRows([base, { ...base, counted: false }, { ...base, valid: false }, { ...base, answer: "negative" }]);
    assert.equal(rows.length, 2);
    assert.equal(rows.filter((r) => r.saidYes).length, 1);
  });
});

describe("groups under 10 swipers roll into Other", () => {
  const g = (key: string, swipers: number, joined = 0) => ({ key, label: key, swipers, saidYes: swipers, joined });
  it("hides small groups and merges them", () => {
    const r = rollUp([g("A", 41), g("B", 9), g("C", 4), g("D", 20)]);
    assert.deepEqual(r.shown.map((x) => x.key), ["A", "D"]);
    assert.equal(r.hidden?.swipers, 13);
    assert.equal(r.hiddenVisible, true);
  });
  it("a hidden total under 10 pulls in the smallest shown group so it cannot be subtracted out", () => {
    const r = rollUp([g("A", 41), g("B", 9), g("C", 12)]);
    assert.deepEqual(r.shown.map((x) => x.key), ["A"]);
    assert.equal(r.hidden?.swipers, 21);
    assert.equal(r.hiddenVisible, true);
  });
  it("overlapping groups (interests) are not complemented", () => {
    const r = rollUp([g("A", 41), g("B", 9)], 10, false);
    assert.equal(r.shown.length, 1);
    assert.equal(r.hiddenVisible, false);
  });
  it("aggregateSwipes splits by role, source, state and interest", () => {
    const mk = (over: Partial<ResponseInput>): ResponseInput => ({
      cardKey: "A", source: "feed", isTargetUser: true, answer: "positive", interests: ["Retail"], joined: false, valid: true, counted: true, region: "Gujarat", ...over,
    });
    const rows = toSwipeRows([mk({}), mk({ joined: true }), mk({ source: "link", isTargetUser: false, cardKey: "B", interests: ["Retail", "Finance"] })]);
    const agg = aggregateSwipes(rows, ["A", "B"]);
    assert.deepEqual(agg.total, { swipers: 3, saidYes: 3, joined: 1 });
    assert.equal(agg.byCard.target.A.swipers, 2);
    assert.equal(agg.byCard.link.B.swipers, 1);
    assert.equal(agg.location[0].swipers, 3);
    assert.equal(agg.interests.find((i) => i.key === "Finance")?.swipers, 1);
  });
});

describe("headline demo (spec/08 section 13.2)", () => {
  const p = demoPayload();

  it("leaderboard order and numbers", () => {
    const rows = p.leaderboard.everyone;
    assert.deepEqual(rows.map((r) => r.label), ["Headline B", "Headline A", "Headline C"]);
    assert.deepEqual(rows.map((r) => (r.claimRate! * 100).toFixed(1)), ["18.3", "11.1", "7.0"]);
    assert.deepEqual([rows[0].swipers, rows[0].saidYes, rows[0].joined], [71, 38, 13]);
    assert.equal(Math.round(rows[0].chanceBest! * 100), 91);
  });

  it("verdict comes from the Flagsmith decision: leading at 91%, not a Result", () => {
    assert.equal(p.verdict.headline, "Headline B is in the lead.");
    assert.equal(p.verdict.pill, "Leading, not decided yet");
    assert.equal(p.verdict.kind, "leading");
  });

  it("totals", () => {
    assert.deepEqual([p.totals.swipers, p.totals.saidYes, p.totals.joined], [214, 98, 26]);
    assert.equal(p.totals.saidYesPct, 46);
    assert.equal(p.totals.joinedPct, 12);
    assert.equal(p.totals.targetSharePct, 33);
    assert.deepEqual([p.totals.feed, p.totals.link], [160, 54]);
  });

  it("said yes vs acted headline", () => {
    assert.equal(p.whoSwiped.saidYesVsActed.headline, "34 points said yes but did not act.");
  });

  it("location: states under 10 are hidden as Other, Gujarat leads, Lead line", () => {
    const l = p.whoSwiped.location;
    assert.deepEqual(l.rows.map((r) => r.label), ["Gujarat", "Maharashtra", "West Bengal", "Delhi", "Uttar Pradesh"]);
    assert.equal(l.other?.swipers, 24);
    assert.equal(l.shown.swipers, 190);
    assert.equal(l.insight?.title, "Gujarat joins the most");
    assert.match(l.insight!.body, /9 of 41 joined \(22%\), almost double the 12% overall/);
    assert.equal(l.insight!.lead, "Lead: 1 of 6 state groups, 41 swipers. Confirm with a test in Gujarat.");
    assert.match(l.hiddenNote!, /24 swipers/);
    assert.ok(l.tiles.some((t) => t.state === "Gujarat" && t.best));
  });

  it("target users: 23% vs 7%, 3x", () => {
    const t = p.whoSwiped.target;
    assert.equal(t.enough, true);
    assert.equal(t.insight?.title, "Your target users want it 3x more");
    assert.match(t.insight!.body, /23% of target users joined the waitlist vs 7% of others/);
    assert.match(t.insight!.body, /Among target users, Headline B leads \(29%\)/);
    assert.equal(t.insight!.lead, "Lead: 71 vs 143 swipers. Confirm with a target-users-only test.");
    assert.match(t.total.text, /71 \+ 143 = 214 swipers/);
  });

  it("source: both sources pick B and it agrees with the full experiment", () => {
    const s = p.whoSwiped.source;
    assert.deepEqual(s.rows.map((r) => r.label), ["Swipe feed", "Your link"]);
    assert.equal(s.insight?.title, "Both sources pick Headline B");
    assert.match(s.insight!.lead, /^Agrees with the full experiment/);
    assert.equal(s.totalText, "160 feed + 54 link = 214 · 14 + 12 = 26 joined");
    assert.equal(s.cards.find((c) => c.key === "B")?.link?.rate, 6 / 18);
  });

  it("interests: Finance first at 17%, overlap tiles", () => {
    const i = p.whoSwiped.interests;
    assert.deepEqual(i.rows.map((r) => r.label), ["Finance", "Retail", "Logistics", "Fashion", "Food"]);
    assert.deepEqual(i.tiles.map((t) => t.value), ["71%", "38%"]);
    assert.equal(i.insight?.title, "Finance-minded swipers join the most");
    assert.equal(i.insight!.lead, "Lead: 1 of 5 interest groups, 58 swipers. Confirm with a Finance-only test.");
  });

  it("segment filters follow the 10-swiper rule, the full experiment does not", () => {
    const d = demoDeckData("voice-khata-headline", NOW)!;
    d.aggregates.byCard.link.C = { swipers: 4, saidYes: 2, joined: 1 };
    const q = buildResultsPayload({ demo: true, deck: META, cards: d.cards, controlKey: "A", aggregates: d.aggregates, flagsmith: d.flagsmith, claimants: d.claimants, reward: d.reward, targetRoles: d.targetRoles, now: NOW });
    const c = q.leaderboard.link.find((r) => r.key === "C")!;
    assert.equal(c.suppressed, true);
    assert.equal(c.swipers, null);
    assert.equal(c.claimRate, null);
    assert.equal(q.leaderboard.link.at(-1)?.key, "C");
    assert.equal(q.leaderboard.everyone.find((r) => r.key === "C")?.suppressed, false);
  });

  it("waitlist: 26 claimants, preview of four, labelled by card", () => {
    assert.equal(p.waitlist.count, 26);
    assert.equal(p.waitlist.moreCount, 22);
    assert.deepEqual(p.waitlist.preview.map((c) => [c.email, c.cardLabel, c.when]), [
      ["priya.n@example.com", "Headline B", "Today"],
      ["rakesh.traders@example.com", "Headline A", "Today"],
      ["sana.k@example.com", "Headline B", "Yesterday"],
      ["mohan.store@example.com", "Headline C", "Yesterday"],
    ]);
  });

  it("payload holds aggregates only: no emails outside the waitlist preview", () => {
    const json = JSON.stringify({ ...p, waitlist: undefined });
    assert.doesNotMatch(json, /@/);
  });
});

describe("verdict labels come only from the Flagsmith decision", () => {
  const cards = [
    { key: "A", label: "Headline A", valueText: "" },
    { key: "B", label: "Headline B", valueText: "" },
  ];
  const res = (b: number, ids = 60, srm = false) => ({
    experimentId: "e",
    flagName: "f",
    srmWarning: srm,
    refreshedAt: NOW,
    cards: [
      { cardId: "a", variantKey: "A", identities: ids, chanceToBeatControl: 0 },
      { cardId: "b", variantKey: "B", identities: ids, chanceToBeatControl: b },
    ],
  });
  it("Winner only at 95% with 50+ identities and no SRM", () => {
    assert.equal(buildVerdict(cards, "A", res(0.96)).kind, "decided");
    assert.equal(buildVerdict(cards, "A", res(0.96)).headline, "Headline B wins.");
    assert.equal(buildVerdict(cards, "A", res(0.96, 49)).kind, "collecting");
    assert.equal(buildVerdict(cards, "A", res(0.96, 60, true)).kind, "leading");
    assert.equal(buildVerdict(cards, "A", res(0.94)).kind, "leading");
    assert.equal(buildVerdict(cards, "A", res(0.6)).kind, "too_close");
    assert.equal(buildVerdict(cards, "A", null).kind, "none");
  });
});

describe("price demo", () => {
  it("find-the-best-price deck feeds the demand curve: Rs 199 earns the most, a Lead", () => {
    const p = demoPayload("voice-khata-price", { variable: "price", priceMode: "level", label: "Price test" });
    assert.ok(p.priceCurve);
    assert.equal(p.priceCurve.headline, "Rs 199 earns the most.");
    assert.equal(p.priceCurve.verdict, "lead");
    assert.equal(p.priceCurve.rows.find((r) => r.isBest)?.chancePct, 88); // the design's printed value, pinned in demo (the code computes 89)
    assert.equal(p.priceCurve.moreSwipersPerPrice, 40);
    assert.equal(p.totals.swipers, 480);
  });
  it("framing decks have no curve", () => {
    const p = demoPayload("voice-khata-price", { variable: "price", priceMode: "framing" });
    assert.equal(p.priceCurve, null);
  });
});

describe("waitlist CSV", () => {
  it("escapes quotes and formula cells", () => {
    assert.equal(csvCell('a"b'), '"a""b"');
    assert.equal(csvCell("=HYPERLINK(1)"), "'=HYPERLINK(1)");
    assert.equal(csvCell("x,y"), '"x,y"');
  });
  it("lists only email, card and time", () => {
    const csv = waitlistCsv([{ email: "a@example.com", cardKey: "B", createdAt: new Date("2026-11-15T00:00:00Z") }], [{ key: "B", label: "Headline B", valueText: "" }]);
    assert.equal(csv, "email,card,claimed_at\r\na@example.com,Headline B,2026-11-15T00:00:00.000Z\r\n");
  });
});

describe("deck switcher text and card labels", () => {
  it("matches designs 22 and 24", async () => {
    const { switcherStatusText, cardMetas, deckTitle } = await import("./cards");
    assert.equal(switcherStatusText({ status: "live", chance: 0.91 }, true), "Live · 91% chance best".replace("Live", "Leading"));
    assert.equal(switcherStatusText({ status: "decided", chance: 0.95, shippedAt: new Date() }, false), "Won · 95% sure");
    assert.equal(switcherStatusText({ status: "live", chance: 0.88 }, false), "Leading · 88% sure");
    assert.equal(switcherStatusText({ status: "live" }, false), "Live");
    assert.equal(deckTitle("reward"), "Launch reward test");
    assert.equal(deckTitle("productUI"), "Product UI test");
    const m = cardMetas("price", "level", [{ variantKey: "A", value: "Rs 99 / mo" }]);
    assert.equal(m[0].label, "Rs 99 / mo");
    assert.equal(cardMetas("headline", undefined, [{ variantKey: "B", value: "Hi" }])[0].label, "Headline B");
  });
});
