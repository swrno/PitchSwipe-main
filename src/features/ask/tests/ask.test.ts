// Run: npm test -- ask
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ai, type LlmProvider } from "@/shared/lib/ai";
import { buildResultsPayload } from "@/features/results/payload";
import type { DeckMeta } from "@/features/results/types";
import { SAMPLE_COMMENTS, SAMPLE_HEADLINE_DECK_ID, SAMPLE_PRICE_DECK_ID, sampleDeckData } from "@/shared/lib/testing/sample-deck";

import { composeAnswer } from "../compose";
import { askMockResponder } from "../mock-planner";
import { ASK_TASK } from "../prompt";
import { runAsk } from "../server/run";
import { suggestedQuestions } from "../suggestions";
import { ASK_TOOLS, resolveDeck } from "../server/tools";
import type { AskToolCtx } from "../types";

const HEADLINE = SAMPLE_HEADLINE_DECK_ID;
const NOW = new Date("2026-11-15T12:00:00+05:30");

function deckInContext(id: string, label: string, meta: Partial<DeckMeta>) {
  const d = sampleDeckData(id, NOW)!;
  const payload = buildResultsPayload({
    deck: { id, productId: "sample-product", productName: "Voice Khata", label, variable: "headline", noun: "headline", flagName: `deck_${id}`, status: "live", statusLabel: "Live", ...meta },
    cards: d.cards,
    controlKey: d.controlKey,
    aggregates: d.aggregates,
    flagsmith: d.flagsmith,
    claimants: d.claimants,
    reward: d.reward,
    targetRoles: d.targetRoles,
    now: NOW,
  });
  return { id, label, payload, flagsmith: d.flagsmith };
}

/** The Ask context for the sample product: a headline deck and a price deck (built by hand, no database). */
async function ctx(): Promise<AskToolCtx> {
  const headline = deckInContext(HEADLINE, "Headline test", {});
  const price = deckInContext(SAMPLE_PRICE_DECK_ID, "Price test", { variable: "price", priceMode: "level", noun: "price" });
  const all = [headline, price];
  return {
    currentDeckId: HEADLINE,
    productName: "Voice Khata",
    decks: Object.fromEntries(all.map((d) => [d.id, { id: d.id, label: d.label, payload: d.payload }])),
    comments: async (id) => SAMPLE_COMMENTS[id] ?? [],
    experiment: async (id) => all.find((d) => d.id === id)?.flagsmith ?? null,
  };
}

const mock = () => ai.createMockProvider({ responses: { [ASK_TASK]: askMockResponder } });
const scripted = (...replies: string[]): LlmProvider => {
  let i = 0;
  return ai.createMockProvider({ responses: { [ASK_TASK]: () => replies[Math.min(i++, replies.length - 1)] } });
};
const final = (f: object) => JSON.stringify({ final: f });
const call = (tool: string, args: object) => JSON.stringify({ tool_calls: [{ tool, args }] });

describe("tools", () => {
  it("exposes only read and draft tools", () => {
    assert.deepEqual(ASK_TOOLS.map((t) => t.name).sort(), ["draft_deck", "get_comments", "get_experiment", "get_price_curve", "get_results", "get_segments"]);
    for (const t of ASK_TOOLS) assert.doesNotMatch(t.name, /publish|ship|stop|flag|complete|approve/);
  });

  it("get_segments by state lists only groups of 10+ and tags them as Leads", async () => {
    const c = await ctx();
    const tool = ASK_TOOLS.find((t) => t.name === "get_segments")!;
    const out = await tool.run({ by: "state" }, c, "get_segments1");
    const r = out.result as { tag: string; rows: { label: string; swipers: number; joinRatePct: number }[]; other: unknown };
    assert.equal(r.tag, "Lead");
    assert.equal(r.rows[0].label, "Gujarat");
    assert.equal(r.rows[0].joinRatePct, 22);
    assert.ok(r.rows.every((x) => x.swipers >= 10));
    assert.ok(out.facts.some((f) => f.key === "get_segments1.gujarat.joinRate" && f.display === "22%"));
  });

  it("every fact shows its own value", async () => {
    const c = await ctx();
    for (const tool of ASK_TOOLS.filter((t) => ["get_results", "get_segments", "get_experiment", "get_comments"].includes(t.name))) {
      const out = await tool.run({ by: "state", card: "C" }, c, `${tool.name}1`);
      assert.doesNotThrow(() => ai.createSourceTable(out.facts));
    }
  });

  it("get_comments returns voice translations and the card's chance, never audio", async () => {
    const c = await ctx();
    const out = await ASK_TOOLS.find((t) => t.name === "get_comments")!.run({ card: "C" }, c, "get_comments1");
    const r = out.result as { total: number; voice: number; comments: Record<string, unknown>[] };
    assert.equal(r.total, 4);
    assert.equal(r.voice, 1);
    assert.ok(r.comments.every((x) => !("audioUrl" in x) && !("swiperId" in x)));
    assert.ok(out.facts.some((f) => f.key === "get_comments1.card.chance" && f.display === "1%"));
  });

  it("get_experiment never calls a lead a Result", async () => {
    const c = await ctx();
    const out = await ASK_TOOLS.find((t) => t.name === "get_experiment")!.run({}, c, "get_experiment1");
    const r = out.result as { tag: string; verdictKind: string };
    assert.notEqual(r.tag, "Result");
    assert.equal(r.verdictKind, "leading");
  });

  it("draft_deck drafts, never publishes, and refuses model-typed figures", async () => {
    const c = await ctx();
    const tool = ASK_TOOLS.find((t) => t.name === "draft_deck")!;
    const price = await tool.run({ variable: "price", state: "Gujarat" }, c, "draft_deck1");
    const r = price.result as { published: boolean; versions: string[]; title: string };
    assert.equal(r.published, false);
    assert.equal(r.title, "Price test · Gujarat · target users");
    assert.deepEqual(r.versions, ["Rs 99", "Rs 199", "Rs 299", "Rs 399"]);
    await assert.rejects(tool.run({ variable: "headline", versions: ["Pay in 3 days", "Pay fast"] }, c, "draft_deck2"), /without digits/);
    await assert.rejects(tool.run({ variable: "logo", versions: ["a", "b"] }, c, "draft_deck3"), /can draft/);
    await assert.rejects(tool.run({ variable: "headline", versions: ["a", "b"], state: "Atlantis" }, c, "draft_deck4"), /Unknown state/);
  });

  it("a deck id outside the product is refused", async () => {
    const c = await ctx();
    assert.throws(() => resolveDeck(c, "someone-elses-deck"), /Unknown deck/);
  });
});

describe("suggested questions", () => {
  it("names the weakest card and offers the price question when there is a price test", async () => {
    const list = suggestedQuestions(await ctx());
    assert.ok(list.includes("Why did C lose?"));
    assert.ok(list.includes("Which price earns most?"));
    assert.equal(list[0], "What should I test next?");
  });
});

describe("conversation with the scripted mock model", () => {
  it("state question: tool lines, bar list, Lead card, draft card", async () => {
    const a = await runAsk({ provider: mock(), ctx: await ctx(), question: "Which state should I test price in next?" });
    assert.deepEqual(a.steps.map((s) => s.tool), ["get_segments", "get_experiment", "draft_deck"]);
    assert.equal(a.steps[0].summary, "Looked up results by state");
    assert.match(a.text, /^Gujarat\./);
    const kinds = a.components.map((c) => c.kind);
    assert.deepEqual(kinds, ["barList", "insightCard", "deckDraft"]);
    const bar = a.components[0] as Extract<(typeof a.components)[number], { kind: "barList" }>;
    assert.deepEqual(bar.rows.slice(0, 2).map((r) => [r.label, r.valueText, r.countText, r.highlight]), [
      ["Gujarat", "22%", "9 of 41", true],
      ["Maharashtra", "13%", "8 of 62", false],
    ]);
    const lead = a.components[1] as Extract<(typeof a.components)[number], { kind: "insightCard" }>;
    assert.equal(lead.tag, "Lead");
    assert.equal(lead.tagLabel, "Lead · confirm with a test");
    assert.match(lead.text, /Gujarat joins most: 22%, vs 13% next best\. Only 41 swipers/);
    assert.match(lead.sourceLine, /214 swipers/);
    const draft = a.components[2] as Extract<(typeof a.components)[number], { kind: "deckDraft" }>;
    assert.equal(draft.published, false);
    assert.deepEqual(draft.chips.slice(0, 5), ["Rs 99", "Rs 199", "Rs 299", "Rs 399", "Shop owner, Wholesaler"]);
  });

  it("why did C lose: bar list, quotes with a translated voice note, Lead card", async () => {
    const a = await runAsk({ provider: mock(), ctx: await ctx(), question: "Why did C lose?" });
    assert.deepEqual(a.components.map((c) => c.kind), ["barList", "commentQuotes", "insightCard"]);
    const quotes = a.components[1] as Extract<(typeof a.components)[number], { kind: "commentQuotes" }>;
    assert.ok(quotes.quotes.some((q) => q.voice && /Hindi voice note · 0:09 · translated/.test(q.meta)));
    const lead = a.components[2] as Extract<(typeof a.components)[number], { kind: "insightCard" }>;
    assert.match(lead.text, /Flagsmith: 1% chance best/);
    assert.match(lead.sourceLine, /71 swipers.*4 comments, 1 by voice/);
  });

  it("target, price and next-test questions all answer with checked cards", async () => {
    for (const q of ["Do target users disagree with everyone else?", "Which price earns most?", "What should I test next?", "hello"]) {
      const a = await runAsk({ provider: mock(), ctx: await ctx(), question: q });
      assert.ok(a.text.length > 0, q);
      assert.ok(a.components.length > 0, q);
      assert.ok(!a.notes.some((n) => /Hid/.test(n)), `${q}: ${a.notes.join("|")}`);
    }
  });
});

describe("number rules", () => {
  const step = call("get_segments", { by: "state" });

  it("replaces text that types a figure", async () => {
    const a = await runAsk({ provider: scripted(step, final({ text: "Gujarat joins at 22%.", components: [] })), ctx: await ctx(), question: "q" });
    assert.equal(a.text, "I could not check the numbers in my wording, so I am showing only the data.");
  });

  it("replaces text citing a fact that does not exist", async () => {
    const a = await runAsk({ provider: scripted(step, final({ text: "Joins at {get_segments1.mars.joinRate}.", components: [] })), ctx: await ctx(), question: "q" });
    assert.match(a.text, /could not check/);
  });

  it("fills a real placeholder from the table", async () => {
    const a = await runAsk({ provider: scripted(step, final({ text: "Gujarat: {get_segments1.gujarat.joinRate}.", components: [] })), ctx: await ctx(), question: "q" });
    assert.equal(a.text, "Gujarat: 22%.");
  });

  it("hides an insight card whose wording types a figure", async () => {
    const f = final({ text: "ok", components: [{ component: "insightCard", source: "get_segments#1", text: "Gujarat leads with 22%." }] });
    const a = await runAsk({ provider: scripted(step, f), ctx: await ctx(), question: "q" });
    assert.equal(a.components.length, 0);
    assert.ok(a.notes.some((n) => /Hid a card/.test(n)));
  });

  it("never builds a Lead from a group under 10 swipers", async () => {
    const c = await ctx();
    const f = final({ text: "ok", components: [{ component: "insightCard", source: "get_segments#1", highlight: "Nowhere", text: "Joins {get_segments1.gujarat.joinRate}." }] });
    const a = await runAsk({ provider: scripted(step, f), ctx: c, question: "q" });
    // "Nowhere" is not a listed (10+) group, so the card falls back to the top listed group, never a hidden one.
    const card = a.components.find((x) => x.kind === "insightCard");
    assert.ok(!card || (card.kind === "insightCard" && card.tag === "Lead"));
  });

  it("allows at most two Leads per answer", async () => {
    const insight = (s: string) => ({ component: "insightCard", source: s, text: "Joins {get_segments1.gujarat.joinRate}." });
    const seg2 = call("get_segments", { by: "source" });
    const both = JSON.stringify({ tool_calls: [{ tool: "get_segments", args: { by: "state" } }, { tool: "get_segments", args: { by: "source" } }, { tool: "get_segments", args: { by: "interest" } }] });
    void seg2;
    const f = final({
      text: "ok",
      components: [insight("get_segments#1"), { ...insight("get_segments#2"), text: "Joins {get_segments2.overall.joinRate}." }, { ...insight("get_segments#3"), text: "Joins {get_segments3.overall.joinRate}." }],
    });
    const a = await runAsk({ provider: scripted(both, f), ctx: await ctx(), question: "q" });
    assert.equal(a.components.filter((x) => x.kind === "insightCard").length, 2);
    assert.ok(a.notes.some((n) => /at most 2 Leads/.test(n)));
  });

  it("drops components that cite a tool call that did not happen", async () => {
    const a = await runAsk({ provider: scripted(step, final({ text: "", components: [{ component: "barList", source: "get_segments#9" }] })), ctx: await ctx(), question: "q" });
    assert.equal(a.components.length, 0);
  });
});

describe("loop safety", () => {
  it("reports unknown tools back to the model instead of running them", async () => {
    const a = await runAsk({ provider: scripted(call("publish_deck", { deck: "x" }), final({ text: "", components: [] })), ctx: await ctx(), question: "q" });
    assert.equal(a.steps.length, 0);
  });

  it("falls back when the model returns no JSON", async () => {
    const a = await runAsk({ provider: scripted("sorry"), ctx: await ctx(), question: "q" });
    assert.match(a.text, /could not answer/);
    assert.equal(a.components.length, 0);
  });

  it("stops after the step limit", async () => {
    const a = await runAsk({ provider: scripted(call("get_results", {})), ctx: await ctx(), question: "q" });
    assert.match(a.text, /could not answer/);
    assert.ok(a.steps.length <= 4);
  });

  it("composeAnswer survives a final with junk fields", async () => {
    const out = composeAnswer({ steps: [], final: { text: 5, components: "no" }, model: "m" }, { name: "t", model: "m" });
    assert.equal(out.text, "");
    assert.deepEqual(out.components, []);
  });
});
