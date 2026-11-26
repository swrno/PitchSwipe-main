// Pure helpers for scripts/db/sync-indexes.mjs. No database access here, so they are unit-tested directly.

/** Checks the CLI arguments and environment. Returns { ok: true, uri } or { ok: false, errors: [...] }. */
export function checkGuards(argv, env) {
  const errors = [];
  const uri = typeof env.MONGODB_URI === "string" ? env.MONGODB_URI.trim() : "";
  if (!uri) errors.push("MONGODB_URI is not set in the environment.");
  if (!argv.includes("--yes")) {
    errors.push("refusing to run without --yes. This creates indexes and DROPS indexes that are not in the schema, on the database named in MONGODB_URI.");
  }
  return errors.length ? { ok: false, errors } : { ok: true, uri };
}

/** Replaces every occurrence of the connection string in text, so an error message can never leak it. */
export function redact(text, uri) {
  const value = String(text);
  return uri ? value.split(uri).join("<MONGODB_URI>") : value;
}

/** True for a MongoDB duplicate-key error (code 11000), including one wrapped in an `errors` list. */
export function isDuplicateKeyError(error) {
  if (!error) return false;
  if (error.code === 11000 || /E11000/.test(String(error.message ?? ""))) return true;
  return Array.isArray(error.errors) && error.errors.some(isDuplicateKeyError);
}

/** Unique index field lists declared on a Mongoose schema, e.g. [["deckId","swiperId"], ["slug"]]. */
export function uniqueIndexFields(schema) {
  return schema
    .indexes()
    .filter(([, options]) => options && options.unique)
    .map(([fields]) => Object.keys(fields));
}

/** Aggregation pipeline that lists key combinations present more than once for the given fields. */
export function duplicatePipeline(fields, limit = 20) {
  const key = Object.fromEntries(fields.map((field, i) => [`k${i}`, `$${field}`]));
  return [
    { $group: { _id: key, ids: { $push: "$_id" }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit },
  ];
}

/** Turns one aggregation group into a printable line, mapping k0, k1 ... back to field names. */
export function describeDuplicate(fields, group) {
  const key = fields.map((field, i) => `${field}=${JSON.stringify(group._id?.[`k${i}`] ?? null)}`).join(", ");
  const ids = (group.ids ?? []).slice(0, 5).map(String).join(", ");
  const more = (group.ids ?? []).length > 5 ? ", ..." : "";
  return `${group.count} documents share ${key} (_id: ${ids}${more})`;
}
