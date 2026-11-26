// Run: node --import ./scripts/register-ts.mjs --test src/lib/sites/tests/sites.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import type { ShipRecord } from "@/lib/assistant/types";

import { corsHeaders, normalizeDomain, originMatches } from "../domain";
import { createRateLimiter } from "../ratelimit";
import {
  connectSite,
  getSiteView,
  getWebsiteShipped,
  handlePing,
  handlePreflight,
  type Catalog,
  type DeckContext,
  type DeckInfo,
  type SiteDeps,
} from "../service";
import { buildSnippet, markupExample, PLACEHOLDER_KEY } from "../snippet";
import { agoLabel, applyPing, connectionState, missingFlags, parsePing, STALE_AFTER_MS } from "../status";
import { createMemorySitesStore } from "../store";

const NOW = new Date("2026-11-15T13:00:00Z");
const PUBLIC_KEY = "PUBLICclientKEY123";
const ADMIN_SECRET = "adminSECRET-do-not-leak-9f8e7d";

describe("snippet", () => {
  it("contains only the public key, never a secret", () => {
    process.env.FLAGSMITH_ADMIN_API_KEY = ADMIN_SECRET;
    const s = buildSnippet({ envKey: PUBLIC_KEY, siteId: "site1", baseUrl: "https://pitchswipe.app/some/path" });
    delete process.env.FLAGSMITH_ADMIN_API_KEY;
    assert.ok(s.includes(PUBLIC_KEY));
    assert.ok(!s.includes(ADMIN_SECRET));
    assert.ok(!/Api-Key|Authorization|Bearer|FLAGSMITH_ADMIN/i.test(s));
    assert.ok(s.includes("data-pitchswipe"));
    assert.ok(s.includes("https://pitchswipe.app/api/sites/ping?s=site1"));
    assert.ok(s.includes("textContent"));
  });

  it("refuses server keys and malformed input", () => {
    const ok = { siteId: "site1", baseUrl: "https://x.app" };
    assert.throws(() => buildSnippet({ ...ok, envKey: "ser.abcdefghijklmnop" }), /server key/);
    assert.throws(() => buildSnippet({ ...ok, envKey: "bad key with spaces" }));
    assert.throws(() => buildSnippet({ ...ok, envKey: '"></script><script>x' }));
    assert.throws(() => buildSnippet({ envKey: PUBLIC_KEY, siteId: "a b", baseUrl: "https://x.app" }));
    assert.throws(() => buildSnippet({ envKey: PUBLIC_KEY, siteId: "s", baseUrl: "javascript:alert(1)" }));
  });

  it("placeholder key turns the network off", () => {
    const s = buildSnippet({ envKey: PLACEHOLDER_KEY, siteId: "s", baseUrl: "https://x.app" });
    assert.ok(s.includes("live: false"));
  });

  it("markup example escapes text", () => {
    const m = markupExample([{ flagName: "deck_a", text: "A <b> & c", tag: "h1" }]);
    assert.ok(m.includes('data-pitchswipe="deck_a"'));
    assert.ok(m.includes("A &lt;b&gt; &amp; c"));
  });

  it("demo site embeds exactly the generated snippet", () => {
    const html = readFileSync(new URL("../../../../docs/marketing/demo-site/voice-khata/index.html", import.meta.url), "utf8");
    const expected = buildSnippet({ envKey: PLACEHOLDER_KEY, siteId: "site-voice-khata", baseUrl: "https://pitchswipe.example" });
    assert.ok(html.includes(expected), "demo-site snippet is out of date; regenerate it from src/lib/sites/snippet.ts");
  });
});

describe("domain and origin", () => {
  it("normalizes addresses", () => {
    assert.equal(normalizeDomain("https://Voice-Khata.vercel.app/pricing?x=1"), "voice-khata.vercel.app");
    assert.equal(normalizeDomain("www.example.com"), "example.com");
    assert.equal(normalizeDomain("localhost:3000"), "localhost");
    assert.equal(normalizeDomain("not a domain"), null);
    assert.equal(normalizeDomain("https://user:pw@evil.com"), null);
    assert.equal(normalizeDomain(""), null);
    assert.equal(normalizeDomain(42), null);
  });

  it("matches only the registered origin", () => {
    assert.ok(originMatches("https://voice-khata.vercel.app", "voice-khata.vercel.app"));
    assert.ok(originMatches("https://www.voice-khata.vercel.app", "voice-khata.vercel.app"));
    assert.ok(originMatches("http://localhost:5173", "localhost"));
    assert.ok(!originMatches("https://evil.com", "voice-khata.vercel.app"));
    assert.ok(!originMatches("https://voice-khata.vercel.app.evil.com", "voice-khata.vercel.app"));
    assert.ok(!originMatches("https://evilvoice-khata.vercel.app", "voice-khata.vercel.app"));
    assert.ok(!originMatches("null", "voice-khata.vercel.app"));
    assert.ok(!originMatches(null, "voice-khata.vercel.app"));
  });

  it("CORS opens for the registered origin only", () => {
    assert.equal(corsHeaders("https://voice-khata.vercel.app", "voice-khata.vercel.app")["access-control-allow-origin"], "https://voice-khata.vercel.app");
    assert.deepEqual(corsHeaders("https://evil.com", "voice-khata.vercel.app"), {});
  });
});

describe("status transitions", () => {
  const base = { lastSeenAt: null as string | null, elements: [] as { flagName: string; currentValue: string }[] };
  it("waiting, not found, connected, stale", () => {
    assert.equal(connectionState(null, NOW), "waiting");
    assert.equal(connectionState(base, NOW), "waiting");
    assert.equal(connectionState({ ...base, lastSeenAt: NOW.toISOString() }, NOW), "element_not_found");
    const el = [{ flagName: "deck_a", currentValue: "x" }];
    assert.equal(connectionState({ lastSeenAt: NOW.toISOString(), elements: el }, NOW), "connected");
    const old = new Date(NOW.getTime() - STALE_AFTER_MS - 1000).toISOString();
    assert.equal(connectionState({ lastSeenAt: old, elements: el }, NOW), "waiting");
  });

  it("missing flags", () => {
    assert.deepEqual(missingFlags({ elements: [{ flagName: "a", currentValue: "" }] }, ["a", "b"]), ["b"]);
    assert.deepEqual(missingFlags(null, ["a"]), ["a"]);
  });

  it("agoLabel", () => {
    assert.equal(agoLabel(new Date(NOW.getTime() - 2 * 60_000).toISOString(), NOW), "2 min ago");
    assert.equal(agoLabel(NOW.toISOString(), NOW), "just now");
    assert.equal(agoLabel(null, NOW), "never");
  });

  it("parsePing drops bad elements and caps input", () => {
    const p = parsePing(JSON.stringify({ elements: [{ flag: "deck_a", value: "Hi\u0000 there" }, { flag: "bad flag!", value: "x" }, { flag: "deck_b" }, null] }));
    assert.deepEqual(p?.elements, [
      { flagName: "deck_a", currentValue: "Hi there" },
      { flagName: "deck_b", currentValue: "" },
    ]);
    assert.equal(parsePing("{not json"), null);
    assert.equal(parsePing(JSON.stringify({ nope: 1 })), null);
    assert.equal(parsePing("x".repeat(9000)), null);
    const long = parsePing({ elements: [{ flag: "a", value: "y".repeat(2000) }] });
    assert.equal(long?.elements[0].currentValue.length, 500);
  });

  it("applyPing stamps last seen", () => {
    const next = applyPing({ id: "1", productId: "p", domain: "d.com", lastSeenAt: null, elements: [] }, { elements: [] }, NOW);
    assert.equal(next.lastSeenAt, NOW.toISOString());
  });
});

describe("rate limiter", () => {
  it("allows the limit then blocks, then resets", () => {
    const rl = createRateLimiter({ limit: 2, windowMs: 1000 });
    assert.ok(rl.take("a", 0));
    assert.ok(rl.take("a", 10));
    assert.ok(!rl.take("a", 20));
    assert.ok(rl.take("b", 20));
    assert.ok(rl.take("a", 1500));
  });
});

/* ---------------------------- service with fakes ---------------------------- */

const DECKS: DeckInfo[] = [
  { id: "d1", flagName: "deck_vk-headline", variable: "headline", status: "live", text: "Speak your sales." },
  { id: "d2", flagName: "deck_vk-price", variable: "price", status: "shipped", text: "Rs 299 / mo" },
  { id: "d3", flagName: "deck_vk-ui", variable: "productUI", status: "live" },
];

function makeDeps(over: Partial<SiteDeps> = {}, ship: ShipRecord | null = null): SiteDeps {
  const ctx: DeckContext = {
    deckId: "d1",
    productId: "p1",
    productName: "Voice Khata",
    noun: "headline",
    flagName: "deck_vk-headline",
    controlKey: "A",
    cards: [
      { key: "A", text: "Speak your sales." },
      { key: "B", text: "Stop chasing payments." },
    ],
    shared: { description: "Desc", reward: "Reward", price: "Rs 299 / mo" },
  };
  const catalog: Catalog = {
    async getProduct(owner, id) {
      return owner === "owner" && id === "p1" ? { id: "p1", name: "Voice Khata" } : null;
    },
    async listProductDecks(owner, id) {
      return owner === "owner" && id === "p1" ? DECKS : [];
    },
    async getDeckContext(owner, id) {
      return owner === "owner" && id === "d1" ? ctx : null;
    },
  };
  return { sites: createMemorySitesStore(), catalog, getShip: async () => ship, demo: false, envKey: PUBLIC_KEY, now: () => NOW, ...over };
}

const limiters = () => ({ perIp: createRateLimiter({ limit: 100, windowMs: 60_000 }), perSite: createRateLimiter({ limit: 100, windowMs: 60_000 }) });
const pingBody = (flags: string[]) => JSON.stringify({ elements: flags.map((flag) => ({ flag, value: `shows ${flag}` })) });

describe("connect and view", () => {
  it("only the product owner can connect; domain is validated", async () => {
    const deps = makeDeps();
    assert.equal((await connectSite(deps, { ownerId: "other", productId: "p1", domain: "a.com" })).ok, false);
    const bad = await connectSite(deps, { ownerId: "owner", productId: "p1", domain: "no spaces allowed" });
    assert.ok(!bad.ok && bad.status === 400);
    const ok = await connectSite(deps, { ownerId: "owner", productId: "p1", domain: "https://Voice-Khata.vercel.app/" });
    assert.ok(ok.ok && ok.value.domain === "voice-khata.vercel.app");
  });

  it("view goes waiting -> connected -> element not found", async () => {
    const deps = makeDeps();
    const view0 = await getSiteView(deps, { ownerId: "owner", productId: "p1", baseUrl: "https://app.test" });
    assert.ok(view0.ok && view0.value.state === "waiting" && view0.value.snippet === null);

    const created = await connectSite(deps, { ownerId: "owner", productId: "p1", domain: "vk.app" });
    assert.ok(created.ok);
    const id = created.ok ? created.value.id : "";
    const waiting = await getSiteView(deps, { ownerId: "owner", productId: "p1", baseUrl: "https://app.test" });
    assert.ok(waiting.ok && waiting.value.state === "waiting" && waiting.value.snippet?.includes(PUBLIC_KEY));

    const res = await handlePing(deps, limiters(), { siteId: id, origin: "https://vk.app", ip: "1.1.1.1", body: pingBody(["deck_vk-headline", "deck_vk-price"]) });
    assert.equal(res.status, 204);
    assert.equal(res.headers["access-control-allow-origin"], "https://vk.app");
    const connected = await getSiteView(deps, { ownerId: "owner", productId: "p1", baseUrl: "https://app.test" });
    assert.ok(connected.ok);
    if (connected.ok) {
      assert.equal(connected.value.state, "connected");
      assert.equal(connected.value.elementsFound, 2);
      assert.deepEqual(connected.value.missingFlags, []);
      assert.equal(connected.value.rows.length, 2);
      assert.equal(connected.value.rows[0].badge, "Testing now");
      assert.equal(connected.value.rows[1].badge, "Won, already live");
      assert.equal(connected.value.rows[0].showing, "shows deck_vk-headline");
    }

    await handlePing(deps, limiters(), { siteId: id, origin: "https://vk.app", ip: "1.1.1.1", body: pingBody([]) });
    const none = await getSiteView(deps, { ownerId: "owner", productId: "p1", baseUrl: "https://app.test" });
    assert.ok(none.ok && none.value.state === "element_not_found" && none.value.missingFlags.length === 2);
  });

  it("changing the domain resets what was seen", async () => {
    const deps = makeDeps();
    const a = await connectSite(deps, { ownerId: "owner", productId: "p1", domain: "a.com" });
    const id = a.ok ? a.value.id : "";
    await handlePing(deps, limiters(), { siteId: id, origin: "https://a.com", ip: "1", body: pingBody(["deck_vk-headline"]) });
    const b = await connectSite(deps, { ownerId: "owner", productId: "p1", domain: "b.com" });
    assert.ok(b.ok && b.value.id === id && b.value.lastSeenAt === null && b.value.elements.length === 0);
  });
});

describe("ping endpoint rules", () => {
  async function setup() {
    const deps = makeDeps();
    const c = await connectSite(deps, { ownerId: "owner", productId: "p1", domain: "vk.app" });
    return { deps, id: c.ok ? c.value.id : "" };
  }

  it("rejects wrong or missing origin without CORS headers, and stores nothing", async () => {
    const { deps, id } = await setup();
    for (const origin of ["https://evil.com", null, "null"]) {
      const r = await handlePing(deps, limiters(), { siteId: id, origin, ip: "1", body: pingBody(["deck_vk-headline"]) });
      assert.equal(r.status, 403);
      assert.deepEqual(r.headers, {});
    }
    assert.equal((await deps.sites.getById(id))?.lastSeenAt, null);
  });

  it("404 for unknown or malformed site id; 400 for junk body; 413 for large body", async () => {
    const { deps, id } = await setup();
    assert.equal((await handlePing(deps, limiters(), { siteId: "nope", origin: "https://vk.app", ip: "1", body: "{}" })).status, 404);
    assert.equal((await handlePing(deps, limiters(), { siteId: "../x", origin: "https://vk.app", ip: "1", body: "{}" })).status, 404);
    assert.equal((await handlePing(deps, limiters(), { siteId: null, origin: "https://vk.app", ip: "1", body: "{}" })).status, 404);
    assert.equal((await handlePing(deps, limiters(), { siteId: id, origin: "https://vk.app", ip: "1", body: "junk" })).status, 400);
    assert.equal((await handlePing(deps, limiters(), { siteId: id, origin: "https://vk.app", ip: "1", body: "x".repeat(9000) })).status, 413);
  });

  it("rate limits per IP", async () => {
    const { deps, id } = await setup();
    const l = { perIp: createRateLimiter({ limit: 2, windowMs: 60_000 }), perSite: createRateLimiter({ limit: 100, windowMs: 60_000 }) };
    const send = () => handlePing(deps, l, { siteId: id, origin: "https://vk.app", ip: "9.9.9.9", body: pingBody(["deck_vk-headline"]) });
    assert.equal((await send()).status, 204);
    assert.equal((await send()).status, 204);
    const blocked = await send();
    assert.equal(blocked.status, 429);
    assert.ok(blocked.headers["retry-after"]);
  });

  it("preflight answers only the registered origin", async () => {
    const { deps, id } = await setup();
    const ok = await handlePreflight(deps, { siteId: id, origin: "https://vk.app" });
    assert.equal(ok.status, 204);
    assert.equal(ok.headers["access-control-allow-origin"], "https://vk.app");
    assert.equal((await handlePreflight(deps, { siteId: id, origin: "https://evil.com" })).status, 403);
  });
});

describe("before / after view", () => {
  const ship = (over: Partial<ShipRecord> = {}): ShipRecord => ({
    deckId: "d1",
    ownerId: "owner",
    winnerKey: "B",
    approvedBy: "Arjun",
    approvedAt: "2026-11-15T12:42:00Z",
    chances: [],
    weights: { A: 0, B: 100 },
    previousSnapshot: null,
    completeResponse: null,
    completeConfirmed: true,
    simulated: false,
    ...over,
  });

  it("404 until shipped, and for other owners", async () => {
    assert.equal((await getWebsiteShipped(makeDeps(), { ownerId: "owner", deckId: "d1" })).ok, false);
    assert.equal((await getWebsiteShipped(makeDeps({}, ship()), { ownerId: "other", deckId: "d1" })).ok, false);
  });

  it("proof comes from what the snippet reported", async () => {
    const deps = makeDeps({}, ship());
    const c = await connectSite(deps, { ownerId: "owner", productId: "p1", domain: "vk.app" });
    const id = c.ok ? c.value.id : "";
    const before = await getWebsiteShipped(deps, { ownerId: "owner", deckId: "d1" });
    assert.ok(before.ok && before.value.proof === null && before.value.beforeText === "Speak your sales." && before.value.afterText === "Stop chasing payments.");

    await handlePing(deps, limiters(), {
      siteId: id,
      origin: "https://vk.app",
      ip: "1",
      body: JSON.stringify({ elements: [{ flag: "deck_vk-headline", value: "Stop chasing payments." }] }),
    });
    const after = await getWebsiteShipped(deps, { ownerId: "owner", deckId: "d1" });
    assert.ok(after.ok && after.value.proof?.matchesWinner === true && after.value.live && after.value.domain === "vk.app");
  });

  it("undone ships are not live", async () => {
    const r = await getWebsiteShipped(makeDeps({}, ship({ undoneAt: "2026-11-15T13:00:00Z" })), { ownerId: "owner", deckId: "d1" });
    assert.ok(r.ok && !r.value.live && r.value.undone);
  });
});

describe("snippet runtime (stub DOM)", () => {
  it("swaps text from the flag value, restores on undo, and pings what it found", async () => {
    const vm = await import("node:vm");
    const el = { textContent: "Speak your sales.", getAttribute: () => "deck_vk-headline" } as Record<string, unknown>;
    const pings: { url: string; body: string }[] = [];
    let flagValue = "Stop chasing payments.";
    const ctx: Record<string, unknown> = {
      document: { readyState: "complete", hidden: false, querySelectorAll: () => [el], addEventListener() {} },
      fetch: (url: string, init?: { body?: string; headers?: Record<string, string> }) => {
        if (url.includes("/api/v1/flags/")) {
          assert.equal(init?.headers?.["X-Environment-Key"], PUBLIC_KEY);
          return Promise.resolve({ ok: true, json: async () => [{ enabled: true, feature: { name: "deck_vk-headline" }, feature_state_value: flagValue }] });
        }
        pings.push({ url, body: init?.body ?? "" });
        return Promise.resolve({ ok: true });
      },
      setInterval: () => 0,
      JSON,
      String,
    };
    ctx.window = ctx;
    vm.runInNewContext(buildSnippet({ envKey: PUBLIC_KEY, siteId: "s1", baseUrl: "https://app.test" }).replace(/^<script>|<\/script>$/g, ""), ctx);
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(el.textContent, "Stop chasing payments.");
    assert.equal(pings.length, 1);
    assert.deepEqual(JSON.parse(pings[0].body), { elements: [{ flag: "deck_vk-headline", value: "Stop chasing payments." }] });
    // Undo: the flag holds the old text again.
    flagValue = "Speak your sales.";
    (ctx.pitchswipe as { refresh(): void }).refresh();
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(el.textContent, "Speak your sales.");
    assert.equal(pings.length, 2);
  });
});
