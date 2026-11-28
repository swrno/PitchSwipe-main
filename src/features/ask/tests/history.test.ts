// Saved chats (the service the /api/chat/history routes call; the route files themselves need Next and are not loaded here): owner-only access, another uid gets "not found", the 60-message cap, guests not saved, no signatures stored.
// In-memory chat store: no MongoDB, no network.
import assert from "node:assert/strict";
import { describe, it } from "node:test";

delete process.env.MONGODB_URI;

const h = await import("../server/history");
const { createMemoryChatStore } = await import("../server/history-memory");

const store = createMemoryChatStore();
h.setChatStoreForTests(store);

const A = "user-a";
const B = "user-b";
const CHAT = "chat-aaaaaaaa";
const user = (id: string, text: string) => ({ id, role: "user", parts: [{ type: "text", text }] });
const assistant = (id: string, text: string) => ({ id, role: "assistant", parts: [{ type: "text", text }] });

describe("saving a turn", () => {
  it("saves under the signed-in uid with a title from the first user message", async () => {
    const long = "How many products do I have and which of them has the most live tests right now?";
    assert.equal(await h.saveTurn({ uid: A, chatId: CHAT, sent: [user("u1", long)], response: assistant("a1", "You have some.") }), "saved");
    const chat = await h.getChat(A, CHAT);
    assert.ok(chat);
    assert.ok(chat.title.length <= 60 && chat.title.endsWith("…"));
    assert.deepEqual(chat.messages.map((m) => m.id), ["u1", "a1"]);
  });

  it("a later turn keeps earlier messages (the browser only sends recent text) and the first title", async () => {
    await h.saveTurn({ uid: A, chatId: CHAT, sent: [user("u1", "How many products do I have and which of them has the most live tests right now?"), assistant("a1", "stripped"), user("u2", "And tests?")], response: assistant("a2", "Ten.") });
    const chat = await h.getChat(A, CHAT);
    assert.deepEqual(chat?.messages.map((m) => m.id), ["u1", "a1", "u2", "a2"]);
    assert.equal((chat?.messages[1].parts[0] as { text: string }).text, "You have some.");
    assert.match(chat?.title ?? "", /^How many products/);
  });

  it("keeps tool cards of a continued message and never stores approval signatures or unsettled calls", async () => {
    const id = "chat-bbbbbbbb";
    await h.saveTurn({
      uid: A,
      chatId: id,
      sent: [user("u1", "Create a product called X")],
      response: { id: "a1", role: "assistant", parts: [{ type: "tool-list_products", toolCallId: "t1", state: "output-available", output: { card: { kind: "kpiRow", items: [] } } }, { type: "tool-create_product", toolCallId: "t2", state: "approval-requested", approval: { id: "p", signature: "SECRET" } }] },
    });
    await h.saveTurn({
      uid: A,
      chatId: id,
      sent: [user("u1", "Create a product called X"), { id: "a1", role: "assistant", parts: [{ type: "tool-create_product", toolCallId: "t2", state: "approval-responded", input: { name: "X" }, approval: { id: "p", approved: true, signature: "SECRET" } }] }],
      response: { id: "a1", role: "assistant", parts: [{ type: "tool-create_product", toolCallId: "t2", state: "output-available", output: { ok: true }, approval: { id: "p", approved: true, signature: "SECRET" } }, { type: "text", text: "Done." }] },
    });
    const chat = await h.getChat(A, id);
    const parts = chat?.messages[1].parts as { type: string; toolCallId?: string; state?: string }[];
    assert.deepEqual(parts.map((p) => `${p.type}:${p.state ?? ""}`), ["tool-list_products:output-available", "tool-create_product:output-available", "text:"]);
    assert.ok(!JSON.stringify(chat).includes("SECRET"));
  });

  it("caps a chat at the last 60 messages, starting on a user turn", async () => {
    const id = "chat-cccccccc";
    const sent = Array.from({ length: 80 }, (_, i) => (i % 2 === 0 ? user(`u${i}`, `q${i}`) : assistant(`a${i}`, `r${i}`)));
    await h.saveTurn({ uid: A, chatId: id, sent, response: assistant("a80", "end") });
    const chat = await h.getChat(A, id);
    assert.ok((chat?.messages.length ?? 0) <= h.MAX_SAVED_MESSAGES);
    assert.equal(chat?.messages[0].role, "user");
    assert.equal(chat?.messages[chat.messages.length - 1].id, "a80");
  });

  it("does not save guests or bad chat ids", async () => {
    assert.equal(await h.saveTurn({ uid: "", chatId: "chat-dddddddd", sent: [user("u1", "hi")] }), "skipped");
    assert.equal(await h.saveTurn({ uid: "guest:abc", chatId: "chat-dddddddd", sent: [user("u1", "hi")] }), "skipped");
    assert.equal(await h.saveTurn({ uid: A, chatId: "../x", sent: [user("u1", "hi")] }), "skipped");
    assert.equal(await h.getChat(A, "chat-dddddddd"), null);
  });
});

describe("owner-only access", () => {
  it("another uid cannot read, list, delete or overwrite a chat", async () => {
    assert.equal(await h.getChat(B, CHAT), null, "read is not found");
    assert.deepEqual(await h.listChats(B), []);
    assert.equal(await h.deleteChat(B, CHAT), false, "delete is not found");
    assert.equal(await h.isForeignChat(B, CHAT), true);
    assert.equal(await h.isForeignChat(A, CHAT), false);
    assert.equal(await h.saveTurn({ uid: B, chatId: CHAT, sent: [user("x", "takeover")], response: assistant("y", "no") }), "foreign");
    const chat = await h.getChat(A, CHAT);
    assert.ok(!JSON.stringify(chat).includes("takeover"));
  });

  it("lists the owner's chats newest first, at most 20, with id, title and updatedAt only", async () => {
    for (let i = 0; i < 25; i++) await h.saveTurn({ uid: B, chatId: `chat-list-${String(i).padStart(3, "0")}`, sent: [user("u", `q${i}`)] });
    const list = await h.listChats(B);
    assert.equal(list.length, 20);
    assert.deepEqual(Object.keys(list[0]).sort(), ["chatId", "title", "updatedAt"]);
    assert.ok(list[0].updatedAt >= list[19].updatedAt);
  });

  it("the owner can delete their chat", async () => {
    assert.equal(await h.deleteChat(A, CHAT), true);
    assert.equal(await h.getChat(A, CHAT), null);
  });
});
