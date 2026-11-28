// Co-founders: access rules and the invite flow on the in-memory store double. No MongoDB, no network.
import test from "node:test";
import assert from "node:assert/strict";

delete process.env.MONGODB_URI;
const svc = await import("../server/service.ts");
const team = await import("../server/members.ts");
const { productAccess } = await import("../server/access.ts");
const { createMemoryStore } = await import("../server/store-memory.ts");
const { setStoreForTests } = await import("../server/store.ts");
const { hashInviteToken, INVITE_TTL_MS } = await import("../members.ts");

const store = createMemoryStore();
setStoreForTests(store);

const OWNER = "owner-1";
const FRIEND = "friend-1";
const STRANGER = "stranger-1";
const product = await svc.createProduct(OWNER, { name: "QueueLess", industry: "Healthcare", targetUsers: ["Doctor"] });
if (!product.ok) throw new Error("product");
const PID = product.value.id;
const deckBody = (over = {}) => ({
  productId: PID,
  variable: "headline",
  question: "Would you pay Rs 99 a month?",
  positiveLabel: "Yes",
  negativeLabel: "No",
  shared: { description: "Book a clinic slot.", reward: "Free month", price: "Rs 99 / mo" },
  cards: [{ variantKey: "A", value: "Skip the queue." }, { variantKey: "B", value: "See the doctor on time." }],
  ...over,
});
const deck = await svc.createDeck(OWNER, deckBody());
if (!deck.ok) throw new Error("deck");
const DID = deck.value._id;

const baseUrl = "https://example.test";
async function invite(email, now) {
  const r = await team.inviteMember(OWNER, PID, { email }, { baseUrl, now });
  assert.ok(r.ok, r.ok ? "" : r.error);
  return { member: r.value.member, token: r.value.inviteUrl.split("/invite/")[1], url: r.value.inviteUrl };
}
const acceptor = (uid, email, over = {}) => ({ uid, email, emailVerified: true, ...over });
async function join(uid, email) {
  const { token } = await invite(email);
  const r = await team.acceptInvite(acceptor(uid, email), token);
  assert.ok(r.ok);
}

test("a non-member cannot read the product, its decks or its list", async () => {
  assert.equal(await productAccess(STRANGER, PID), null);
  assert.equal((await svc.getProduct(STRANGER, PID)).ok, false);
  assert.equal((await svc.getDeck(STRANGER, DID)).ok, false);
  assert.deepEqual(await svc.listDecks(STRANGER), []);
  assert.deepEqual((await svc.getOverview(STRANGER)).products, []);
  assert.deepEqual(await store.deckStats(STRANGER, [DID]), { [DID]: { swipers: 0, waitlist: 0 } });
  assert.equal((await team.listMembers(STRANGER, PID)).ok, false);
});

test("the owner has access", async () => {
  assert.equal(await productAccess(OWNER, PID), "owner");
  assert.equal((await svc.getDeck(OWNER, DID)).ok, true);
});

test("an invited, not yet accepted person cannot read anything", async () => {
  const { token } = await invite("friend@example.com");
  assert.ok(token);
  assert.equal(await productAccess(FRIEND, PID), null);
  assert.equal((await svc.getProduct(FRIEND, PID)).ok, false);
  assert.equal((await svc.getDeck(FRIEND, DID)).ok, false);
  assert.deepEqual(await svc.listProducts(FRIEND), []);
});

test("an active co-founder reads and works on the product and its decks, with the owner's ownerId kept", async () => {
  const { token } = await invite("Friend@Example.com"); // re-invite refreshes the token; email is lowercased
  const accepted = await team.acceptInvite(acceptor(FRIEND, "friend@example.com"), token);
  assert.deepEqual(accepted.ok && accepted.value, { productId: PID });
  assert.equal(await productAccess(FRIEND, PID), "cofounder");
  assert.equal((await svc.getProduct(FRIEND, PID)).ok, true);
  assert.equal((await svc.getDeck(FRIEND, DID)).ok, true);
  assert.deepEqual((await svc.listProducts(FRIEND)).map((p) => p.id), [PID]);
  const overview = await svc.getOverview(FRIEND);
  assert.equal(overview.products[0].role, "cofounder");
  assert.equal(overview.products[0].decks.length, 1);
  assert.equal((await store.deckStats(FRIEND, [DID]))[DID].swipers, 0);

  // Create, edit and publish a deck as the co-founder.
  const made = await svc.createDeck(FRIEND, deckBody());
  assert.ok(made.ok);
  assert.equal(made.value.ownerId, OWNER);
  assert.equal((await svc.getDeck(OWNER, made.value._id)).ok, true);
  const edited = await svc.patchDeck(FRIEND, made.value._id, { question: "Would you pay Rs 149 a month?" });
  assert.ok(edited.ok && edited.value.question.includes("149"));
  assert.equal((await svc.listDecks(OWNER)).length, 2);
});

test("a co-founder cannot reach a product they were not invited to, or move a deck there", async () => {
  const other = await svc.createProduct(STRANGER, { name: "Other", industry: "Healthcare", targetUsers: ["Doctor"] });
  assert.ok(other.ok);
  assert.equal((await svc.getProduct(FRIEND, other.value.id)).ok, false);
  const bad = await svc.createDeck(FRIEND, deckBody({ productId: other.value.id }));
  assert.equal(bad.ok, false);
  const moved = await svc.patchDeck(FRIEND, DID, { productId: other.value.id });
  assert.equal(moved.ok, false);
});

test("a co-founder cannot manage members, change product settings or delete another person's access", async () => {
  const inv = await team.inviteMember(FRIEND, PID, { email: "x@example.com" }, { baseUrl });
  assert.deepEqual(inv.ok === false && inv.status, 403);
  const members = await team.listMembers(FRIEND, PID);
  assert.ok(members.ok);
  assert.equal(members.value.role, "cofounder");
  const m = members.value.members[0];
  assert.ok(m);
  assert.equal("tokenHash" in m, false);
  const rm = await team.removeMember(FRIEND, PID, m.id);
  assert.equal(rm.ok === false && rm.status, 403);
  assert.equal((await team.listMembers(OWNER, PID)).value.members.length, 1);
  assert.equal((await svc.updateProduct(FRIEND, PID, { name: "Hijacked", industry: "Healthcare", targetUsers: ["Doctor"] })).ok, false);
  assert.equal((await svc.getProduct(OWNER, PID)).value.name, "QueueLess");
  assert.equal(await store.updateProduct(FRIEND, PID, { name: "Hijacked" }), null);
});

test("removing a member ends their access", async () => {
  const list = (await team.listMembers(OWNER, PID)).value.members;
  const friend = list.find((m) => m.email === "friend@example.com");
  assert.ok((await team.removeMember(OWNER, PID, friend.id)).ok);
  assert.equal(await productAccess(FRIEND, PID), null);
  assert.equal((await svc.getDeck(FRIEND, DID)).ok, false);
  assert.equal((await svc.getProduct(FRIEND, PID)).ok, false);
  assert.deepEqual(await svc.listDecks(FRIEND), []);
  assert.equal((await svc.patchDeck(FRIEND, DID, { question: "Edited after removal?" })).ok, false);
});

test("an invite token works once", async () => {
  const { token } = await invite("once@example.com");
  assert.ok((await team.acceptInvite(acceptor("u-once", "once@example.com"), token)).ok);
  const again = await team.acceptInvite(acceptor("u-other", "once@example.com"), token);
  assert.equal(again.ok === false && again.status, 404);
  assert.equal(await productAccess("u-other", PID), null);
});

test("an expired invite answers 410 and gives no access", async () => {
  const past = new Date(Date.now() - INVITE_TTL_MS - 60_000);
  const { token } = await invite("late@example.com", past);
  const r = await team.acceptInvite(acceptor("u-late", "late@example.com"), token);
  assert.equal(r.ok === false && r.status, 410);
  assert.equal(await productAccess("u-late", PID), null);
});

test("the invite stores only a hash and expires after 14 days", async () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const { token, member } = await invite("hash@example.com", now);
  const row = await store.findMemberByTokenHash(hashInviteToken(token));
  assert.ok(row);
  assert.notEqual(row.tokenHash, token);
  assert.equal(row.expiresAt.getTime() - now.getTime(), INVITE_TTL_MS);
  assert.equal(member.status, "invited");
});

test("a different or unverified email is rejected, and the invite stays usable", async () => {
  const { token } = await invite("right@example.com");
  const wrong = await team.acceptInvite(acceptor("u-wrong", "wrong@example.com"), token);
  assert.equal(wrong.ok === false && wrong.status, 403);
  const unverified = await team.acceptInvite(acceptor("u-right", "right@example.com", { emailVerified: false }), token);
  assert.equal(unverified.ok === false && unverified.status, 403);
  assert.equal(await productAccess("u-wrong", PID), null);
  assert.equal(await productAccess("u-right", PID), null);
  assert.ok((await team.acceptInvite(acceptor("u-right", "RIGHT@example.com"), token)).ok);
});

test("garbage tokens and bad emails are refused; the owner cannot accept their own invite", async () => {
  assert.equal((await team.acceptInvite(acceptor("u", "a@b.co"), "nope")).ok, false);
  assert.equal((await team.acceptInvite(acceptor("u", "a@b.co"), undefined)).ok, false);
  const bad = await team.inviteMember(OWNER, PID, { email: "not-an-email" }, { baseUrl });
  assert.equal(bad.ok === false && bad.status, 422);
  const { token } = await invite("me@example.com");
  const self = await team.acceptInvite(acceptor(OWNER, "me@example.com"), token);
  assert.equal(self.ok === false && self.status, 409);
});

test("inviting sends one email through the mailer when there is one, and survives a mailer failure", async () => {
  const sent = [];
  const ok = await team.inviteMember(OWNER, PID, { email: "mail@example.com" }, { baseUrl, mailer: { send: async (m) => void sent.push(m) } });
  assert.ok(ok.ok && ok.value.emailed);
  assert.equal(sent.length, 1);
  assert.ok(sent[0].text.includes(ok.value.inviteUrl));
  const failed = await team.inviteMember(OWNER, PID, { email: "mail2@example.com" }, { baseUrl, mailer: { send: async () => { throw new Error("down"); } } });
  assert.ok(failed.ok && !failed.value.emailed && failed.value.inviteUrl.startsWith(baseUrl));
});

test("an already active member cannot be invited again", async () => {
  await join("u-dup", "dup@example.com");
  const again = await team.inviteMember(OWNER, PID, { email: "dup@example.com" }, { baseUrl });
  assert.equal(again.ok === false && again.status, 409);
});
