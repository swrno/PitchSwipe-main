// Idempotent demo seed. Upserts by stable _id, so re-running updates in place.
//
//   MONGODB_URI=... node scripts/seed/seed.mjs --yes
//
// Safety: refuses to run without --yes, requires MONGODB_URI in the environment, prints the
// target database name before any write, and never prints the URI. It uses mongoose (already a
// declared dependency); the bare `mongodb` driver is only a transitive install, not declared.
// Seeded claim emails use the reserved .invalid domain; no real emails.
import mongoose from "mongoose";

import { MODEL_ORDER, SEED, collectionFor } from "./seed-data.mjs";

function fail(message) {
  console.error(`seed: ${message}`);
  process.exit(1);
}

if (!process.argv.includes("--yes")) {
  fail("refusing to run without --yes. This writes demo data to the database named in MONGODB_URI.");
}
const uri = process.env.MONGODB_URI;
if (!uri) fail("MONGODB_URI is not set in the environment.");

function redact(text) {
  return String(text).split(uri).join("<MONGODB_URI>");
}

const OID_FIELDS = new Set(["_id", "ownerId", "productId", "deckId", "cardId", "swiperId", "userId", "winnerCardId", "deckIds"]);

function convert(value, key) {
  if (Array.isArray(value)) return value.map((v) => convert(v, key));
  if (typeof value === "string" && OID_FIELDS.has(key)) return new mongoose.Types.ObjectId(value);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, convert(v, k)]));
  }
  return value;
}

try {
  await mongoose.connect(uri, { bufferCommands: false });
  const db = mongoose.connection;
  console.log(`seed: target database "${db.name}" (connected; nothing written yet)`);

  for (const modelName of MODEL_ORDER) {
    const docs = SEED[modelName];
    const ops = docs.map((doc) => {
      const { _id, ...rest } = convert(doc);
      return { replaceOne: { filter: { _id }, replacement: rest, upsert: true } };
    });
    const result = await db.collection(collectionFor(modelName)).bulkWrite(ops, { ordered: false });
    console.log(`seed: ${modelName}: ${docs.length} docs (${result.upsertedCount} inserted, ${result.modifiedCount} updated)`);
  }
  console.log("seed: done");
} catch (error) {
  console.error(`seed: failed: ${redact(error?.message ?? error)}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect().catch(() => {});
}
