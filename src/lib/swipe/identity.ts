/**
 * Swiper identity keys (server only). A key is always namespaced so a client-supplied string can never
 * be mistaken for a user id:
 *  - "u:<24-hex user _id>" only for a Firebase-verified uid that maps to a user row;
 *  - "g:<guid>" for guests and link visitors (the guid is client-chosen and untrusted).
 */
import { createHash } from "node:crypto";

const USER_ID = /^[0-9a-f]{24}$/i;
const GUID = /^[A-Za-z0-9_-]{8,64}$/;

/** Key for a signed-in swiper whose Firebase uid resolved to a user row. */
export function userKey(userId: string): string {
  return `u:${userId}`;
}

/** Key for a guest. Whatever the guid looks like, it is namespaced and never maps to a user. */
export function guestKey(guid: string): string {
  return `g:${guid}`;
}

/** The user ObjectId hex for a "u:" key, else undefined (guests and anything unprefixed). */
export function parseUserKey(key: string): string | undefined {
  if (!key.startsWith("u:")) return undefined;
  const id = key.slice(2);
  return USER_ID.test(id) ? id.toLowerCase() : undefined;
}

/**
 * The 24-hex Mongo `swiperId` for a key. Only a "u:<user _id>" key maps to that user; every other key
 * (guests, whatever the guid looks like) is hashed into a separate namespace.
 */
export function swiperIdHex(key: string): string {
  const userId = parseUserKey(key);
  if (userId) return userId;
  return createHash("sha256").update(`guest:${key}`).digest("hex").slice(0, 24);
}

/** A guest guid: 8-64 URL-safe characters, and not shaped like a Mongo ObjectId. */
export function isValidGuid(value: unknown): value is string {
  return typeof value === "string" && GUID.test(value) && !USER_ID.test(value);
}
