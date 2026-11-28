// Puts 200 starter decks in the swipe feed (scripts/seed/feed-ideas.mjs: 50 ideas x headline, description, price,
// launch reward), owned by 5 founder accounts (10 products, 40 decks each) whose names show on the cards.
//
//   npm run seed:feed                 dry run: validates all 200 decks exactly as publishing would; writes nothing
//   npm run seed:feed -- --yes        writes: 5 founder accounts, 50 products, 200 decks, each published
//   npm run seed:feed -- --owner-email you@example.com --products 5 --yes
//                                     5 extra products x 4 decks = 20 decks in that existing account (never created)
//   ... --owner-email you@example.com --products 5 --recreate --yes
//                                     deletes that account's decks of those products and republishes them (new Flagsmith experiments)
//   npm run seed:feed -- --ideas 3 --variables headline,price --yes
//                                     a small set: the first 3 ideas, headline and price tests only (6 decks)
//
// For a short event with few swipers, seed a small set: every deck splits the swipers, and a deck needs 50 counted
// swipers per version before Flagsmith can call a winner. The 5-minute watcher also checks every live deck in turn.
//
// Writing goes through the same service as the app (src/features/decks/server/service.ts createDeck with publish), so every deck
// gets its Flagsmith flag and experiment like a founder's deck. It needs MONGODB_URI, and FLAGSMITH_* for the flags
// (without them a deck still goes live and swipers get a local split, as the app does when Flagsmith is down).
//
// Safety: refuses --yes without MONGODB_URI or with PITCHSWIPE_DEMO=1, prints the target database and Flagsmith
// environment before writing, never prints the URI or keys. Idempotent: a product that exists (same name, same
// founder) is reused, and a variable that already has a deck for that product is skipped, so re-running adds only
// what is missing. To take the decks out of the feed later, set listedInFeed false on decks whose ownerId is one of
// the founder accounts (users with a firebaseUid starting "founder-pitchswipe-" and an .invalid email).
import { register } from "node:module";
import { FOUNDERS, OWNER_IDEAS, deckInput, feedPlan, productInput } from "./feed-ideas.mjs";

// src/models imports `models` by name from mongoose, which Node's ESM interop does not expose; the shim fixes that.
register("./mongoose-hooks.mjs", import.meta.url);

const write = process.argv.includes("--yes");
const argValue = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const ideasArg = argValue("--ideas");
const variablesArg = argValue("--variables");
const ownerEmail = argValue("--owner-email");
const productsArg = argValue("--products");
const recreate = process.argv.includes("--recreate");
if (recreate && !ownerEmail) {
  console.error("seed:feed: --recreate only goes with --owner-email.");
  process.exit(1);
}
if (productsArg !== undefined && !ownerEmail) {
  console.error("seed:feed: --products only goes with --owner-email.");
  process.exit(1);
}
// Owner mode: seed only OWNER_IDEAS into one real founder's own account (looked up by email in Firebase, read-only).
const OWNER_SELF = { name: "the account owner" };

function fail(message) {
  console.error(`seed:feed: ${message}`);
  process.exit(1);
}

const { validateDeck } = await import("../../src/features/decks/validate.ts");
const { validateProduct } = await import("../../src/features/decks/product.ts");

// 1. Validate everything first, in publish mode, so a bad entry never leaves a half-written feed.
let plan;
try {
  plan = feedPlan({
    ...(ownerEmail ? { pool: OWNER_IDEAS.map((i) => ({ ...i, owner: OWNER_SELF })) } : {}),
    ...(ideasArg !== undefined || productsArg !== undefined ? { ideas: Number(productsArg ?? ideasArg) } : {}),
    ...(variablesArg !== undefined ? { variables: variablesArg.split(",").map((v) => v.trim()).filter(Boolean) } : {}),
  });
} catch (error) {
  fail(error.message);
}
const problems = [];
for (const { idea, variable } of plan) {
  const p = validateProduct(productInput(idea));
  if (!p.ok) problems.push(`${idea.name}: product: ${p.errors.map((e) => e.message).join(" ")}`);
  const d = validateDeck(deckInput(idea, variable, "000000000000000000000000"), "publish");
  if (!d.ok) problems.push(`${idea.name} / ${variable}: ${d.errors.map((e) => `${e.path} ${e.message}`).join(" ")}`);
}
if (problems.length > 0) fail(`${problems.length} problem(s):\n  ${problems.join("\n  ")}`);
const products = new Set(plan.map((x) => x.idea.name)).size;
const founders = new Set(plan.map((x) => x.idea.owner)).size;
console.log(`seed:feed: ${plan.length} decks across ${products} products and ${founders} founders pass the publish checks.`);

if (recreate) {
  console.log(`seed:feed: --recreate: would delete that account's existing decks (with their responses, claims and comments) of these ${products} products, then publish ${plan.length} new decks so each gets a Flagsmith experiment.`);
}
if (!write) {
  console.log("seed:feed: dry run, nothing written. Add --yes to write them to the database in MONGODB_URI.");
  process.exit(0);
}

// 2. Write.
if (!process.env.MONGODB_URI) fail("MONGODB_URI is not set.");
if (process.env.PITCHSWIPE_DEMO === "1") fail("PITCHSWIPE_DEMO=1 would write to the in-memory demo store. Unset it.");

const { connectDb } = await import("../../src/shared/lib/db.ts");
const { User, Deck, Card, Response, Claim, Product } = await import("../../src/models/index.ts");
const service = await import("../../src/features/decks/server/service.ts");
const mongoose = (await import("mongoose")).default;

const uri = process.env.MONGODB_URI;
const redact = (text) => String(text).split(uri).join("<MONGODB_URI>");

try {
  await connectDb();
  console.log(`seed:feed: target database "${mongoose.connection.name}"`);
  console.log(
    process.env.FLAGSMITH_ADMIN_API_KEY
      ? `seed:feed: Flagsmith project ${process.env.FLAGSMITH_PROJECT_ID ?? "?"}, environment ${process.env.FLAGSMITH_ENVIRONMENT_ID ?? "?"}`
      : "seed:feed: Flagsmith is not configured: decks go live without a flag (local split).",
  );

  // One account, product list and deck list per founder that owns something in this plan.
  const owners = new Map();
  if (ownerEmail) {
    // Read-only on Firebase: look the address up, never create or change a user.
    const { getFirebaseAdminAuth } = await import("../../src/shared/lib/firebase/admin.ts");
    let fbUser;
    try {
      fbUser = await getFirebaseAdminAuth().getUserByEmail(ownerEmail);
    } catch (error) {
      if (error?.code === "auth/user-not-found") throw new Error("no Firebase account has that email. Nothing written.");
      throw error;
    }
    const user = await User.findOne({ firebaseUid: fbUser.uid }).select("_id").lean();
    if (!user) throw new Error(`Firebase account ${fbUser.uid.slice(0, 6)}... has no profile in the database yet. Sign in once and finish the profile. Nothing written.`);
    const ownerId = String(user._id);
    const products = await service.listProducts(ownerId);
    let decks = await service.listDecks(ownerId);
    if (recreate) {
      // Only this account's decks of the products in this plan. Products are kept; their decks are rebuilt below.
      const names = new Set(plan.map((x) => x.idea.name));
      const productIds = new Set(products.filter((p) => names.has(p.name)).map((p) => p.id));
      const doomed = decks.filter((d) => productIds.has(d.productId)).map((d) => d._id);
      if (doomed.length) {
        await Promise.all([
          Response.deleteMany({ deckId: { $in: doomed } }),
          Claim.deleteMany({ deckId: { $in: doomed } }),
          Card.deleteMany({ deckId: { $in: doomed } }),
        ]);
        await Product.updateMany({ _id: { $in: [...productIds] } }, { $pull: { deckIds: { $in: doomed } } });
        await Deck.deleteMany({ _id: { $in: doomed }, ownerId });
        for (const old of decks.filter((d) => doomed.includes(d._id) && d.experimentId)) {
          console.log(`seed:feed: note: old deck ${old._id.slice(-6)} had Flagsmith flag ${old.flagName}; left as is.`);
        }
      }
      console.log(`seed:feed: --recreate: deleted ${doomed.length} existing decks.`);
      decks = decks.filter((d) => !doomed.includes(d._id));
    }
    owners.set(OWNER_SELF, { ownerId, productIds: new Map(products.map((p) => [p.name, p.id])), decks });
    console.log(`seed:feed: owner account found (uid ${fbUser.uid.slice(0, 6)}...)`);
  } else for (const founder of FOUNDERS) {
    if (!plan.some((x) => x.idea.owner === founder)) continue;
    const user = await User.findOneAndUpdate(
      { firebaseUid: founder.firebaseUid },
      { $setOnInsert: { ...founder, emailVerified: true, roles: ["founder"], createdAt: new Date() } },
      { upsert: true, returnDocument: "after", lean: true },
    );
    const ownerId = String(user._id);
    const products = await service.listProducts(ownerId);
    owners.set(founder, {
      ownerId,
      productIds: new Map(products.map((p) => [p.name, p.id])),
      decks: await service.listDecks(ownerId),
    });
    console.log(`seed:feed: founder ${founder.name}`);
  }
  let created = 0;
  let skipped = 0;
  let noFlag = 0;

  for (const { idea, variable } of plan) {
    const { ownerId, productIds, decks: existingDecks } = owners.get(idea.owner);
    let productId = productIds.get(idea.name);
    if (!productId) {
      const res = await service.createProduct(ownerId, productInput(idea));
      if (!res.ok) throw new Error(`${idea.name}: ${res.error}`);
      productId = res.value.id;
      productIds.set(idea.name, productId);
    }
    if (existingDecks.some((d) => d.productId === productId && d.variable === variable && d.status !== "closed")) {
      skipped++;
      continue;
    }
    const res = await service.createDeck(ownerId, { ...deckInput(idea, variable, productId), publish: true });
    if (!res.ok) throw new Error(`${idea.name} / ${variable}: ${res.error} ${(res.errors ?? []).map((e) => e.message).join(" ")}`);
    if (!res.value.experimentId) noFlag++;
    created++;
    console.log(`seed:feed: ${idea.name} / ${variable}: ${res.value.status}${res.value.experimentId ? `, experiment ${res.value.experimentId}` : ""}`);
  }
  console.log(`seed:feed: done. ${created} published, ${skipped} already there${noFlag ? `, ${noFlag} without a Flagsmith experiment` : ""}.`);
} catch (error) {
  console.error(`seed:feed: failed: ${redact(error?.message ?? error)}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect().catch(() => {});
}
