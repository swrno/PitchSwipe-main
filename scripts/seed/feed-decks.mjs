// Puts 100 starter decks in the swipe feed (scripts/seed/feed-ideas.mjs: 25 ideas x headline, description, price,
// launch reward), owned by one house account whose name shows on every card.
//
//   npm run seed:feed                 dry run: validates all 100 decks exactly as publishing would; writes nothing
//   npm run seed:feed -- --yes        writes: house account, 25 products, 100 decks, each published
//   npm run seed:feed -- --ideas 3 --variables headline,price --yes
//                                     a small set: the first 3 ideas, headline and price tests only (6 decks)
//
// For a short event with few swipers, seed a small set: every deck splits the swipers, and a deck needs 50 counted
// swipers per version before Flagsmith can call a winner. The 5-minute watcher also checks every live deck in turn.
//
// Writing goes through the same service as the app (src/lib/decks/service.ts createDeck with publish), so every deck
// gets its Flagsmith flag and experiment like a founder's deck. It needs MONGODB_URI, and FLAGSMITH_* for the flags
// (without them a deck still goes live and swipers get a local split, as the app does when Flagsmith is down).
//
// Safety: refuses --yes without MONGODB_URI or with PITCHSWIPE_DEMO=1, prints the target database and Flagsmith
// environment before writing, never prints the URI or keys. Idempotent: a product that exists (same name, house
// account) is reused, and a variable that already has a deck for that product is skipped, so re-running adds only
// what is missing. To take the decks out of the feed later, archive them from My decks signed in as the house account,
// or set listedInFeed false on decks whose ownerId is the house account.
import { HOUSE_ACCOUNT, deckInput, feedPlan, productInput } from "./feed-ideas.mjs";

const write = process.argv.includes("--yes");
const argValue = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const ideasArg = argValue("--ideas");
const variablesArg = argValue("--variables");

function fail(message) {
  console.error(`seed:feed: ${message}`);
  process.exit(1);
}

const { validateDeck } = await import("../../src/lib/decks/validate.ts");
const { validateProduct } = await import("../../src/lib/decks/product.ts");

// 1. Validate everything first, in publish mode, so a bad entry never leaves a half-written feed.
let plan;
try {
  plan = feedPlan({
    ...(ideasArg !== undefined ? { ideas: Number(ideasArg) } : {}),
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
console.log(`seed:feed: ${plan.length} decks across ${products} products pass the publish checks.`);

if (!write) {
  console.log("seed:feed: dry run, nothing written. Add --yes to write them to the database in MONGODB_URI.");
  process.exit(0);
}

// 2. Write.
if (!process.env.MONGODB_URI) fail("MONGODB_URI is not set.");
if (process.env.PITCHSWIPE_DEMO === "1") fail("PITCHSWIPE_DEMO=1 would write to the in-memory demo store. Unset it.");

const { connectDb } = await import("../../src/lib/db.ts");
const { User } = await import("../../src/models/index.ts");
const service = await import("../../src/lib/decks/service.ts");
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

  const house = await User.findOneAndUpdate(
    { firebaseUid: HOUSE_ACCOUNT.firebaseUid },
    { $setOnInsert: { ...HOUSE_ACCOUNT, emailVerified: true, roles: ["founder"], createdAt: new Date() } },
    { upsert: true, new: true, lean: true },
  );
  const ownerId = String(house._id);

  const existingProducts = await service.listProducts(ownerId);
  const existingDecks = await service.listDecks(ownerId);
  const productIds = new Map(existingProducts.map((p) => [p.name, p.id]));
  let created = 0;
  let skipped = 0;
  let noFlag = 0;

  for (const { idea, variable } of plan) {
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
