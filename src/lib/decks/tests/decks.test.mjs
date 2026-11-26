// Run: node --import ./src/lib/decks/tests/register.mjs --test src/lib/decks/tests/
import test from "node:test";
import assert from "node:assert/strict";
import { validateDeck } from "../validate.ts";
import { checkDeckPatch, applyDraftPatch, lockedRows } from "../lock.ts";
import { deckStatusView, matchesFilter } from "../status.ts";
import { checkPriceLevels, parsePrice } from "../price.ts";
import { validateProduct, flagNameFor, makeDeckSlug } from "../product.ts";
import { cardCountRange, sharedKeysFor } from "../fields.ts";

const base = {
  productId: "p1",
  question: "Would you pay Rs 299 a month?",
  positiveLabel: "Yes, I would pay",
  negativeLabel: "No, I would not",
};
const headlineDeck = (over = {}) => ({
  ...base,
  variable: "headline",
  shared: { description: "Say who bought on credit.", reward: "Get 3 months free at launch", price: "Rs 299 / mo" },
  cards: [
    { variantKey: "A", value: "Speak your sales. The ledger writes itself." },
    { variantKey: "B", value: "Stop chasing payments. Get paid on time." },
    { variantKey: "C", value: "Your whole ledger for Rs 10 a day." },
  ],
  ...over,
});
const paths = (r) => r.errors.map((e) => e.path);

test("valid headline deck publishes", () => assert.equal(validateDeck(headlineDeck(), "publish").ok, true));

test("one variable per deck: the tested field cannot also be locked", () => {
  const r = validateDeck(headlineDeck({ shared: { headline: "x", description: "d", reward: "r", price: "Rs 1 / mo" } }), "publish");
  assert.ok(paths(r).includes("shared.headline"));
});

test("every other locked field is required to publish, optional in draft", () => {
  const d = headlineDeck({ shared: { description: "d" } });
  assert.ok(paths(validateDeck(d, "publish")).includes("shared.reward"));
  assert.equal(validateDeck({ ...d, cards: [] }, "draft").ok, true);
});

test("2 to 3 cards, at least two distinct versions", () => {
  assert.ok(paths(validateDeck(headlineDeck({ cards: [{ variantKey: "A", value: "only one" }] }), "publish")).includes("cards"));
  const four = ["A", "B", "C", "D"].map((k, i) => ({ variantKey: k, value: `h${i}` }));
  assert.ok(paths(validateDeck(headlineDeck({ cards: four }), "publish")).includes("cards"));
  const same = [
    { variantKey: "A", value: "Same" },
    { variantKey: "B", value: " same " },
  ];
  assert.ok(paths(validateDeck(headlineDeck({ cards: same }), "publish")).includes("cards.1.value"));
});

test("unknown variable and unknown locked key are rejected", () => {
  assert.ok(paths(validateDeck(headlineDeck({ variable: "colour" }), "draft")).includes("variable"));
  const bad = headlineDeck({ shared: { description: "d", reward: "r", price: "Rs 1", mood: "x" } });
  assert.ok(paths(validateDeck(bad, "draft")).includes("shared.mood"));
});

test("price: find the best price allows 2 to 4 prices in one unit", () => {
  const price = (values, priceMode = "level") => ({
    ...base,
    variable: "price",
    priceMode,
    shared: { headline: "Stop chasing payments.", description: "d", reward: "Get 3 months free" },
    cards: values.map((v, i) => ({ variantKey: "ABCD"[i], value: v })),
  });
  assert.equal(validateDeck(price(["Rs 99 / mo", "Rs 199 / mo", "Rs 299 / mo", "Rs 399 / mo"]), "publish").ok, true);
  assert.equal(validateDeck(price(["Rs 99 / mo", "Rs 199 / yr"]), "publish").ok, false);
  assert.equal(validateDeck(price(["Rs 99 / mo", "Rs 99 / mo"]), "publish").ok, false);
  assert.equal(validateDeck(price(["Rs 99 / mo"]), "publish").ok, false);
  assert.deepEqual(cardCountRange("price", "level"), { min: 2, max: 4 });
  // framing: same price, different wording, at most 3 cards
  assert.equal(validateDeck(price(["Rs 10 a day", "Rs 299 a month"], "framing"), "publish").ok, true);
  assert.ok(paths(validateDeck(price(["a1", "b2", "c3", "d4"], "framing"), "publish")).includes("cards"));
  assert.ok(paths(validateDeck({ ...price(["Rs 1", "Rs 2"]), priceMode: undefined }, "publish")).includes("priceMode"));
  assert.ok(paths(validateDeck(headlineDeck({ priceMode: "level" }), "draft")).includes("priceMode"));
});

test("language: whole translated card per version", () => {
  const lang = (l, over = {}) => ({
    language: l,
    headline: `h-${l}`,
    description: `d-${l}`,
    reward: `r-${l}`,
    question: `q-${l}`,
    positiveLabel: `y-${l}`,
    negativeLabel: `n-${l}`,
    ...over,
  });
  const deck = (cards) => ({
    ...base,
    variable: "language",
    shared: { price: "Rs 299 / mo" },
    cards: cards.map((v, i) => ({ variantKey: "ABC"[i], value: v })),
  });
  assert.equal(validateDeck(deck([lang("English"), lang("Hindi"), lang("Bengali")]), "publish").ok, true);
  assert.equal(validateDeck(deck([lang("English"), lang("Hindi", { reward: "" })]), "publish").ok, false);
  assert.equal(validateDeck(deck([lang("English"), lang("English")]), "publish").ok, false);
  assert.equal(validateDeck(deck([lang("English"), lang("French")]), "publish").ok, false);
  assert.deepEqual(sharedKeysFor("language"), ["price", "productUI", "logo"]);
});

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAHvZ0AQAAAABJRU5ErkJggg==";
const PNG2 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAHvZ0AQAAAABJRU5ErkJggh==";
const JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==";
const WEBP = "data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAw";

test("logo and product UI versions", () => {
  const logo = (name, src = PNG) => ({ name, src });
  const d = {
    ...base,
    variable: "logo",
    shared: { headline: "h", description: "d", reward: "r", price: "Rs 1 / mo" },
    cards: [
      { variantKey: "A", value: logo("Sound wave") },
      { variantKey: "B", value: logo("VK monogram", PNG2) },
    ],
  };
  assert.equal(validateDeck(d, "publish").ok, true);
  assert.equal(validateDeck({ ...d, cards: [d.cards[0], { variantKey: "B", value: { name: "", src: "" } }] }, "publish").ok, false);
  const ui = {
    ...base,
    variable: "productUI",
    shared: { headline: "h", description: "d", reward: "r", price: "Rs 1 / mo" },
    cards: [
      { variantKey: "A", value: [PNG] },
      { variantKey: "B", value: [JPEG, WEBP] },
    ],
  };
  assert.equal(validateDeck(ui, "publish").ok, true);
  assert.equal(validateDeck({ ...ui, cards: [{ variantKey: "A", value: [] }, ui.cards[1]] }, "publish").ok, false);
});

test("cards are immutable once the deck is live", () => {
  const live = { ...headlineDeck(), status: "live" };
  const changed = checkDeckPatch(live, {
    cards: [
      { variantKey: "A", value: "new" },
      { variantKey: "B", value: "x" },
    ],
  });
  assert.equal(changed.ok, false);
  assert.equal(checkDeckPatch(live, { question: "Different?" }).ok, false);
  assert.equal(checkDeckPatch(live, { shared: { ...live.shared, price: "Rs 1 / mo" } }).ok, false);
  assert.equal(checkDeckPatch(live, { variable: "price" }).ok, false);
  assert.equal(checkDeckPatch(live, { publish: true }).ok, false);
  // same value, moving and archiving are fine
  assert.equal(checkDeckPatch(live, { cards: live.cards, productId: "p2", archived: true }).ok, true);
  // unknown keys never pass
  assert.equal(checkDeckPatch(live, { ownerId: "x" }).ok, false);
  for (const status of ["decided", "shipped", "closed"]) {
    assert.equal(checkDeckPatch({ ...live, status }, { question: "Z" }).ok, false);
  }
});

test("server snapshot of the product does not count as a locked-field change", () => {
  const live = { ...headlineDeck(), status: "live" };
  live.shared = { ...live.shared, product: { name: "Voice Khata" } };
  const { product, ...clientShared } = live.shared;
  assert.ok(product);
  assert.equal(checkDeckPatch(live, { shared: clientShared }).ok, true);
});

test("drafts may change; switching variable clears cards", () => {
  const draft = { ...headlineDeck(), status: "draft" };
  assert.equal(checkDeckPatch(draft, { question: "New?" }).ok, true);
  const next = applyDraftPatch(draft, { variable: "price", priceMode: "level" });
  assert.deepEqual(next.cards, []);
});

test("locked rows list what stays the same", () => {
  const rows = lockedRows(headlineDeck());
  assert.deepEqual(
    rows.map((r) => r.key),
    ["description", "reward", "price", "question", "answers"],
  );
});

test("status labels, including Ready to ship", () => {
  assert.equal(deckStatusView({ status: "draft" }).label, "Draft");
  assert.equal(deckStatusView({ status: "live" }).label, "Live");
  assert.equal(deckStatusView({ status: "live", chance: 0.88 }).label, "Leading · 88% sure");
  assert.equal(deckStatusView({ status: "decided" }).label, "Ready to ship");
  assert.equal(deckStatusView({ status: "decided", shippedAt: new Date() }).label, "Won");
  assert.equal(deckStatusView({ status: "shipped" }).label, "Won");
  assert.equal(matchesFilter("decided", "finished"), true);
  assert.equal(matchesFilter("closed", "all"), false);
  assert.equal(matchesFilter("closed", "archived"), true);
  assert.equal(matchesFilter("draft", "drafts"), true);
  assert.equal(matchesFilter("decided", "live"), false);
});

test("price parsing", () => {
  assert.deepEqual(parsePrice("Rs 1,600 / mo"), { amount: 1600, unit: "/mo" });
  assert.equal(parsePrice("free"), null);
  assert.equal(checkPriceLevels(["Rs 99 per mo", "Rs 199 / mo"]).ok, true);
});

test("product settings use standard lists only", () => {
  const good = {
    name: "Voice Khata",
    category: "Voice ledger · Retail",
    industry: "Retail",
    targetUsers: ["Shop owner", "Wholesaler"],
    audience: { who: "targetOnly", states: ["Gujarat"], interests: ["Retail"] },
  };
  const r = validateProduct(good);
  assert.equal(r.ok, true);
  assert.equal(r.value.icon, "V");
  assert.equal(validateProduct({ ...good, targetUsers: ["Astronaut"] }).ok, false);
  assert.equal(validateProduct({ ...good, audience: { who: "targetOnly", states: ["Narnia"], interests: [] } }).ok, false);
  assert.equal(validateProduct({ ...good, industry: "Space" }).ok, false);
  assert.equal(validateProduct({ ...good, targetUsers: [] }).ok, false);
  assert.equal(validateProduct({ ...good, targetUsers: [], audience: { who: "everyone" } }).ok, true);
});

test("slug and flag name", () => {
  assert.equal(makeDeckSlug("Voice Khata", "headline", "x7k2"), "voice-khata-headline-x7k2");
  assert.equal(flagNameFor("voice-khata-headline"), "deck_voice-khata-headline");
});

test("image sources must be PNG/JPEG/WebP data URLs (no http, no SVG, no fakes)", () => {
  const logoDeck = (src) => ({
    ...base,
    variable: "logo",
    shared: { headline: "h", description: "d", reward: "r", price: "Rs 1 / mo" },
    cards: [
      { variantKey: "A", value: { name: "A", src } },
      { variantKey: "B", value: { name: "B", src: PNG } },
    ],
  });
  for (const ok of [PNG, JPEG, WEBP]) assert.equal(validateDeck(logoDeck(ok), "draft").ok, true, ok.slice(0, 22));
  const bad = [
    "https://attacker.example/p.gif?d=1",
    "http://attacker.example/p.png",
    "//attacker.example/p.png",
    "javascript:alert(1)",
    "data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+",
    "data:image/svg+xml,<svg onload=alert(1)>",
    "data:text/html;base64,PGgxPg==",
    "data:image/png;base64,AA",
    "data:image/png;base64," + Buffer.from("<svg onload=alert(1)>").toString("base64"),
    "data:image/png;base64,!!!notbase64!!!",
    "data:image/gif;base64,R0lGODlhAQABAAAAACw=",
    "data:image/png;base64," + Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(460_000)]).toString("base64"),
  ];
  for (const src of bad) {
    const r = validateDeck(logoDeck(src), "draft");
    assert.equal(r.ok, false, src.slice(0, 40));
    assert.ok(paths(r).includes("cards.0.value.src"));
  }
  const shots = {
    ...base,
    variable: "productUI",
    shared: { headline: "h", description: "d", reward: "r", price: "Rs 1 / mo" },
    cards: [{ variantKey: "A", value: ["https://attacker.example/x.png"] }, { variantKey: "B", value: [PNG] }],
  };
  assert.equal(validateDeck(shots, "draft").ok, false);
  assert.equal(validateDeck({ ...shots, shared: { ...shots.shared, logo: { name: "x", src: "https://a.example/l.png" } } }, "draft").ok, false);
});

test("safeImageSrc only passes data image URLs", async () => {
  const { safeImageSrc } = await import("../image.ts");
  assert.equal(safeImageSrc(PNG), PNG);
  assert.equal(safeImageSrc("https://a.example/x.png"), undefined);
  assert.equal(safeImageSrc("data:image/svg+xml;base64,AAAA"), undefined);
  assert.equal(safeImageSrc(undefined), undefined);
});

test("safeImageSrc allows only same-origin /demo/ image files", async () => {
  const { safeImageSrc, imageDataUrlError } = await import("../image.ts");
  assert.equal(safeImageSrc("/demo/voice-khata-1.png"), "/demo/voice-khata-1.png");
  for (const bad of [
    "/demo/screen.svg",
    "/demo/../etc/passwd.png",
    "/demo/a/b.png",
    "//evil.example/demo/x.png",
    "/demo/x.png?x=1",
    "/demo/x.png#a",
    "/other/x.png",
    "demo/x.png",
    "http://localhost/demo/x.png",
    "https://a.example/demo/x.png",
    "/demo/x.png ",
    "javascript:/demo/x.png",
  ]) {
    assert.equal(safeImageSrc(bad), undefined, bad);
  }
  // Uploads still must be data URLs: a /demo/ path never validates for saving.
  assert.notEqual(imageDataUrlError("/demo/voice-khata-1.png"), null);
});
