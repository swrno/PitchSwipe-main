/**
 * Who may do what with a product (server only). `productAccess` is the single rule behind every product, deck,
 * results, insights, ask and export read: the owner, or an ACTIVE co-founder, and nobody else. An invite that has not
 * been accepted, or a member who was removed, gets null. Never pass an id taken from a request body or query as `uid`:
 * it is always the signed-in founder from resolveOwnerId.
 */
import { getStore, type Store } from "./store";
import type { ProductAccess } from "../members";

export type { ProductAccess };

export async function productAccess(uid: string, productId: string, store?: Store): Promise<ProductAccess> {
  if (!uid || !productId) return null;
  return (store ?? (await getStore())).productAccess(uid, productId);
}
