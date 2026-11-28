/**
 * Saved Ask PitchSwipe chats (server only). Keyed by the signed-in uid taken from the verified token, never from the client.
 * A chatId belongs to the uid that first saved it: any other uid gets "not found". Chats keep the last 60 messages and
 * expire 90 days after the last update (TTL index on the AskChat model).
 */
import type { UIMessage } from "ai";

export const MAX_SAVED_MESSAGES = 60;
export const MAX_LIST = 20;
const TITLE_MAX = 60;
const MAX_CHAT_BYTES = 400_000;
const CHAT_ID = /^[A-Za-z0-9_-]{8,64}$/;

export const isChatId = (v: unknown): v is string => typeof v === "string" && CHAT_ID.test(v);

export interface ChatSummary {
  chatId: string;
  title: string;
  updatedAt: string;
}
export interface ChatDoc extends ChatSummary {
  messages: UIMessage[];
}

export interface ChatStore {
  list(uid: string, limit: number): Promise<ChatSummary[]>;
  get(uid: string, chatId: string): Promise<ChatDoc | null>;
  /** The uid that owns this chatId, or null when nobody saved it yet. */
  ownerOf(chatId: string): Promise<string | null>;
  /** "foreign" when the chatId belongs to another uid (nothing is written). */
  upsert(uid: string, chatId: string, data: { title: string; messages: UIMessage[] }): Promise<"ok" | "foreign">;
  remove(uid: string, chatId: string): Promise<boolean>;
}

/* Cleaning ----------------------------------------------------------------------------- */

type Part = Record<string, unknown>;
const SETTLED_TOOL_STATES = new Set(["output-available", "output-error", "output-denied", "approval-responded"]);

function cleanPart(p: Part): Part | null {
  const type = typeof p.type === "string" ? p.type : "";
  if (type === "text") return typeof p.text === "string" && p.text ? { type, text: p.text.slice(0, 4000) } : null;
  if (!type.startsWith("tool-")) return null;
  // A call that never settled (streaming, or waiting on an approval whose signature is not stored) cannot resume: leave it out.
  if (typeof p.state !== "string" || !SETTLED_TOOL_STATES.has(p.state)) return null;
  const approval = p.approval as { id?: unknown; approved?: unknown; requestReason?: unknown; reason?: unknown } | undefined;
  return {
    type,
    toolCallId: p.toolCallId,
    state: p.state,
    input: p.input,
    output: p.output,
    errorText: p.errorText,
    // Signatures are stripped: an approval is only ever answered in the live stream.
    ...(approval ? { approval: { id: approval.id, approved: approval.approved, requestReason: approval.requestReason, reason: approval.reason } } : {}),
  };
}

export function cleanForStorage(raw: unknown): UIMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: UIMessage[] = [];
  for (const m of raw) {
    const msg = m as { id?: unknown; role?: unknown; parts?: unknown };
    if ((msg.role !== "user" && msg.role !== "assistant") || !Array.isArray(msg.parts)) continue;
    const parts = (msg.parts as Part[]).map(cleanPart).filter((p): p is Part => p !== null);
    if (!parts.length) continue;
    out.push({ id: typeof msg.id === "string" && msg.id.length <= 64 ? msg.id : `m${out.length}`, role: msg.role, parts: parts as UIMessage["parts"] });
  }
  return out;
}

/** Last 60 messages, and the oldest dropped until the chat fits the size cap. Starts on a user turn. */
export function capMessages(messages: UIMessage[]): UIMessage[] {
  let list = messages.slice(-MAX_SAVED_MESSAGES);
  while (list.length > 2 && JSON.stringify(list).length > MAX_CHAT_BYTES) list = list.slice(1);
  while (list.length && list[0].role !== "user") list = list.slice(1);
  return list;
}

export function titleOf(messages: UIMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  const text = first?.parts.map((p) => (p.type === "text" ? p.text : "")).join(" ").replace(/\s+/g, " ").trim() ?? "";
  if (!text) return "New chat";
  return text.length <= TITLE_MAX ? text : `${text.slice(0, TITLE_MAX - 1).trimEnd()}…`;
}

/** Merge parts of a continued message: a tool call is replaced by id (its state moved on), other parts are added when new. */
function mergeParts(base: UIMessage["parts"], next: UIMessage["parts"]): UIMessage["parts"] {
  const out = [...base];
  for (const p of next) {
    const id = (p as { toolCallId?: string }).toolCallId;
    const at = id ? out.findIndex((q) => (q as { toolCallId?: string }).toolCallId === id) : out.findIndex((q) => q.type === "text" && p.type === "text" && q.text === p.text);
    if (at >= 0) out[at] = p;
    else out.push(p);
  }
  return out;
}

/**
 * What to store after a turn: the saved chat, plus the messages the browser sent (it only sends recent ones, and without old
 * tool cards: those keep the saved version), plus the assistant message this turn produced.
 */
export function mergeTurn(stored: UIMessage[], sent: UIMessage[], response?: UIMessage): UIMessage[] {
  const out = [...stored];
  const put = (m: UIMessage, replaceParts: boolean) => {
    const at = out.findIndex((x) => x.id === m.id);
    if (at < 0) out.push(m);
    else if (replaceParts) out[at] = { ...out[at], parts: mergeParts(out[at].parts, m.parts) };
  };
  sent.forEach((m, i) => put(m, i === sent.length - 1));
  if (response) put(response, true);
  return out;
}

/* Service -------------------------------------------------------------------------------------- */

let cached: ChatStore | undefined;

export async function getChatStore(): Promise<ChatStore> {
  if (cached) return cached;
  if (!process.env.MONGODB_URI) throw new Error("not_configured");
  cached = (await import("./history-mongo")).createMongoChatStore();
  return cached;
}

/** Tests only. */
export function setChatStoreForTests(store: ChatStore | undefined): void {
  cached = store;
}

export const listChats = async (uid: string): Promise<ChatSummary[]> => (uid ? (await getChatStore()).list(uid, MAX_LIST) : []);

export async function getChat(uid: string, chatId: string): Promise<ChatDoc | null> {
  if (!uid || !isChatId(chatId)) return null;
  return (await getChatStore()).get(uid, chatId);
}

export async function deleteChat(uid: string, chatId: string): Promise<boolean> {
  if (!uid || !isChatId(chatId)) return false;
  return (await getChatStore()).remove(uid, chatId);
}

/** True when this chatId already belongs to a different uid. */
export async function isForeignChat(uid: string, chatId: string): Promise<boolean> {
  const owner = await (await getChatStore()).ownerOf(chatId);
  return owner !== null && owner !== uid;
}

/** Saves a finished turn. Guests (no uid) and foreign chat ids are never saved. */
export async function saveTurn(input: { uid: string; chatId: string; sent: unknown; response?: unknown }): Promise<"saved" | "skipped" | "foreign"> {
  if (!input.uid || input.uid.startsWith("guest") || !isChatId(input.chatId)) return "skipped";
  const store = await getChatStore();
  const existing = await store.get(input.uid, input.chatId);
  const sent = cleanForStorage(input.sent);
  const response = cleanForStorage(input.response ? [input.response] : [])[0];
  const messages = capMessages(mergeTurn(existing?.messages ?? [], sent, response));
  if (!messages.length) return "skipped";
  const r = await store.upsert(input.uid, input.chatId, { title: existing?.title || titleOf(messages), messages });
  return r === "ok" ? "saved" : "foreign";
}

/** A restored chat for the browser: same cleaning, so nothing stale or unsigned can be resumed. */
export const forBrowser = (doc: ChatDoc): ChatDoc => ({ ...doc, messages: cleanForStorage(doc.messages) });
