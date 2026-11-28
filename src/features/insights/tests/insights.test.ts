// Run: npm test -- insights
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ai } from "@/shared/lib/ai";

import { buildInsights, personaCard, winnerRows, type BuildInput } from "../build";
import { insightsProvider } from "../server/provider";
import type { DeckFacts } from "../types";

const base = {
  productId: "voice-khata",
  productName: "Voice Khata",
  productIcon: "V",
  accent: "green",
  anchorDeckId: "voice-khata-headline",
} as const;

/** No LLM key: the provider answers with nothing, so code writes every word. */
const noKeyProvider = () => insightsProvider({});
const providerWith = (wording: (r: { user: string }) => string) =>
  ai.createMockProvider({ responses: { product_insights: wording, swipe_themes: () => '{"themes":[]}' } });
const templateOnly = () => providerWith(() => "{}");


const two = (leader: number): DeckFacts["cards"] => [
  { id: "A", chancePct: 100 - leader, identities: 60 },
  { id: "B", chancePct: leader, identities: 60 },
];

const live = (i: number, over: Partial<DeckFacts> = {}): DeckFacts => ({
  id: `d-${i}`,
  index: i,
  label: `Deck ${i}`,
  noun: "price",
  variable: "price",
  status: "live",
  finished: false,
  swipers: 100,
  saidYes: 40,
  joined: 10,
  waitlist: 10,
  comments: 0,
  leaderText: `Card ${i}`,
  leaderChancePct: 80,
  cards: two(80),
  srmWarning: false,
  targetSwipers: 20 + i,
  topState: { label: `State ${i}`, swipers: 30 + i, joined: 9 },
  ...over,
});

const won = (i: number, over: Partial<DeckFacts> = {}): DeckFacts =>
  live(i, { finished: true, status: "decided", leaderChancePct: 97, targetSwipers: null, topState: null, cards: two(97), ...over });

/** Four decks of one product: three finished with a winner, one still running. */
const sampleDecks = (): DeckFacts[] => [
  won(1, { variable: "headline", noun: "headline", label: "Headline", leaderChancePct: 96, cards: two(96), swipers: 214, saidYes: 98, joined: 26, waitlist: 26 }),
  won(2, { variable: "productUI", noun: "product screens", label: "Product UI", leaderChancePct: 95, cards: two(95), swipers: 224, saidYes: 100, joined: 11, waitlist: 11 }),
  live(3, { leaderChancePct: 88, cards: two(88), swipers: 480, saidYes: 203, joined: 76, waitlist: 76, targetSwipers: 83, topState: null }),
  won(4, { variable: "reward", noun: "reward", label: "Launch reward", leaderChancePct: 97, cards: two(97), swipers: 120, saidYes: 54, joined: 5, waitlist: 5 }),
];

const build = (over: Partial<BuildInput> = {}) => buildInsights({ ...base, decks: sampleDecks(), provider: noKeyProvider(), ...over });

describe("winners so far", () => {
  const rows = winnerRows(sampleDecks());
  it("labels Won and Leading from the Flagsmith rules", () => {
    assert.deepEqual(
      rows.map((r) => r.statusText),
      ["Won · 96% sure", "Won · 95% sure", "Leading · 88% sure", "Won · 97% sure"],
    );
  });
  it("a running deck is never Won, even at 99%", () => {
    const [r] = winnerRows([live(1, { leaderChancePct: 99, cards: two(99) })]);
    assert.equal(r.tone, "leading");
  });
  it("a finished deck with a sample-ratio warning or under 50 identities is not Won", () => {
    assert.equal(winnerRows([won(1, { srmWarning: true })])[0].tone, "muted");
    assert.equal(winnerRows([won(1, { cards: [{ id: "A", chancePct: 3, identities: 49 }, { id: "B", chancePct: 97, identities: 60 }] })])[0].tone, "muted");
    assert.equal(winnerRows([won(1)])[0].tone, "won");
  });
  it("no Flagsmith data reads as collecting", () => {
    assert.equal(winnerRows([live(1, { cards: [], leaderChancePct: null })])[0].statusText, "Collecting data");
  });
});

describe("page", () => {
  it("totals come from code: swipes summed, waitlist, 3 of 4 winners, said yes vs acted", async () => {
    const p = await build();
    assert.equal(p.swipers, 214 + 224 + 480 + 120);
    assert.equal(p.swipersAreDistinct, false);
    assert.equal((await build({ distinctSwipers: 612 })).swipers, 612);
    assert.equal(p.waitlist, 26 + 11 + 76 + 5);
    assert.equal(p.winnerCount, 3);
    assert.equal(p.deckCount, 4);
    assert.match(p.saidYesVsActed?.headline ?? "", /^\d+ points said yes but did not act\.$/);
  });
  it("shows one Result and one Lead with source lines, filled by code", async () => {
    const wording = (r: { user: string }) => {
      const user = JSON.parse(r.user) as { kind?: string; facts?: { key: string }[] };
      return user.kind === "result" ? JSON.stringify({ title: "Winners talk about getting paid.", text: "Each winner was tested on its own." }) : "{}";
    };
    const p = await build({ provider: providerWith(wording) });
    const result = p.insights.find((i) => i.tag === "Result");
    const lead = p.insights.find((i) => i.tag === "Lead");
    assert.ok(result && lead);
    assert.equal(result.title, "Winners talk about getting paid.");
    assert.equal(result.worded, "model");
    assert.match(result.sourceLine, /^Tests 1, 2 and 4 · 558 swipers · Flagsmith: 96%, 95% and 97% chance best/);
    assert.equal(lead.tagLabel, "Lead · confirm with a test");
    assert.equal(lead.worded, "template");
    assert.match(lead.sourceLine, /^Test 3, still running · 83 target users · Flagsmith: 88%, not decided/);
  });
  it("persona card is Simulated and Unproven and adds nothing to the counts or insights", async () => {
    const persona = { personasPerCard: 20, totalPersonas: 60, picks: [{ key: "B", count: 9 }, { key: "A", count: 7 }, { key: "C", count: 4 }], right: 1, finished: 3 };
    const without = await build({ persona: null });
    const withP = await build({ persona });
    assert.equal(withP.persona?.tags.join(","), "Simulated,Unproven");
    assert.match(withP.persona?.trackRecord ?? "", /Right in 1 of 3 finished tests/);
    assert.equal(withP.swipers, without.swipers);
    assert.deepEqual(withP.insights, without.insights);
    assert.equal(without.persona, null);
    assert.equal(personaCard(persona).tags.length, 2);
  });
  it("themes: the model groups ids, code counts them", async () => {
    const comments = [
      "Getting paid on time is the whole problem.",
      "I spend evenings calling people for money.",
      "It is not clear what you get.",
      "Sounds like another app.",
    ].map((text, i) => ({ id: `c${i}`, text }));
    const provider = ai.createMockProvider({
      responses: {
        product_insights: () => "{}",
        swipe_themes: () =>
          JSON.stringify({
            themes: [
              { label: "Getting paid on time is the pain", commentIds: ["c0", "c1"] },
              { label: "Not clear what you get", commentIds: ["c2"] },
              { label: "Already have a way", commentIds: ["c3"] },
            ],
          }),
      },
    });
    const p = await build({ provider, commentSets: [{ deckId: "d-1", deckLabel: "Headline", comments }] });
    assert.equal(p.themes.length, 1);
    assert.deepEqual(
      p.themes[0].themes.map((t) => [t.label, t.count, t.countText]),
      [
        ["Getting paid on time is the pain", 2, "2 of 4 comments"],
        ["Not clear what you get", 1, "1 of 4 comments"],
        ["Already have a way", 1, "1 of 4 comments"],
      ],
    );
  });
  it("themes: labels with digits or unknown ids are dropped", async () => {
    const provider = ai.createMockProvider({
      responses: {
        product_insights: () => "{}",
        swipe_themes: () =>
          JSON.stringify({
            themes: [
              { label: "90% hate it", commentIds: ["c0", "c1"] },
              { label: "Ghost theme", commentIds: ["zzz"] },
              { label: "Wants clarity", commentIds: ["c0", "c0", "nope"] },
            ],
          }),
      },
    });
    const comments = ["a", "b", "c"].map((text, i) => ({ id: `c${i}`, text }));
    const p = await build({ provider, commentSets: [{ deckId: "x", deckLabel: "Headline", comments }] });
    assert.deepEqual(p.themes[0].themes.map((t) => [t.label, t.count]), [["Wants clarity", 1]]);
  });
});

describe("post-check and fallback", () => {
  const allTemplate = (p: { insights: { worded: string }[] }) => {
    assert.ok(p.insights.length > 0);
    assert.ok(p.insights.every((i) => i.worded === "template"));
  };
  it("a typed figure in the model's text falls back to code's template", async () => {
    const p = await build({ provider: providerWith(() => JSON.stringify({ title: "Price wins", text: "Rs 199 has an 88% chance." })) });
    allTemplate(p);
    assert.ok(p.insights.every((i) => !i.body.includes("has an 88% chance")));
  });
  it("a figure in the title falls back too", async () => {
    allTemplate(await build({ provider: providerWith(() => JSON.stringify({ title: "88% sure", text: "Fine words." })) }));
  });
  it("an unknown placeholder falls back", async () => {
    allTemplate(await build({ provider: providerWith(() => JSON.stringify({ title: "Hi", text: "Joined {made.up.key} times." })) }));
  });
  it("claiming winners were tested together falls back", async () => {
    const p = await build({ provider: providerWith(() => JSON.stringify({ title: "Winning combination", text: "The winners work well together." })) });
    allTemplate(p);
    assert.ok(p.insights.every((i) => !/combination|work well together/i.test(`${i.title} ${i.body}`)));
  });
  it("a model error or non-JSON reply falls back, and the page still renders", async () => {
    allTemplate(
      await build({
        provider: providerWith(() => {
          throw new Error("rate limited");
        }),
      }),
    );
    allTemplate(await build({ provider: providerWith(() => "not json") }));
  });
  it("persona wording from the model is refused", async () => {
    allTemplate(await build({ provider: providerWith(() => JSON.stringify({ title: "AI says so", text: "The persona preview agrees." })) }));
  });
  it("template Result cites the rule threshold from the table, not typed digits", async () => {
    const p = await build({ provider: templateOnly() });
    assert.equal(
      p.insights.find((i) => i.tag === "Result")?.body,
      "3 tests reached a clear winner, at 95% or more chance of being best. Each was tested on its own, so the winners were not tested against each other.",
    );
  });
  it("without an LLM key the provider answers with nothing, so code writes the words", async () => {
    const p = await build();
    assert.ok(p.insights.length > 0);
    assert.ok(p.insights.every((i) => i.worded === "template"));
    assert.equal(p.themes.length, 0);
  });
});

describe("limits and tagging", () => {
  it("shows at most two Leads, the largest groups first, and says so", async () => {
    const decks = [1, 2, 3, 4].map((i) => live(i, { targetSwipers: 10 * i + 5, topState: { label: `State ${i}`, swipers: 12 + i, joined: 4 } }));
    const p = await build({ decks, provider: templateOnly() });
    const leads = p.insights.filter((i) => i.tag === "Lead");
    assert.equal(leads.length, 2);
    assert.deepEqual(leads.map((l) => l.sourceLine.match(/(\d+) (?:target users|swipers)/)?.[1]), ["45", "35"]);
    assert.ok(p.notes.some((n) => /2 largest Leads/.test(n)));
  });
  it("hides groups under 10 swipers", async () => {
    const p = await build({ decks: [live(1, { targetSwipers: 9, topState: { label: "Goa", swipers: 9, joined: 5 } })], provider: templateOnly() });
    assert.equal(p.insights.length, 0);
  });
  it("shows a group of exactly 10", async () => {
    const p = await build({ decks: [live(1, { targetSwipers: 10, topState: null })], provider: templateOnly() });
    assert.equal(p.insights.length, 1);
  });
  it("every segment insight is a Lead tagged confirm with a test; one finished deck is not a Result", async () => {
    const p = await build({ decks: [won(1), live(2)], provider: templateOnly() });
    assert.ok(p.insights.length > 0);
    for (const i of p.insights) {
      assert.equal(i.tag, "Lead");
      assert.match(i.tagLabel, /confirm with a test/);
    }
  });
  it("a Result needs two finished decks that pass the rules", async () => {
    const ok = await build({ decks: [won(1), won(2)], provider: templateOnly() });
    assert.equal(ok.insights.filter((i) => i.tag === "Result").length, 1);
    const srm = await build({ decks: [won(1), won(2, { srmWarning: true })], provider: templateOnly() });
    assert.equal(srm.insights.length, 0);
  });
  it("no decks: an empty, safe page", async () => {
    const p = await build({ decks: [], provider: templateOnly() });
    assert.equal(p.deckCount, 0);
    assert.equal(p.saidYesVsActed, null);
    assert.equal(p.insights.length, 0);
  });
  it("suggests an untested variable and only links to the New deck screen", async () => {
    const p = await build();
    assert.equal(p.suggestion?.variable, "description");
    assert.equal(p.suggestion?.href, "/decks/new?product=voice-khata");
  });
});
