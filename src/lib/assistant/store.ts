/**
 * Assistant storage port (server only). Adapters:
 *  - memory: demo mode (MONGODB_URI unset), state on globalThis
 *  - mongo: `assistantEvents` through the WP0 model; alert and ship records in two small
 *    collections (`assistantAlerts`, `assistantShips`) because the WP0 model has no fields
 *    for them. Alerts double as the in-app notifications.
 */
import type { AlertRecord, EventRow, ShipRecord } from "./types";

export interface AssistantStore {
  getAlert(deckId: string): Promise<AlertRecord | null>;
  saveAlert(alert: AlertRecord): Promise<void>;
  listAlerts(ownerId: string): Promise<AlertRecord[]>;
  getShip(deckId: string): Promise<ShipRecord | null>;
  saveShip(ship: ShipRecord): Promise<void>;
  addEvent(event: EventRow): Promise<void>;
  /** Latest "checked" event, for "last check 2 min ago: 91%". */
  lastCheck(deckId: string): Promise<EventRow | null>;
}

interface Mem {
  alerts: Map<string, AlertRecord>;
  ships: Map<string, ShipRecord>;
  events: EventRow[];
}

const g = globalThis as unknown as { __pitchswipeAssistant?: Mem };

export function createMemoryAssistantStore(shared = false): AssistantStore {
  const mem: Mem = shared
    ? (g.__pitchswipeAssistant ??= { alerts: new Map(), ships: new Map(), events: [] })
    : { alerts: new Map(), ships: new Map(), events: [] };
  return {
    async getAlert(id) {
      const a = mem.alerts.get(id);
      return a ? structuredClone(a) : null;
    },
    async saveAlert(a) {
      mem.alerts.set(a.deckId, structuredClone(a));
    },
    async listAlerts(ownerId) {
      return [...mem.alerts.values()].filter((a) => a.ownerId === ownerId).map((a) => structuredClone(a));
    },
    async getShip(id) {
      const s = mem.ships.get(id);
      return s ? structuredClone(s) : null;
    },
    async saveShip(s) {
      mem.ships.set(s.deckId, structuredClone(s));
    },
    async addEvent(e) {
      mem.events.push(structuredClone(e));
    },
    async lastCheck(id) {
      for (let i = mem.events.length - 1; i >= 0; i--) {
        if (mem.events[i].deckId === id && mem.events[i].type === "checked") return structuredClone(mem.events[i]);
      }
      return null;
    },
  };
}

export function createMongoAssistantStore(): AssistantStore {
  async function db() {
    const { connectDb } = await import("@/lib/db");
    const mongoose = await connectDb();
    const handle = mongoose.connection.db;
    if (!handle) throw new Error("MongoDB connection has no database handle");
    return handle;
  }
  const alerts = async () => (await db()).collection<AlertRecord & { _id: string }>("assistantAlerts");
  const ships = async () => (await db()).collection<ShipRecord & { _id: string }>("assistantShips");
  const strip = <T extends { _id?: unknown }>(doc: T | null): Omit<T, "_id"> | null => {
    if (!doc) return null;
    const { _id, ...rest } = doc;
    void _id;
    return rest;
  };

  return {
    async getAlert(id) {
      return strip(await (await alerts()).findOne({ _id: id })) as AlertRecord | null;
    },
    async saveAlert(a) {
      await (await alerts()).replaceOne({ _id: a.deckId }, { ...a }, { upsert: true });
    },
    async listAlerts(ownerId) {
      const rows = await (await alerts()).find({ ownerId }).toArray();
      return rows.map((r) => strip(r) as AlertRecord);
    },
    async getShip(id) {
      return strip(await (await ships()).findOne({ _id: id })) as ShipRecord | null;
    },
    async saveShip(s) {
      await (await ships()).replaceOne({ _id: s.deckId }, { ...s }, { upsert: true });
    },
    async addEvent(e) {
      const { Types, isValidObjectId } = await import("mongoose");
      const { AssistantEvent } = await import("@/models");
      await db();
      if (!isValidObjectId(e.deckId)) return;
      await AssistantEvent.create({
        deckId: e.deckId,
        type: e.type,
        chanceBest: e.chances.filter((c) => isValidObjectId(c.cardId)).map((c) => ({ cardId: new Types.ObjectId(c.cardId), chance: c.chance })),
        swipers: e.swipers,
        checksPassed: e.checksPassed,
        createdAt: new Date(e.at),
      });
    },
    async lastCheck(id) {
      const { isValidObjectId } = await import("mongoose");
      const { AssistantEvent } = await import("@/models");
      await db();
      if (!isValidObjectId(id)) return null;
      const row = (await AssistantEvent.findOne({ deckId: id, type: "checked" }).sort({ createdAt: -1 }).lean()) as unknown as {
        chanceBest?: { cardId: unknown; chance: number }[];
        swipers?: number;
        checksPassed?: boolean;
        createdAt: Date;
      } | null;
      if (!row) return null;
      return {
        deckId: id,
        type: "checked",
        chances: (row.chanceBest ?? []).map((c) => ({ cardId: String(c.cardId), key: "", chance: c.chance })),
        swipers: row.swipers ?? 0,
        checksPassed: row.checksPassed === true,
        at: new Date(row.createdAt).toISOString(),
      };
    },
  };
}

let cached: AssistantStore | undefined;

export function getAssistantStore(): AssistantStore {
  cached ??= process.env.MONGODB_URI ? createMongoAssistantStore() : createMemoryAssistantStore(true);
  return cached;
}
