// Run: node --import ./scripts/register-ts.mjs --test src/lib/decks/ai-live.test.ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ai } from "@/lib/ai";
import { LANGUAGE_CARD_SYSTEM, draftLanguageVersionsLive, draftTextVersionsLive } from "./ai-live";

const product = { name: "Voice Ledger", category: "Ledger app", targetUsers: ["Shop owner"] };
const idea = { headline: "Stop chasing payments", description: "Record every sale by voice." };

const angles = (list: Record<string, string>[]) => JSON.stringify({ angles: list });

describe("draftTextVersionsLive", () => {
  it("returns the drafted headlines, in order, up to count", async () => {
    const provider = ai.createMockProvider({
      responses: {
        three_angles: angles([
          { angle: "problem", headline: "Stop chasing payments", description: "a" },
          { angle: "outcome", headline: "Get paid on time", description: "b" },
          { angle: "price", headline: "A ledger for every shop", description: "c" },
        ]),
      },
    });
    const out = await draftTextVersionsLive(provider, { variable: "headline", count: 2, product, idea });
    assert.deepEqual(out, ["Stop chasing payments", "Get paid on time"]);
    // The product and the card's current text reach the prompt; no figures are sent.
    const sent = provider.calls[0].user;
    assert.match(sent, /Voice Ledger/);
    assert.match(sent, /Record every sale by voice/);
  });

  it("drops any draft with a figure, duplicates and over-long text", async () => {
    const provider = ai.createMockProvider({
      responses: {
        three_angles: angles([
          { headline: "Save 30% on fees", description: "" },
          { headline: "Get paid on time", description: "" },
          { headline: "get paid on time", description: "" },
          { headline: "x".repeat(200), description: "" },
          { headline: "Your ledger, by voice", description: "" },
        ]),
      },
    });
    const out = await draftTextVersionsLive(provider, { variable: "headline", count: 3, product, idea });
    assert.deepEqual(out, ["Get paid on time", "Your ledger, by voice"]);
  });

  it("drafts descriptions from the same angles", async () => {
    const provider = ai.createMockProvider({
      responses: { three_angles: angles([{ headline: "h", description: "Collect dues without the phone calls." }]) },
    });
    assert.deepEqual(await draftTextVersionsLive(provider, { variable: "description", count: 3, product, idea }), [
      "Collect dues without the phone calls.",
    ]);
  });

  it("an unreadable answer gives no drafts, not an error", async () => {
    const provider = ai.createMockProvider({ responses: { three_angles: "sorry" } });
    assert.deepEqual(await draftTextVersionsLive(provider, { variable: "headline", count: 3, product, idea }), []);
  });
});

describe("draftLanguageVersionsLive", () => {
  const base = {
    headline: "Pay 0% fee on your first 5 loads",
    description: "Find a load home.",
    reward: "",
    question: "Would you try it?",
    positiveLabel: "Yes",
    negativeLabel: "No",
  };
  const card = (fields: Partial<typeof base>) => JSON.stringify({ card: { ...base, ...fields } });

  it("keeps a translation that copies every figure", async () => {
    const provider = ai.createMockProvider({
      responses: { language_card: card({ headline: "पहले 5 लोड पर 0% फीस", description: "घर का लोड पाएं।", question: "क्या आप आज़माएंगे?", positiveLabel: "हां", negativeLabel: "नहीं" }) },
    });
    const out = await draftLanguageVersionsLive(provider, base, ["English", "Hindi"]);
    assert.deepEqual(out.failed, []);
    assert.equal(out.versions.length, 2);
    assert.equal(out.versions[0].headline, base.headline);
    assert.equal(out.versions[1].language, "Hindi");
    assert.equal(out.versions[1].headline, "पहले 5 लोड पर 0% फीस");
    // An empty English field stays empty, whatever came back.
    assert.equal(out.versions[1].reward, "");
  });

  it("drops a translation that changes or drops a figure", async () => {
    const provider = ai.createMockProvider({ responses: { language_card: card({ headline: "पहले 10 लोड पर 0% फीस" }) } });
    const out = await draftLanguageVersionsLive(provider, base, ["Hindi"]);
    assert.deepEqual(out.versions, []);
    assert.equal(out.failed[0].language, "Hindi");
    assert.match(out.failed[0].reason, /figure/);
  });

  it("asks once per language, however often a language is repeated", async () => {
    const provider = ai.createMockProvider({ responses: { language_card: card({}) } });
    const out = await draftLanguageVersionsLive(provider, base, ["Hindi", "Hindi", "Hindi", "Bengali", "Bengali"]);
    assert.equal(provider.calls.length, 2);
    assert.deepEqual(out.versions.map((v) => v.language), ["Hindi", "Bengali"]);
  });

  it("drops a translation with a missing field", async () => {
    const provider = ai.createMockProvider({ responses: { language_card: card({ question: "" }) } });
    const out = await draftLanguageVersionsLive(provider, base, ["Hindi"]);
    assert.equal(out.failed.length, 1);
    assert.match(out.failed[0].reason, /question/);
  });
});

describe("card translation prompt and digits (Groq, 26 Nov 2026)", () => {
  const base = {
    headline: "Reorder stock in one tap.",
    description: "Scan what is running low.",
    reward: "Get 3 months free at launch",
    question: "Would you pay Rs 99 a month?",
    positiveLabel: "Yes",
    negativeLabel: "No",
  };

  it("does not send the no-numbers rules, which made models drop the card's own figures", async () => {
    const provider = ai.createMockProvider({
      responses: { language_card: () => JSON.stringify({ card: { ...base, reward: "লঞ্চে 3 মাস ফ্রি" } }) },
    });
    await draftLanguageVersionsLive(provider, base, ["Bengali"]);
    assert.equal(provider.calls[0].system, LANGUAGE_CARD_SYSTEM);
    assert.match(provider.calls[0].system, /Copy every number exactly/);
  });

  it("accepts a figure written in Bengali digits and stores it as 0-9", async () => {
    const provider = ai.createMockProvider({
      responses: { language_card: () => JSON.stringify({ card: { ...base, reward: "লঞ্চে ৩ মাস ফ্রি পান", question: "আপনি কি মাসে Rs ৯৯ দেবেন?" } }) },
    });
    const out = await draftLanguageVersionsLive(provider, base, ["Bengali"]);
    assert.deepEqual(out.failed, []);
    assert.equal(out.versions[0].reward, "লঞ্চে 3 মাস ফ্রি পান");
    assert.equal(out.versions[0].question, "আপনি কি মাসে Rs 99 দেবেন?");
  });

  it("still rejects a changed figure", async () => {
    const provider = ai.createMockProvider({
      responses: { language_card: () => JSON.stringify({ card: { ...base, reward: "লঞ্চে ৬ মাস ফ্রি পান" } }) },
    });
    const out = await draftLanguageVersionsLive(provider, base, ["Bengali"]);
    assert.equal(out.versions.length, 0);
    assert.match(out.failed[0].reason, /reward changed a figure/);
  });
});
