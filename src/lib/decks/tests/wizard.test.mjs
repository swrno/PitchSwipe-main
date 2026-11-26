// New deck form: switching what you test must never drop what the founder already wrote.
import test from "node:test";
import assert from "node:assert/strict";
import { emptyForm, fromDeckRecord, switchVariable, toDeckInput } from "../wizard.ts";

const withVersions = (form, versions) => ({ ...form, versions });

test("headline versions survive a switch to a price test as the locked headline", () => {
  let f = withVersions(emptyForm("p1", "headline"), ["Stop chasing payments.", "Your ledger, by voice.", ""]);
  f = switchVariable(f, "price");
  assert.equal(f.variable, "price");
  assert.equal(f.headline, "Stop chasing payments.");
  const input = toDeckInput(f);
  assert.equal(input.shared.headline, "Stop chasing payments.", "the saved draft keeps the headline");
});

test("price versions survive a switch to a headline test as the locked price", () => {
  let f = withVersions(emptyForm("p1", "price"), ["Rs 199", "Rs 299", "Rs 399"]);
  f = switchVariable(f, "headline");
  assert.equal(f.price, "Rs 199");
  assert.equal(toDeckInput(f).shared.price, "Rs 199");
});

test("a locked value the founder typed is never overwritten by a version", () => {
  let f = { ...emptyForm("p1", "headline"), versions: ["A headline", "B headline"] };
  f = switchVariable(f, "price");
  f = { ...f, headline: "My own locked headline" };
  f = switchVariable(f, "headline");
  f = switchVariable(f, "price");
  assert.equal(f.headline, "My own locked headline");
});

test("switching back restores the versions written earlier in the session", () => {
  let f = withVersions(emptyForm("p1", "headline"), ["H1", "H2", "H3"]);
  f = switchVariable(f, "price");
  f = { ...f, priceMode: "level", versions: ["Rs 25", "Rs 35"] };
  f = switchVariable(f, "headline");
  assert.deepEqual(f.versions, ["H1", "H2", "H3"]);
  f = switchVariable(f, "price");
  assert.deepEqual(f.versions, ["Rs 25", "Rs 35"]);
  assert.equal(f.priceMode, "level");
});

test("a fresh test starts from the locked value as version A", () => {
  let f = { ...emptyForm("p1", "headline"), versions: ["H1", "H2", "H3"], price: "Rs 299 / mo" };
  f = switchVariable(f, "price");
  assert.equal(f.versions[0], "Rs 299 / mo");
  assert.equal(f.versions.length, 3);
});

test("the stash is never sent to the API", () => {
  let f = withVersions(emptyForm("p1", "headline"), ["H1", "H2"]);
  f = switchVariable(f, "price");
  assert.equal("stash" in toDeckInput(f), false);
});

test("a reopened draft keeps the locked headline that came from a switch", () => {
  let f = withVersions(emptyForm("p1", "headline"), ["Stop chasing payments.", "B"]);
  f = switchVariable(f, "price");
  f = { ...f, versions: ["Rs 25", "Rs 35"] };
  const input = toDeckInput(f);
  const reopened = fromDeckRecord({ _id: "d1", status: "draft", ...input, cards: input.cards });
  assert.equal(reopened.headline, "Stop chasing payments.");
  assert.deepEqual(reopened.versions, ["Rs 25", "Rs 35"]);
});

test("leaving a language test keeps the English card as the locked text", () => {
  let f = emptyForm("p1", "language");
  f = {
    ...f,
    versions: [
      { language: "English", headline: "Speak your sales.", description: "Voice ledger.", reward: "3 months free", question: "", positiveLabel: "", negativeLabel: "" },
      { language: "Hindi", headline: "", description: "", reward: "", question: "", positiveLabel: "", negativeLabel: "" },
    ],
  };
  f = switchVariable(f, "price");
  assert.equal(f.headline, "Speak your sales.");
  assert.equal(f.description, "Voice ledger.");
  assert.equal(f.reward, "3 months free");
});
