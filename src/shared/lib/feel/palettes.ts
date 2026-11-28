/**
 * Colour palettes (pure: no DOM). A preset is a name, a one-line description and, for each of light and dark, a full set
 * of colour tokens. The app rule is neutral surfaces plus one accent, so every preset is three colours (background,
 * brand, accent) and the rest is derived: card, muted, border and input from the background, readable foregrounds
 * chosen by contrast. The same derivation serves custom colours. Every preset passes WCAG AA (see tests/palettes.test.ts).
 */
export type PaletteMode = "light" | "dark";

export const PALETTE_STORAGE_KEY = "ps:palette";

/** Token name (the CSS custom property without "--") to a hex or rgb() colour. */
export const TOKEN_KEYS = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "muted",
  "muted-foreground",
  "border",
  "input",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "accent",
  "accent-foreground",
  "accent-soft",
  "ring",
  "highlight",
  "highlight-foreground",
  "canvas",
] as const;
export type TokenKey = (typeof TOKEN_KEYS)[number];
export type TokenSet = Record<TokenKey, string>;

export type CustomColors = { background: string; brand: string; accent: string };
export type PaletteSelection = { presetId: string; custom?: CustomColors };
export type PaletteChoice = Partial<Record<PaletteMode, PaletteSelection>>;

export type Preset = { id: string; name: string; description: string; light: TokenSet; dark: TokenSet };

// ---------------------------------------------------------------- colour maths

type Rgb = [number, number, number];

/** "#rgb" or "#rrggbb" (case-insensitive, # optional) to a normalised "#rrggbb", or null. */
export function normalizeHex(input: string): string | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(input.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return `#${h.toLowerCase()}`;
}

function toRgb(hex: string): Rgb {
  const h = normalizeHex(hex) ?? "#000000";
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;
}

/** Linear blend: 0 gives `a`, 1 gives `b`. */
export function mix(a: string, b: string, t: number): string {
  const x = toRgb(a);
  const y = toRgb(b);
  return toHex([0, 1, 2].map((i) => x[i] + (y[i] - x[i]) * t) as Rgb);
}

/** WCAG relative luminance. Accepts hex or "rgb(r g b / a)" (alpha ignored). */
export function luminance(color: string): number {
  const rgb = color.startsWith("rgb")
    ? (/(\d+)\D+(\d+)\D+(\d+)/.exec(color)?.slice(1, 4).map(Number) as Rgb)
    : toRgb(color);
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export const AA_TEXT = 4.5;
const LIGHT_INK = "#ffffff";
const DARK_INK = "#111111";

/** White or near-black (pure black for mid-tones), whichever reads better on `bg`: always at least 4.5:1. */
export function readableOn(bg: string): string {
  const w = contrastRatio(bg, LIGHT_INK);
  const d = contrastRatio(bg, DARK_INK);
  if (Math.max(w, d) >= AA_TEXT) return w >= d ? LIGHT_INK : DARK_INK;
  return w >= contrastRatio(bg, "#000000") ? LIGHT_INK : "#000000"; // mid-tones: pure black or white always reaches 4.5
}

// ---------------------------------------------------------------- derivation

/** Full token set from three colours. Foregrounds are chosen for contrast, never taken from the caller. */
export function deriveTokens({ background, brand, accent }: CustomColors): TokenSet {
  const bg = normalizeHex(background) ?? "#000000";
  const br = normalizeHex(brand) ?? "#ffffff";
  const ac = normalizeHex(accent) ?? "#888888";
  const ink = readableOn(bg);
  const dark = ink === LIGHT_INK;
  // Softer than pure white/black when that still reads; mid-tone backgrounds keep the full-strength ink.
  const soft = dark ? "#f5f4f7" : DARK_INK;
  const fg = contrastRatio(soft, bg) >= AA_TEXT ? soft : ink;
  const card = dark ? mix(bg, "#ffffff", 0.06) : mix(bg, "#ffffff", 0.7);
  const muted = dark ? mix(bg, "#ffffff", 0.11) : mix(bg, fg, 0.06);
  const border = mix(bg, fg, dark ? 0.18 : 0.12);
  const input = mix(bg, fg, dark ? 0.26 : 0.2);
  // The weakest text colour that still reads: step from fg toward bg until a surface would fail 4.6:1.
  let mutedFg = fg;
  for (let t = 0.1; t <= 0.7; t += 0.02) {
    const next = mix(fg, bg, t);
    if (![bg, card, muted].every((s) => contrastRatio(next, s) >= 4.6)) break;
    mutedFg = next;
  }
  const onAccent = readableOn(ac);
  return {
    background: bg,
    foreground: fg,
    card,
    "card-foreground": fg,
    muted,
    "muted-foreground": mutedFg,
    border,
    input,
    primary: br,
    "primary-foreground": readableOn(br),
    secondary: muted,
    "secondary-foreground": fg,
    accent: ac,
    "accent-foreground": onAccent,
    "accent-soft": dark ? mix(bg, ac, 0.16) : mix(bg, ac, 0.13),
    ring: ac,
    highlight: ac,
    "highlight-foreground": onAccent,
    canvas: bg,
  };
}

// ---------------------------------------------------------------- AA checks

export type PairCheck = { label: string; foreground: TokenKey; background: TokenKey; ratio: number; pass: boolean };

const PAIRS: ReadonlyArray<[string, TokenKey, TokenKey]> = [
  ["Text on background", "foreground", "background"],
  ["Text on cards", "card-foreground", "card"],
  ["Secondary text on background", "muted-foreground", "background"],
  ["Secondary text on cards", "muted-foreground", "card"],
  ["Button text on brand colour", "primary-foreground", "primary"],
  ["Text on accent", "accent-foreground", "accent"],
];

export function checkContrast(tokens: TokenSet): PairCheck[] {
  return PAIRS.map(([label, foreground, background]) => {
    const ratio = contrastRatio(tokens[foreground], tokens[background]);
    return { label, foreground, background, ratio, pass: ratio >= AA_TEXT };
  });
}

export const failingPairs = (tokens: TokenSet): PairCheck[] => checkContrast(tokens).filter((c) => !c.pass);

// ---------------------------------------------------------------- presets

type Spec = { id: string; name: string; description: string; light: CustomColors; dark: CustomColors };
const c = (background: string, brand: string, accent: string): CustomColors => ({ background, brand, accent });

/** PitchSwipe is the shipped look, written out in full (it matches globals.css). The rest derive from three colours. */
const PITCHSWIPE: Preset = {
  id: "pitchswipe",
  name: "PitchSwipe",
  description: "Black or warm white with a lime accent. The default.",
  light: {
    background: "#f6f5f1", foreground: "#111111", card: "#ffffff", "card-foreground": "#111111", muted: "#ecebe6",
    "muted-foreground": "#5d5b63", border: "#e2e0d9", input: "#d9d7d0", primary: "#111111", "primary-foreground": "#ffffff",
    secondary: "#ecebe6", "secondary-foreground": "#111111", accent: "#3b7a0c", "accent-foreground": "#ffffff",
    "accent-soft": "#eaf5d8", ring: "#3b7a0c", highlight: "#3b7a0c", "highlight-foreground": "#ffffff", canvas: "#f6f5f1",
  },
  dark: {
    background: "#000000", foreground: "#f5f4f7", card: "#161616", "card-foreground": "#f5f4f7", muted: "#1f1f1f",
    "muted-foreground": "#a3a1ab", border: "#2c2c2c", input: "#333333", primary: "#f5f4f7", "primary-foreground": "#0b0b0b",
    secondary: "#262626", "secondary-foreground": "#f5f4f7", accent: "#c8f35e", "accent-foreground": "#111111",
    "accent-soft": "#1a2008", ring: "#c8f35e", highlight: "#c8f35e", "highlight-foreground": "#111111", canvas: "#000000",
  },
};

const SPECS: Spec[] = [
  { id: "paper", name: "Paper", description: "Warm off-white and ink, with an amber accent.", light: c("#fbfaf7", "#1f2937", "#b45309"), dark: c("#1a1815", "#f3efe6", "#e9a14a") },
  { id: "graphite", name: "Graphite", description: "Cool greys, calm and neutral, with a blue accent.", light: c("#f3f4f6", "#1f2328", "#1d4ed8"), dark: c("#121417", "#e6e8eb", "#7aa2ff") },
  { id: "midnight", name: "Midnight", description: "Deep navy surfaces with an indigo accent.", light: c("#f3f5fb", "#101a3a", "#4338ca"), dark: c("#0a0f24", "#e8ecff", "#8b9cff") },
  { id: "forest", name: "Forest", description: "Soft green-tinted surfaces and a leaf-green accent.", light: c("#f2f6f1", "#14301f", "#1f7a3d"), dark: c("#0b1510", "#e4f1e6", "#5fd08a") },
  { id: "harbour", name: "Harbour", description: "Sea-mist surfaces with a teal accent.", light: c("#f1f6f8", "#0f2a35", "#0a7a8f"), dark: c("#08151a", "#e2f2f6", "#4fc3d9") },
  { id: "sand", name: "Sand", description: "Warm beige and brown with a terracotta accent.", light: c("#f8f2e8", "#3a2a1a", "#a65a1e"), dark: c("#1c1610", "#f3e8d6", "#e0a066") },
  { id: "violet", name: "Violet", description: "Quiet lilac-tinted surfaces and a purple accent.", light: c("#f7f4fc", "#231636", "#6d28d9"), dark: c("#120b1f", "#efe8fb", "#b497ff") },
  { id: "ember", name: "Ember", description: "Warm dark browns and a glowing orange accent.", light: c("#fbf4f1", "#2b1511", "#c2410c"), dark: c("#170c09", "#fbe9e3", "#ff8a5c") },
  { id: "nordic", name: "Nordic", description: "Frosted slate with a glacier-blue accent.", light: c("#eff2f5", "#2e3440", "#3b6ea5"), dark: c("#20252e", "#e5e9f0", "#88c0d0") },
  { id: "carbon", name: "Carbon", description: "Near-black and white with a sharp electric blue.", light: c("#f5f5f5", "#161616", "#0f62fe"), dark: c("#161616", "#f4f4f4", "#78a9ff") },
  { id: "rose", name: "Rose", description: "Blush surfaces with a raspberry accent.", light: c("#fdf3f5", "#2a1218", "#be185d"), dark: c("#1a0b10", "#fde8ee", "#f472a6") },
];

export const PALETTE_PRESETS: readonly Preset[] = [
  PITCHSWIPE,
  ...SPECS.map((s): Preset => ({ id: s.id, name: s.name, description: s.description, light: deriveTokens(s.light), dark: deriveTokens(s.dark) })),
];

export const DEFAULT_PRESET_ID = PITCHSWIPE.id;
export const CUSTOM_PRESET_ID = "custom";

export const getPreset = (id: string): Preset | undefined => PALETTE_PRESETS.find((p) => p.id === id);

/** The colours a selection produces in `mode`: custom colours when set, else the preset (default if unknown). */
export function resolveTokens(mode: PaletteMode, selection?: PaletteSelection): TokenSet {
  if (selection?.custom) return deriveTokens(selection.custom);
  return (getPreset(selection?.presetId ?? DEFAULT_PRESET_ID) ?? PITCHSWIPE)[mode];
}

/** The three editable colours of a token set (what the custom pickers start from). */
export const customFromTokens = (t: TokenSet): CustomColors => ({ background: t.background, brand: t.primary, accent: t.accent });

export const isDefaultSelection = (s?: PaletteSelection): boolean => !s || (!s.custom && s.presetId === DEFAULT_PRESET_ID);

// ---------------------------------------------------------------- storage shape

/** What localStorage "ps:palette" holds per mode: the choice and the resolved tokens, so the boot script needs no maths. */
export type StoredMode = PaletteSelection & { vars: Partial<TokenSet> };
export type StoredPalette = Partial<Record<PaletteMode, StoredMode>>;

export function buildStored(choice: PaletteChoice): StoredPalette {
  const out: StoredPalette = {};
  for (const mode of ["light", "dark"] as const) {
    const sel = choice[mode];
    if (!sel || isDefaultSelection(sel)) continue;
    out[mode] = { ...sel, vars: resolveTokens(mode, sel) };
  }
  return out;
}

const isHex = (v: unknown): v is string => typeof v === "string" && normalizeHex(v) !== null;

/** Parse the stored string; anything malformed gives an empty choice. */
export function parseStored(raw: string | null | undefined): PaletteChoice {
  if (!raw) return {};
  try {
    const data = JSON.parse(raw) as Record<string, { presetId?: unknown; custom?: Record<string, unknown> } | null>;
    const out: PaletteChoice = {};
    for (const mode of ["light", "dark"] as const) {
      const e = data?.[mode];
      if (!e || typeof e.presetId !== "string") continue;
      const cu = e.custom;
      const custom = cu && isHex(cu.background) && isHex(cu.brand) && isHex(cu.accent)
        ? { background: normalizeHex(cu.background)!, brand: normalizeHex(cu.brand)!, accent: normalizeHex(cu.accent)! }
        : undefined;
      out[mode] = custom ? { presetId: CUSTOM_PRESET_ID, custom } : { presetId: getPreset(e.presetId) ? e.presetId : DEFAULT_PRESET_ID };
    }
    return out;
  } catch {
    return {};
  }
}
