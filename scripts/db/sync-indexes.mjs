// Brings the MongoDB indexes in line with the Mongoose schemas (src/models/index.ts).
//
//   node --import ./scripts/register-ts.mjs scripts/db/sync-indexes.mjs --yes
//   npm run db:sync-indexes -- --yes          (with MONGODB_URI exported, or add --env-file=.env.local to node)
//
// Why: the app never builds indexes on its own (bufferCommands off), and these unique indexes make
// writes atomic: responses (deckId, swiperId) and claims (deckId, email).
// Safety: needs --yes and MONGODB_URI; prints the database name, never the URI. syncIndexes() creates
// missing indexes AND drops indexes on these collections that the schema no longer declares.
// If a unique index cannot be built because duplicates already exist, the duplicates are printed and
// the script exits 1.
import { register } from "node:module";

import mongoose from "mongoose";

import { checkGuards, describeDuplicate, duplicatePipeline, isDuplicateKeyError, redact, uniqueIndexFields } from "./sync-indexes-lib.mjs";

const guards = checkGuards(process.argv.slice(2), process.env);
if (!guards.ok) {
  for (const message of guards.errors) console.error(`sync-indexes: ${message}`);
  process.exit(1);
}
const uri = guards.uri;

// src/models imports `models` by name from mongoose, which Node's ESM interop does not expose; the seed's shim fixes that.
register("../seed/mongoose-hooks.mjs", import.meta.url);

async function reportDuplicates(Model) {
  let found = false;
  for (const fields of uniqueIndexFields(Model.schema)) {
    const groups = await Model.collection.aggregate(duplicatePipeline(fields)).toArray();
    if (!groups.length) continue;
    found = true;
    console.error(`sync-indexes:   duplicates blocking unique index (${fields.join(", ")}) on ${Model.collection.name} (up to ${groups.length} shown):`);
    for (const group of groups) console.error(`sync-indexes:     ${describeDuplicate(fields, group)}`);
  }
  if (!found) console.error("sync-indexes:   the duplicate check found nothing; see the error above.");
}

let failures = 0;
try {
  const models = await import("../../src/models/index.ts");
  await mongoose.connect(uri, { bufferCommands: false });
  console.log(`sync-indexes: target database "${mongoose.connection.name}"`);

  for (const name of models.modelNames) {
    const Model = models[name];
    try {
      const dropped = await Model.syncIndexes();
      console.log(`sync-indexes: ${name} (${Model.collection.name}): ok${dropped.length ? `, dropped ${dropped.join(", ")}` : ""}`);
    } catch (error) {
      failures += 1;
      console.error(`sync-indexes: ${name} (${Model.collection.name}): FAILED: ${redact(error?.message ?? error, uri)}`);
      if (isDuplicateKeyError(error)) {
        try {
          await reportDuplicates(Model);
          console.error("sync-indexes:   remove or merge the duplicates above, then run this again.");
        } catch (inner) {
          console.error(`sync-indexes:   could not list duplicates: ${redact(inner?.message ?? inner, uri)}`);
        }
      }
    }
  }
  console.log(failures ? `sync-indexes: ${failures} model(s) failed` : "sync-indexes: done");
  if (failures) process.exitCode = 1;
} catch (error) {
  console.error(`sync-indexes: failed: ${redact(error?.message ?? error, uri)}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect().catch(() => {});
}
