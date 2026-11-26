// Run: node --import ./scripts/register-ts.mjs --test src/lib/share/tests/share.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { estimateReach, formatReach, reachView, isDesignedAudience, REACH_UNAVAILABLE, SMALL_AUDIENCE } from "../reach.ts";
import { deckLink, displayLink, whatsappText, linkedinText, whatsappShareUrl, linkedinShareUrl } from "../links.ts";
import { BOOST_OPTIONS, boostButtonLabel } from "../boost.ts";
import { encodeQr, qrPath, formatBits, functionMap, MASKS, rsGenerator, rsRemainder } from "../qr.ts";

const demo = { who: "targetOnly", states: ["Gujarat", "Maharashtra"], interests: ["Retail", "Finance"] };
const roles = ["Shop owner", "Wholesaler"];

test("demo reach is ~1,900", () => {
  const r = estimateReach(demo, roles);
  assert.equal(r.reach, 1900);
  assert.equal(formatReach(r.reach), "~1,900");
  assert.equal(r.small, false);
  assert.equal(r.warning, undefined);
});

test("everyone with no filters reaches the whole pool", () => {
  assert.equal(estimateReach({ who: "everyone", states: [], interests: [] }, []).reach, 26000);
});

test("narrow audiences get the small-audience warning", () => {
  const r = estimateReach({ who: "targetOnly", states: ["Goa"], interests: ["Pets"] }, ["Farmer"]);
  assert.ok(r.reach < SMALL_AUDIENCE);
  assert.equal(r.small, true);
  assert.match(r.warning, /may take longer/);
});

test("shares are capped at 100% and reach is monotonic when adding states", () => {
  const many = estimateReach({ who: "everyone", states: Array(10).fill("x"), interests: [] }, []);
  assert.equal(many.share, 1);
  const one = estimateReach({ who: "everyone", states: ["Goa"], interests: [] }, []).reach;
  const two = estimateReach({ who: "everyone", states: ["Goa", "Delhi"], interests: [] }, []).reach;
  assert.ok(two > one);
});

test("links and share text carry the link", () => {
  const url = deckLink("https://pitchswipe.app/", "voice-khata");
  assert.equal(url, "https://pitchswipe.app/d/voice-khata");
  assert.equal(displayLink(url), "pitchswipe.app/d/voice-khata");
  const copy = { productName: "Voice Khata", tagline: "Voice ledger" };
  assert.ok(whatsappText(copy, url).includes(url));
  assert.ok(linkedinText(copy, url).includes(url));
  assert.ok(whatsappShareUrl("a b").endsWith("a%20b"));
  assert.ok(linkedinShareUrl(url).includes(encodeURIComponent(url)));
});

test("boost options: Rs 2 per valid swipe", () => {
  assert.deepEqual(BOOST_OPTIONS.map((o) => [o.amountRs, o.swipes]), [[300, 150], [600, 300], [1200, 600]]);
  assert.equal(boostButtonLabel(1200), "Boost for Rs 1,200");
});

test("format bits for level M mask 0 match the spec table", () => {
  assert.equal(formatBits(0).toString(2).padStart(15, "0"), "101010000010010");
  assert.equal(formatBits(1).toString(2).padStart(15, "0"), "101000100100101");
});

/** Reads the matrix back like a scanner: format, unmask, zigzag, de-interleave, RS check, decode. */
function decode(qr) {
  const { size, modules, version } = qr;
  const fn = functionMap(version);
  let fmt = 0;
  const bit = (x, y) => (modules[y][x] ? 1 : 0);
  for (let i = 0; i <= 5; i++) fmt |= bit(8, i) << i;
  fmt |= bit(8, 7) << 6;
  fmt |= bit(8, 8) << 7;
  fmt |= bit(7, 8) << 8;
  for (let i = 9; i < 15; i++) fmt |= bit(14 - i, 8) << i;
  assert.equal(fmt, formatBits(qr.mask));
  const bits = [];
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++)
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
        if (!fn[y][x]) bits.push(modules[y][x] !== MASKS[qr.mask](x, y) ? 1 : 0);
      }
  }
  const words = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) words.push(parseInt(bits.slice(i, i + 8).join(""), 2));
  return words;
}

const TABLE = { 1: [1, 10], 2: [1, 16], 3: [2, 26], 4: [2, 18], 5: [2, 24], 6: [4, 16], 7: [4, 18], 8: [4, 22], 9: [5, 22], 10: [5, 26] };

function payload(words, version) {
  const [blocks, ecc] = TABLE[version];
  const raw = words.length;
  const numShort = blocks - (raw % blocks);
  const shortLen = Math.floor(raw / blocks);
  const dl = Array.from({ length: blocks }, (_, i) => shortLen - ecc + (i < numShort ? 0 : 1));
  const cols = Array.from({ length: blocks }, () => []);
  let k = 0;
  for (let i = 0; i < Math.max(...dl); i++)
    for (let b = 0; b < blocks; b++) if (i < dl[b]) cols[b].push(words[k++]);
  for (let i = 0; i < ecc; i++) for (let b = 0; b < blocks; b++) cols[b].push(words[k++]);
  const gen = rsGenerator(ecc);
  const data = [];
  for (const blk of cols) {
    const d = blk.slice(0, blk.length - ecc);
    assert.deepEqual(rsRemainder(d, gen), blk.slice(blk.length - ecc), "Reed-Solomon check");
    data.push(...d);
  }
  return data;
}

for (const text of ["https://pitchswipe.app/d/voice-khata", "http://localhost:3000/d/voice-khata-headline-x7k2", "x".repeat(150), "Rs 199 \u20b9"]) {
  test(`QR round trip: ${text.slice(0, 30)}`, () => {
    const qr = encodeQr(text);
    assert.equal(qr.size, qr.version * 4 + 17);
    const data = payload(decode(qr), qr.version);
    assert.equal(data[0] >> 4, 0b0100, "byte mode");
    const lenBits = qr.version <= 9 ? 8 : 16;
    const bitStr = data.map((b) => b.toString(2).padStart(8, "0")).join("");
    const len = parseInt(bitStr.slice(4, 4 + lenBits), 2);
    const bytes = [];
    for (let i = 0; i < len; i++) bytes.push(parseInt(bitStr.slice(4 + lenBits + i * 8, 4 + lenBits + i * 8 + 8), 2));
    assert.equal(new TextDecoder().decode(Uint8Array.from(bytes)), text);
  });
}

test("QR finder pattern and path", () => {
  const qr = encodeQr("https://pitchswipe.app/d/a");
  assert.equal(qr.modules[0][0], true);
  assert.equal(qr.modules[1][1], false);
  assert.equal(qr.modules[3][3], true);
  assert.equal(qr.modules[6][qr.size - 1], true);
  assert.ok(qrPath(qr, 4).startsWith("M"));
  assert.throws(() => encodeQr("y".repeat(300)), RangeError);
});

test("real mode shows no reach number for any audience", () => {
  for (const [audience, targets] of [[demo, roles], [{ who: "everyone", states: [], interests: [] }, []], [{ who: "targetOnly", states: ["Goa"], interests: [] }, ["Farmer"]]]) {
    const v = reachView(false, audience, targets);
    assert.equal(v.kind, "unavailable");
    assert.equal(v.message, REACH_UNAVAILABLE);
    assert.equal(JSON.stringify(v).match(/\d/), null, "no digits in the real-mode view");
  }
});

test("demo mode: the designed audience is ~1,900 unlabelled, any other audience is labelled Demo data", () => {
  const designed = reachView(true, demo, roles);
  assert.equal(designed.kind, "estimate");
  assert.equal(designed.formatted, "~1,900");
  assert.equal(designed.label, false);
  assert.equal(isDesignedAudience(demo, ["Wholesaler", "Shop owner"]), true);
  const other = reachView(true, { who: "everyone", states: [], interests: [] }, []);
  assert.equal(other.kind, "estimate");
  assert.equal(other.label, true);
  const small = reachView(true, { who: "targetOnly", states: ["Goa"], interests: ["Pets"] }, ["Farmer"]);
  assert.equal(small.estimate.small, true);
  assert.equal(small.label, true);
});
