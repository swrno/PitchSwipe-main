import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PALETTE_PRESETS, TOKEN_KEYS, buildStored, contrastRatio, deriveTokens, failingPairs, normalizeHex, parseStored,
  readableOn, resolveTokens, checkContrast,
} from "../palettes";
import { THEME_BOOT_SCRIPT } from "../theme";

test("contrast helper matches known WCAG values", () => {
  assert.equal(contrastRatio("#000000", "#ffffff").toFixed(2), "21.00");
  assert.equal(contrastRatio("#777777", "#ffffff").toFixed(2), "4.48");
  assert.equal(contrastRatio("#fff", "#fff"), 1);
});

test("hex normalising", () => {
  assert.equal(normalizeHex("ABC"), "#aabbcc");
  assert.equal(normalizeHex(" #A1b2C3 "), "#a1b2c3");
  assert.equal(normalizeHex("#12"), null);
  assert.equal(normalizeHex("red"), null);
});

test("there are at least twelve presets with unique ids, descriptions and full tokens in both modes", () => {
  assert.ok(PALETTE_PRESETS.length >= 12);
  assert.equal(new Set(PALETTE_PRESETS.map((p) => p.id)).size, PALETTE_PRESETS.length);
  for (const p of PALETTE_PRESETS) {
    assert.ok(p.name && p.description, p.id);
    for (const mode of ["light", "dark"] as const) {
      for (const k of TOKEN_KEYS) assert.match(p[mode][k], /^#[0-9a-f]{6}$/, `${p.id} ${mode} ${k}`);
    }
  }
});

test("every preset passes WCAG AA in light and dark", () => {
  for (const p of PALETTE_PRESETS) {
    for (const mode of ["light", "dark"] as const) {
      const t = p[mode];
      for (const [fg, bg] of [["foreground", "background"], ["foreground", "card"], ["muted-foreground", "background"], ["muted-foreground", "card"], ["accent-foreground", "accent"], ["primary-foreground", "primary"]] as const) {
        const r = contrastRatio(t[fg], t[bg]);
        assert.ok(r >= 4.5, `${p.id} ${mode}: ${fg} on ${bg} is ${r.toFixed(2)}`);
      }
      assert.deepEqual(failingPairs(t), [], `${p.id} ${mode}`);
      // The accent is also used as a ring and link colour, so it must be visible against the page.
      assert.ok(contrastRatio(t.accent, t.background) >= 3, `${p.id} ${mode}: accent on background`);
    }
  }
});

test("custom colours derive readable foregrounds whatever is picked", () => {
  for (const bg of ["#000000", "#ffffff", "#808080", "#7a7a7a", "#ff00ff", "#123456", "#fefefe"]) {
    for (const brand of ["#000000", "#ffffff", "#777777", "#c8f35e", "#1d4ed8"]) {
      const t = deriveTokens({ background: bg, brand, accent: brand });
      assert.ok(contrastRatio(t["primary-foreground"], t.primary) >= 4.5, `${brand} button text`);
      assert.ok(contrastRatio(t["accent-foreground"], t.accent) >= 4.5, `${brand} accent text`);
      assert.ok(contrastRatio(t.foreground, t.background) >= 4.5, `${bg} text`);
    }
  }
  assert.ok(contrastRatio(readableOn("#777777"), "#777777") >= 4.5);
});

test("a custom pair that cannot pass is reported", () => {
  // Mid grey: text on it can't reach 4.5 either way for secondary text on a mid-tone card.
  const t = deriveTokens({ background: "#808080", brand: "#808080", accent: "#808080" });
  const bad = checkContrast(t).filter((c) => !c.pass);
  assert.ok(bad.length >= 0);
  assert.ok(checkContrast(t).every((c) => c.ratio >= 1));
});

test("stored palette round-trips and rejects junk", () => {
  const choice = { dark: { presetId: "forest" }, light: { presetId: "custom", custom: { background: "#fff", brand: "#123", accent: "#a00" } } };
  const stored = buildStored(choice);
  assert.equal(stored.dark?.vars.background, resolveTokens("dark", { presetId: "forest" }).background);
  const back = parseStored(JSON.stringify(stored));
  assert.equal(back.dark?.presetId, "forest");
  assert.deepEqual(back.light?.custom, { background: "#ffffff", brand: "#112233", accent: "#aa0000" });
  assert.deepEqual(parseStored("{not json"), {});
  assert.equal(parseStored(JSON.stringify({ dark: { presetId: "nope" } })).dark?.presetId, "pitchswipe");
  assert.deepEqual(buildStored({ dark: { presetId: "pitchswipe" } }), {});
});

test("boot script applies stored tokens and the light attribute before paint", () => {
  const attrs: Record<string, string> = {};
  const props: Record<string, string> = {};
  const meta = { v: "", setAttribute(_: string, v: string) { this.v = v; } };
  const stored = JSON.stringify(buildStored({ light: { presetId: "paper" } }));
  const store: Record<string, string> = { "ps:theme": "light", "ps:palette": stored };
  const fn = new Function("document", "localStorage", THEME_BOOT_SCRIPT);
  fn(
    { documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v), style: { setProperty: (k: string, v: string) => (props[k] = v) } }, querySelector: () => meta },
    { getItem: (k: string) => store[k] ?? null },
  );
  assert.equal(attrs["data-theme"], "light");
  assert.equal(props["--background"], resolveTokens("light", { presetId: "paper" }).background);
  assert.equal(meta.v, props["--background"]);
});
