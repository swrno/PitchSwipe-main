import {
  PALETTE_STORAGE_KEY, TOKEN_KEYS, buildStored, parseStored, resolveTokens,
  type PaletteChoice, type PaletteMode, type PaletteSelection,
} from "./palettes";

/** Browser side of the palettes: read and write localStorage "ps:palette" and set the tokens on <html>. */

export function readPaletteChoice(): PaletteChoice {
  try {
    return parseStored(window.localStorage.getItem(PALETTE_STORAGE_KEY));
  } catch {
    return {};
  }
}

/** Set (or, for the default, clear) the inline tokens and the meta theme-color for `mode`. */
export function applyPaletteTokens(mode: PaletteMode, selection?: PaletteSelection): void {
  const root = document.documentElement;
  for (const k of TOKEN_KEYS) root.style.removeProperty(`--${k}`);
  const stored = buildStored({ [mode]: selection })[mode];
  if (stored) for (const [k, v] of Object.entries(stored.vars)) root.style.setProperty(`--${k}`, v);
  const bg = resolveTokens(mode, selection).background;
  const fallback = mode === "light" ? "#f6f5f1" : "#000000";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", stored ? bg : fallback);
}

/** Re-apply the saved palette for `mode` (called when the light/dark switch flips). */
export function applyStoredPalette(mode: PaletteMode): void {
  applyPaletteTokens(mode, readPaletteChoice()[mode]);
}

/** Save both modes' choices and apply the one for the current mode. Returns false when storage is blocked. */
export function savePaletteChoice(choice: PaletteChoice, currentMode: PaletteMode): boolean {
  let saved = true;
  try {
    const stored = buildStored(choice);
    if (Object.keys(stored).length === 0) window.localStorage.removeItem(PALETTE_STORAGE_KEY);
    else window.localStorage.setItem(PALETTE_STORAGE_KEY, JSON.stringify({ ...stored }));
  } catch {
    saved = false;
  }
  applyPaletteTokens(currentMode, choice[currentMode]);
  return saved;
}
