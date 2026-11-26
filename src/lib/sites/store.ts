/**
 * `sites` storage port (server only). Adapters:
 *  - memory: demo mode (MONGODB_URI unset), state on globalThis
 *  - mongo: the WP0 `Site` model (productId, domain, lastSeenAt, elements[]); no fields added
 */
import type { SiteRecord } from "./types";

export interface SitesStore {
  getById(id: string): Promise<SiteRecord | null>;
  getByProduct(productId: string): Promise<SiteRecord | null>;
  /** Creates (no id yet) or replaces by id. Returns the stored record. */
  save(site: Omit<SiteRecord, "id"> & { id?: string }): Promise<SiteRecord>;
}

const g = globalThis as unknown as { __pitchswipeSites?: Map<string, SiteRecord> };

export function createMemorySitesStore(shared = false): SitesStore {
  const rows = shared ? (g.__pitchswipeSites ??= new Map()) : new Map<string, SiteRecord>();
  let seq = 1;
  return {
    async getById(id) {
      const s = rows.get(id);
      return s ? structuredClone(s) : null;
    },
    async getByProduct(productId) {
      for (const s of rows.values()) if (s.productId === productId) return structuredClone(s);
      return null;
    },
    async save(site) {
      const id = site.id ?? `site-${Date.now().toString(36)}-${seq++}`;
      const rec: SiteRecord = { ...structuredClone(site), id };
      rows.set(id, rec);
      return structuredClone(rec);
    },
  };
}

type Row = {
  _id: unknown;
  productId: unknown;
  domain: string;
  lastSeenAt?: Date | null;
  elements?: { flagName: string; currentValue?: string }[];
};

function fromRow(r: Row): SiteRecord {
  return {
    id: String(r._id),
    productId: String(r.productId),
    domain: r.domain,
    lastSeenAt: r.lastSeenAt ? new Date(r.lastSeenAt).toISOString() : null,
    elements: (r.elements ?? []).map((e) => ({ flagName: e.flagName, currentValue: e.currentValue ?? "" })),
  };
}

export function createMongoSitesStore(): SitesStore {
  async function model() {
    const { isValidObjectId } = await import("mongoose");
    const { connectDb } = await import("@/lib/db");
    const { Site } = await import("@/models");
    await connectDb();
    return { Site, isValidObjectId };
  }
  const toDoc = (s: Omit<SiteRecord, "id">) => ({
    productId: s.productId,
    domain: s.domain,
    lastSeenAt: s.lastSeenAt ? new Date(s.lastSeenAt) : undefined,
    elements: s.elements,
  });
  return {
    async getById(id) {
      const { Site, isValidObjectId } = await model();
      if (!isValidObjectId(id)) return null;
      const r = (await Site.findById(id).lean()) as unknown as Row | null;
      return r ? fromRow(r) : null;
    },
    async getByProduct(productId) {
      const { Site, isValidObjectId } = await model();
      if (!isValidObjectId(productId)) return null;
      const r = (await Site.findOne({ productId }).lean()) as unknown as Row | null;
      return r ? fromRow(r) : null;
    },
    async save(site) {
      const { Site, isValidObjectId } = await model();
      if (site.id && isValidObjectId(site.id)) {
        const r = (await Site.findByIdAndUpdate(site.id, { $set: toDoc(site), ...(site.lastSeenAt ? {} : { $unset: { lastSeenAt: 1 } }) }, { new: true }).lean()) as unknown as Row | null;
        if (r) return fromRow(r);
      }
      const created = await Site.create(toDoc(site));
      return fromRow(created.toObject() as unknown as Row);
    },
  };
}

let cached: SitesStore | undefined;

export function getSitesStore(): SitesStore {
  cached ??= process.env.MONGODB_URI ? createMongoSitesStore() : createMemorySitesStore(true);
  return cached;
}
