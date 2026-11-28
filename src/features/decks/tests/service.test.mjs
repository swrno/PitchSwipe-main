// Service flow on an empty in-memory store (a test double): draft -> publish -> locked. No MongoDB, no network.
// Run: npm test -- decks
import test from "node:test";
import assert from "node:assert/strict";

delete process.env.MONGODB_URI;
const svc = await import("../server/service.ts");
const { createMemoryStore } = await import("../server/store-memory.ts");
const { setStoreForTests } = await import("../server/store.ts");

const memory = createMemoryStore();
setStoreForTests(memory);
const OWNER_ID = "test-owner";
const created0 = await svc.createProduct(OWNER_ID, { name: "QueueLess", industry: "Healthcare", targetUsers: ["Doctor"] });
if (!created0.ok) throw new Error("could not create the test product");
const PRODUCT_ID = created0.value.id;

const body = (over = {}) => ({
  productId: PRODUCT_ID,
  variable: "headline",
  question: "Would you pay Rs 99 a month?",
  positiveLabel: "Yes",
  negativeLabel: "No",
  shared: { description: "Book a clinic slot.", reward: "Free month", price: "Rs 99 / mo" },
  cards: [
    { variantKey: "A", value: "Skip the queue." },
    { variantKey: "B", value: "See the doctor on time." },
  ],
  ...over,
});

test("overview lists the owner's own products with their decks, and nothing else", async () => {
  const o = await svc.getOverview(OWNER_ID);
  assert.deepEqual(o.products.map((p) => p.name), ["QueueLess"]);
  assert.equal("allowance" in o, false);
  assert.equal("demo" in o, false);
  assert.deepEqual((await svc.getOverview("someone-else")).products, []);
});

test("draft saves leniently, publishes, then locks", async () => {
  const draft = await svc.createDeck(OWNER_ID, body({ cards: [{ variantKey: "A", value: "Only one" }] }));
  assert.equal(draft.ok, true);
  assert.equal(draft.value.status, "draft");

  const bad = await svc.patchDeck(OWNER_ID, draft.value._id, { publish: true });
  assert.equal(bad.ok, false);
  assert.equal(bad.status, 422);

  const fixed = await svc.patchDeck(OWNER_ID, draft.value._id, { cards: body().cards, publish: true });
  assert.equal(fixed.ok, true);
  assert.equal(fixed.value.status, "live");
  assert.equal(fixed.value.shared.product.name, "QueueLess");
  assert.match(fixed.value.flagName, /^deck_queueless-headline-/);

  const edit = await svc.patchDeck(OWNER_ID, draft.value._id, { cards: [{ variantKey: "A", value: "Changed" }, body().cards[1]] });
  assert.equal(edit.ok, false);
  assert.equal(edit.status, 409);
  const q = await svc.patchDeck(OWNER_ID, draft.value._id, { question: "Other?" });
  assert.equal(q.status, 409);

  assert.equal((await svc.removeDeck(OWNER_ID, draft.value._id)).status, 409);
  const archived = await svc.patchDeck(OWNER_ID, draft.value._id, { archived: true });
  assert.equal(archived.value.status, "closed");
});

test("product edits do not touch published decks (snapshot) and are owner-scoped", async () => {
  const created = await svc.createDeck(OWNER_ID, { ...body(), publish: true });
  assert.equal(created.ok, true);
  const p = await svc.getProduct(OWNER_ID, PRODUCT_ID);
  const updated = await svc.updateProduct(OWNER_ID, PRODUCT_ID, { ...p.value, name: "QueueLess Pro" });
  assert.equal(updated.ok, true);
  const again = await svc.getDeck(OWNER_ID, created.value._id);
  assert.equal(again.value.shared.product.name, "QueueLess");
  assert.equal((await svc.getDeck("someone-else", created.value._id)).ok, false);
  assert.equal((await svc.getProduct("someone-else", PRODUCT_ID)).ok, false);
});

test("deleting a draft works; unknown product is rejected", async () => {
  const d = await svc.createDeck(OWNER_ID, body());
  assert.equal((await svc.removeDeck(OWNER_ID, d.value._id)).ok, true);
  const nope = await svc.createDeck(OWNER_ID, body({ productId: "nope" }));
  assert.equal(nope.status, 404);
  const bad = await svc.createProduct(OWNER_ID, { name: "X", industry: "Retail", targetUsers: ["Pirate"] });
  assert.equal(bad.status, 422);
});

test("publish stores the Flagsmith ids; a Flagsmith failure still goes live as a local split with the reason", async () => {
  const { setHookDepsForTests } = await import("../server/integration.ts");
  const quiet = { info() {}, warn() {}, error() {} };
  const archived = [];
  const port = (fail) => ({
    async launchDeckExperiment(input) {
      if (fail) throw Object.assign(new Error("boom"), { safeReason: "Flagsmith failed while creating the experiment (HTTP 403)" });
      return { experimentId: "57", flagName: `${input.flagName}_r1`, featureId: 11, optionIds: { B: 101 }, rewardMetricId: "3" };
    },
    async archiveFeature(id) {
      archived.push(id);
    },
    async archiveFlag(name) {
      archived.push(name);
    },
  });
  try {
    setHookDepsForTests({ flagsmith: port(false), log: quiet });
    const ok = await svc.createDeck(OWNER_ID, { ...body(), publish: true });
    assert.equal(ok.value.status, "live");
    assert.equal(ok.value.experimentId, "57");
    assert.equal(ok.value.featureId, 11);
    assert.deepEqual(ok.value.optionIds, { B: 101 });
    assert.equal(ok.value.rewardMetricId, "3");
    assert.match(ok.value.flagName, /_r1$/, "a retried publish stores the flag name actually created");
    assert.equal(ok.value.flagsmithError, undefined);
    await svc.patchDeck(OWNER_ID, ok.value._id, { archived: true });
    assert.deepEqual(archived, [11]);

    setHookDepsForTests({ flagsmith: port(true), log: quiet });
    const failed = await svc.createDeck(OWNER_ID, { ...body(), publish: true });
    assert.equal(failed.ok, true);
    assert.equal(failed.value.status, "live");
    assert.equal(failed.value.listedInFeed, true);
    assert.equal(failed.value.experimentId, undefined);
    assert.equal(failed.value.flagsmithError, "Flagsmith failed while creating the experiment (HTTP 403)");
    // Archiving a local-split deck never calls Flagsmith and never throws.
    const closed = await svc.patchDeck(OWNER_ID, failed.value._id, { archived: true });
    assert.equal(closed.value.status, "closed");
    assert.deepEqual(archived, [11]);
  } finally {
    setHookDepsForTests(null);
  }
});

test("two concurrent publishes of one draft: exactly one reaches Flagsmith, the other gets 409", async () => {
  const { setHookDepsForTests } = await import("../server/integration.ts");
  const quiet = { info() {}, warn() {}, error() {} };
  let launches = 0;
  let release;
  const gate = new Promise((r) => (release = r));
  setHookDepsForTests({
    log: quiet,
    flagsmith: {
      async launchDeckExperiment(input) {
        launches++;
        await gate; // a slow Flagsmith: the second request arrives while the first is still publishing
        return { experimentId: "58", flagName: input.flagName, featureId: 12, optionIds: { B: 102 }, rewardMetricId: "3" };
      },
      async archiveFeature() {},
      async archiveFlag() {},
    },
  });
  try {
    const draft = await svc.createDeck(OWNER_ID, body());
    const first = svc.patchDeck(OWNER_ID, draft.value._id, { publish: true });
    await new Promise((r) => setImmediate(r));
    const second = await svc.patchDeck(OWNER_ID, draft.value._id, { publish: true });
    assert.equal(second.ok, false);
    assert.equal(second.status, 409);
    // While the claim is held: no card edits and no delete either.
    const edit = await svc.patchDeck(OWNER_ID, draft.value._id, { cards: body().cards });
    assert.equal(edit.status, 409);
    assert.equal((await svc.removeDeck(OWNER_ID, draft.value._id)).status, 409);
    release();
    const done = await first;
    assert.equal(done.ok, true);
    assert.equal(done.value.status, "live");
    assert.equal(done.value.experimentId, "58");
    assert.equal(done.value.publishingAt ?? null, null, "the final save clears the claim");
    assert.equal(launches, 1);
    // After it is live, a late retry is refused as already published, without a second launch.
    const late = await svc.patchDeck(OWNER_ID, draft.value._id, { publish: true });
    assert.equal(late.status, 409);
    assert.equal(launches, 1);
  } finally {
    release?.();
    setHookDepsForTests(null);
  }
});

test("archiving a shipped deck keeps its Flagsmith flag (the hook sees the status before archiving)", async () => {
  const { setHookDepsForTests } = await import("../server/integration.ts");
  const { getStore } = await import("../server/store.ts");
  const quiet = { info() {}, warn() {}, error() {} };
  const archived = [];
  setHookDepsForTests({
    log: quiet,
    flagsmith: {
      async launchDeckExperiment(input) {
        return { experimentId: "59", flagName: input.flagName, featureId: 13, optionIds: { B: 103 }, rewardMetricId: "3" };
      },
      async archiveFeature(id) {
        archived.push(id);
      },
      async archiveFlag(name) {
        archived.push(name);
      },
    },
  });
  try {
    const live = await svc.createDeck(OWNER_ID, { ...body(), publish: true });
    await (await getStore()).updateDeck(OWNER_ID, live.value._id, { status: "shipped" });
    const closed = await svc.patchDeck(OWNER_ID, live.value._id, { archived: true });
    assert.equal(closed.value.status, "closed");
    assert.deepEqual(archived, []);
  } finally {
    setHookDepsForTests(null);
  }
});

/** A fake Flagsmith that records launches and archives. */
function recordingPort(onLaunch) {
  const seen = { launches: [], archived: [] };
  return {
    seen,
    port: {
      async launchDeckExperiment(input) {
        seen.launches.push(input);
        await onLaunch?.(input);
        return { experimentId: "60", flagName: input.flagName, featureId: 14, optionIds: { B: 104 }, rewardMetricId: "3" };
      },
      async archiveFeature(id) {
        seen.archived.push(id);
      },
      async archiveFlag(name) {
        seen.archived.push(name);
      },
    },
  };
}

test("an edit to ANY validated field between the draft save and the claim stops the publish (409), nothing goes live", async () => {
  const { setHookDepsForTests } = await import("../server/integration.ts");
  const { getStore } = await import("../server/store.ts");
  const store = await getStore();
  const { seen, port } = recordingPort();
  const realClaim = store.claimPublish;
  setHookDepsForTests({ flagsmith: port, log: { info() {}, warn() {}, error() {} } });
  try {
    const draft = await svc.createDeck(OWNER_ID, body());
    // Another tab's autosave lands just before the claim: an empty question (draft-valid only) and a new tagline.
    store.claimPublish = async (ownerId, id, now) => {
      const d = await store.getDeck(ownerId, id);
      await store.updateDeck(ownerId, id, { question: "", shared: { ...d.shared, description: "New tagline." }, cards: d.cards });
      return realClaim.call(store, ownerId, id, now);
    };
    const res = await svc.patchDeck(OWNER_ID, draft.value._id, { publish: true });
    assert.equal(res.ok, false);
    assert.equal(res.status, 409);
    assert.equal(seen.launches.length, 0, "nothing reaches Flagsmith");
    const after = await store.getDeck(OWNER_ID, draft.value._id);
    assert.equal(after.status, "draft");
    assert.equal(after.publishingAt ?? null, null, "the claim is released");
    assert.equal(after.shared.description, "New tagline.", "the newer save is kept, not overwritten");
  } finally {
    store.claimPublish = realClaim;
    setHookDepsForTests(null);
  }
});

test("what goes live passes publish validation even when a racing save was read back with the caller's draft save", async () => {
  const { setHookDepsForTests } = await import("../server/integration.ts");
  const { getStore } = await import("../server/store.ts");
  const store = await getStore();
  const { seen, port } = recordingPort();
  const realUpdate = store.updateDeck;
  setHookDepsForTests({ flagsmith: port, log: { info() {}, warn() {}, error() {} } });
  try {
    const draft = await svc.createDeck(OWNER_ID, body());
    // The caller's save passed publish validation, but another tab's one-card save lands before it is read back.
    store.updateDeck = async (ownerId, id, patch) => {
      const out = await realUpdate.call(store, ownerId, id, patch);
      if (!patch.cards) return out;
      return realUpdate.call(store, ownerId, id, { cards: [{ variantKey: "A", value: "Only one" }] });
    };
    const res = await svc.patchDeck(OWNER_ID, draft.value._id, { publish: true });
    assert.equal(res.ok, false);
    assert.equal(res.status, 422);
    assert.equal(seen.launches.length, 0, "nothing reaches Flagsmith");
    store.updateDeck = realUpdate;
    const after = await store.getDeck(OWNER_ID, draft.value._id);
    assert.equal(after.status, "draft");
    assert.equal(after.publishingAt ?? null, null, "the claim is released");
  } finally {
    store.updateDeck = realUpdate;
    setHookDepsForTests(null);
  }
});

test("delete is conditional in the store: never a claimed draft or a published deck", async () => {
  const { getStore } = await import("../server/store.ts");
  const store = await getStore();
  const draft = await svc.createDeck(OWNER_ID, body());
  assert.equal(await store.claimPublish(OWNER_ID, draft.value._id, new Date()), true);
  assert.equal(await store.deleteDeck(OWNER_ID, draft.value._id), false);
  assert.ok(await store.getDeck(OWNER_ID, draft.value._id));
  await store.updateDeck(OWNER_ID, draft.value._id, { status: "live", publishingAt: null });
  assert.equal(await store.deleteDeck(OWNER_ID, draft.value._id), false);
  const other = await svc.createDeck(OWNER_ID, body());
  assert.equal(await store.deleteDeck(OWNER_ID, other.value._id), true);
});

test("a deck deleted while publishing is not reported live, and the flag just made for it is archived", async () => {
  const { setHookDepsForTests } = await import("../server/integration.ts");
  let draftId;
  const { seen, port } = recordingPort(async () => {
    // A stale claim was taken over by a delete while Flagsmith was building the flag.
    memory.forceRemoveDeck(draftId);
  });
  setHookDepsForTests({ flagsmith: port, log: { info() {}, warn() {}, error() {} } });
  try {
    const draft = await svc.createDeck(OWNER_ID, body());
    draftId = draft.value._id;
    const res = await svc.patchDeck(OWNER_ID, draftId, { publish: true });
    assert.equal(res.ok, false);
    assert.equal(res.status, 404);
    assert.equal(seen.launches.length, 1);
    assert.deepEqual(seen.archived, [14]);
  } finally {
    setHookDepsForTests(null);
  }
});

test("a draft switched to another variable gets a matching slug and flag name", async () => {
  const draft = await svc.createDeck(OWNER_ID, body());
  const m = /^(.*)-headline-([a-z0-9]+)$/.exec(draft.value.slug);
  assert.ok(m, draft.value.slug);
  const [, productPart, suffix] = m;
  const price = await svc.patchDeck(OWNER_ID, draft.value._id, {
    variable: "price",
    priceMode: "level",
    shared: { headline: "Skip the queue.", description: "Book a clinic slot.", reward: "Free month" },
    cards: [
      { variantKey: "A", value: "Rs 25 / mo" },
      { variantKey: "B", value: "Rs 35 / mo" },
    ],
  });
  assert.equal(price.ok, true);
  assert.equal(price.value.slug, `${productPart}-price-${suffix}`);
  assert.equal(price.value.flagName, `deck_${productPart}-price-${suffix}`);

  const published = await svc.patchDeck(OWNER_ID, draft.value._id, { publish: true });
  assert.equal(published.value.flagName, `deck_${productPart}-price-${suffix}`);
});

test("a draft saved without changing the variable keeps its slug", async () => {
  const draft = await svc.createDeck(OWNER_ID, body());
  const saved = await svc.patchDeck(OWNER_ID, draft.value._id, { question: "Would you pay?" });
  assert.equal(saved.value.slug, draft.value.slug);
});
