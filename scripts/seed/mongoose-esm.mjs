// Test-only shim: Node's ESM-from-CJS interop does not expose `models` from mongoose, which
// src/models/index.ts imports by name. Re-export the default object's members instead.
import mongoose from "mongoose";

// Types and isValidObjectId: the Mongo store adapters (scripts/tests/mongo-stores.integration.mjs).
export const { Schema, model, models, Types, isValidObjectId } = mongoose;
export default mongoose;
