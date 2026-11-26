// Run: node --import ./scripts/register-ts.mjs --test scripts/seed/seed.test.mjs
// No database: documents are validated against the Mongoose models with validateSync().
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { register } from "node:module";

import { MODEL_ORDER, SEED, cards, claims, collectionFor, decks, oid, responses, wallets } from "./seed-data.mjs";

// src/models imports `models` by name from mongoose, which Node's ESM interop does not expose.
register("./mongoose-hooks.mjs", import.meta.url);
const models = await import("../../src/models/index.ts");

const SEED_SCRIPT = fileURLToPath(new URL("./seed.mjs", import.meta.url));

describe("seed data validates against the models", () => {
  for (const name of MODEL_ORDER) {
    it(`${name}: every document is valid`, () => {
      const Model = models[name];
      assert.ok(Model, `model ${name} exists`);
      assert.equal(Model.collection.name, collectionFor(name));
      for (const doc of SEED[name]) {
        const error = new Model(doc).validateSync();
        assert.equal(error, undefined, `${name} ${doc._id}: ${error?.message}`);
      }
    });
  }

  it("ids are unique per collection and stable", () => {
    for (const name of MODEL_ORDER) {
      const ids = SEED[name].map((d) => d._id);
      assert.equal(new Set(ids).size, ids.length, `${name} ids unique`);
      assert.ok(ids.every((id) => /^[0-9a-f]{24}$/.test(id)));
    }
    assert.equal(oid("user:arjun-sen"), oid("user:arjun-sen"));
  });

  it("slugs and flag names are unique", () => {
    assert.equal(new Set(decks.map((d) => d.slug)).size, decks.length);
    assert.equal(new Set(decks.map((d) => d.flagName)).size, decks.length);
  });

  it("cards reference seeded decks", () => {
    const deckIds = new Set(decks.map((d) => d._id));
    assert.ok(cards.every((c) => deckIds.has(c.deckId)));
  });
});

describe("seed numbers match spec/08", () => {
  const headlineDeck = decks.find((d) => d.slug === "voice-khata-headline");
  const headlineCard = (key) => cards.find((c) => c.deckId === headlineDeck._id && c.variantKey === key)._id;
  const stats = (key) => ({
    swipers: responses.filter((r) => r.cardId === headlineCard(key)).length,
    yes: responses.filter((r) => r.cardId === headlineCard(key) && r.answer === "positive").length,
    joined: claims.filter((c) => c.cardId === headlineCard(key)).length,
  });

  it("headline results by variant", () => {
    assert.deepEqual(stats("B"), { swipers: 71, yes: 38, joined: 13 });
    assert.deepEqual(stats("A"), { swipers: 72, yes: 34, joined: 8 });
    assert.deepEqual(stats("C"), { swipers: 71, yes: 26, joined: 5 });
  });

  it("headline totals and source split", () => {
    assert.equal(responses.length, 214);
    assert.equal(responses.filter((r) => r.answer === "positive").length, 98);
    assert.equal(claims.filter((c) => c.deckId === headlineDeck._id).length, 26);
    const feed = responses.filter((r) => r.source === "feed");
    assert.equal(feed.length, 160);
    assert.equal(feed.filter((r) => r.answer === "positive").length, 70);
    assert.equal(responses.filter((r) => r.source === "link").length, 54);
  });

  it("waitlist is 118; every seeded swipe is valid and counted", () => {
    assert.equal(claims.length, 118);
    assert.ok(responses.every((r) => r.valid && r.counted && r.dwellMs >= 2000));
    assert.ok(claims.every((c) => c.email.endsWith("@example.invalid")));
  });

  it("wallet is Rs 46.75 at Rs 0.25 per valid swipe", () => {
    const [wallet] = wallets;
    assert.equal(wallet.balance, 46.75);
    const sum = wallet.entries.reduce((s, e) => s + e.amount, 0);
    assert.equal(Math.round(sum * 100), 4675);
    for (const e of wallet.entries) assert.equal(e.swipeCount * 25, Math.round(e.amount * 100));
    assert.equal(wallet.entries.at(-1).swipeCount, 124);
  });
});

describe("seed script guards (no connection is made)", () => {
  const run = (args, env) =>
    spawnSync(process.execPath, [SEED_SCRIPT, ...args], { env: { PATH: process.env.PATH, ...env }, encoding: "utf8" });

  it("refuses without --yes", () => {
    const r = run([], { MONGODB_URI: "mongodb://user:secretpw@127.0.0.1:1/never" });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /--yes/);
    assert.ok(!r.stdout.includes("secretpw") && !r.stderr.includes("secretpw"));
  });

  it("refuses without MONGODB_URI", () => {
    const r = run(["--yes"], {});
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /MONGODB_URI/);
  });
});
