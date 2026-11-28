import mongoose from "mongoose";

type Cache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };

const globalForMongoose = globalThis as unknown as { __pitchswipeMongo?: Cache };
const cache: Cache = globalForMongoose.__pitchswipeMongo ?? { conn: null, promise: null };
globalForMongoose.__pitchswipeMongo = cache;

/**
 * Connects to MongoDB on first call. Server-only. Never called at import time,
 * so the models compile without a live database.
 */
export async function connectDb(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set. Copy .env.example to .env.local and fill it in.");
  }

  cache.promise ??= mongoose.connect(uri, { bufferCommands: false });
  try {
    cache.conn = await cache.promise;
  } catch (error) {
    cache.promise = null;
    throw error;
  }
  return cache.conn;
}
