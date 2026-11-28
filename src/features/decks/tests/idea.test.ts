// Run: npm test -- decks-ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { INDUSTRIES, ROLES } from "@/shared/lib/lists";
import { checkIdeaText, cleanDraft, guessIndustry, hasInventedDigit, looksLikeNewProduct, parseLenientDraft, templateDraft } from "../idea";

const source = "A voice ledger for kirana shop owners. Record every sale by speaking, in Hindi. Free for 3 months.";

describe("hasInventedDigit", () => {
  it("allows digits the founder wrote and flags new ones", () => {
    assert.equal(hasInventedDigit("Free for 3 months", source), false);
    assert.equal(hasInventedDigit("Only Rs 99 a month", source), true);
    assert.equal(hasInventedDigit("Free for ३ months", source), false);
  });
});

describe("cleanDraft", () => {
  it("drops fields with invented digits and falls back on bad enums", () => {
    const d = cleanDraft({ name: "Voice Ledger", industry: "Nope", audience: "Shop owner", headline: "Save 40% time", description: "Speak your sales.", reward: "3 months free" }, source);
    assert.equal(d.headline, "");
    assert.equal(d.description, "Speak your sales.");
    assert.equal(d.reward, "3 months free");
    assert.ok((INDUSTRIES as readonly string[]).includes(d.industry));
    assert.ok((ROLES as readonly string[]).includes(d.audience));
  });
});

describe("templateDraft", () => {
  it("splits first sentence and rest, leaves reward empty, guesses lists", () => {
    const d = templateDraft(source);
    assert.equal(d.headline, "A voice ledger for kirana shop owners");
    assert.equal(d.description, "Record every sale by speaking, in Hindi. Free for 3 months.");
    assert.equal(d.reward, "");
    assert.equal(d.audience, "Shop owner");
    assert.equal(guessIndustry("an app for clinic patients"), "Healthcare");
  });
});

describe("checkIdeaText", () => {
  it("enforces 20 to 1000 characters", () => {
    assert.equal(checkIdeaText("short").ok, false);
    assert.equal(checkIdeaText("x".repeat(1001)).ok, false);
    assert.equal(checkIdeaText("  " + "x".repeat(25)).ok, true);
  });
});

describe("parseLenientDraft", () => {
  const gpu = "A white-label cloud for GPU data centers with renting and billing. Hosts inference.";
  it("reads valid JSON", () => {
    const d = parseLenientDraft('{"name":"GPU Cloud","industry":"SaaS","audience":"Business owner","headline":"Rent GPUs","description":"Billing and metering.","reward":""}', gpu);
    assert.equal(d?.name, "GPU Cloud");
    assert.equal(d?.industry, "SaaS");
    assert.equal(d?.audience, "Business owner");
  });
  it("finds JSON inside prose and fences", () => {
    const d = parseLenientDraft('Sure!\n```json\n{"name":"X Cloud","industry":"SaaS","audience":"Other","headline":"H","description":"D","reward":""}\n```', gpu);
    assert.equal(d?.name, "X Cloud");
  });
  it("guesses a bad enum for that field only", () => {
    const d = parseLenientDraft('{"name":"Kitchen App","industry":"Cloud","audience":"Nope","headline":"H","description":"D","reward":""}', "An app for restaurant kitchen owners. Recipes.");
    assert.equal(d?.industry, "Food");
    assert.equal(d?.name, "Kitchen App");
    assert.equal(d?.headline, "H");
  });
  it("fills missing fields from the template", () => {
    const d = parseLenientDraft('{"name":"G"}', gpu);
    assert.equal(d?.headline, "A white-label cloud for GPU data centers with renting and billing");
    assert.equal(d?.description, "Hosts inference.");
    assert.equal(parseLenientDraft("no json", gpu), null);
  });
});

describe("looksLikeNewProduct", () => {
  it("defaults to new when name and industry differ, current when the same", () => {
    assert.equal(looksLikeNewProduct({ name: "GPU Cloud", industry: "SaaS" }, { name: "Mess Menu Daily", industry: "Food" }), true);
    assert.equal(looksLikeNewProduct({ name: "Mess Menu Daily", industry: "Food" }, { name: "Mess Menu Daily", industry: "Food" }), false);
    assert.equal(looksLikeNewProduct({ name: "", industry: "Food" }, { name: "Mess Menu Daily", industry: "Food" }), false);
  });
});
