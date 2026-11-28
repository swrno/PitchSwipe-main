/**
 * Durable StateStore on MongoDB, so the 5-minute refresh guard and pre-ship
 * snapshots survive across serverless instances. Lazy: nothing connects until
 * the first call. Note get-then-set is not atomic; two simultaneous refreshes
 * in the same instant can both pass (acceptable: Flagsmith's own advice is a
 * soft once-per-5-minutes).
 */
import type { StateStore } from "../state";

const COLLECTION = "flagsmith_state";

export function createMongoStore(): StateStore {
  async function collection() {
    const { connectDb } = await import("@/shared/lib/db");
    const mongoose = await connectDb();
    const db = mongoose.connection.db;
    if (!db) throw new Error("MongoDB connection has no database handle");
    return db.collection<{ _id: string; value: unknown }>(COLLECTION);
  }

  return {
    async get(key) {
      const doc = await (await collection()).findOne({ _id: key });
      return doc ? doc.value : null;
    },
    async set(key, value) {
      await (await collection()).updateOne({ _id: key }, { $set: { value } }, { upsert: true });
    },
  };
}
