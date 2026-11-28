/**
 * The founder's chosen colours for the PDF report. Pure (no DOM, no server), shared by the browser (builds the `theme`
 * query value) and the API (parses it). Light-mode tokens only: the report prints on a white page.
 */
import { DEFAULT_THEME, type PdfTheme } from "./pdf";

const KEYS = ["accent", "accentForeground", "accentSoft", "foreground", "muted", "mutedForeground", "border", "card"] as const satisfies readonly (keyof PdfTheme)[];
const MAX_LENGTH = 200;
const HEX = /^#?([0-9a-f]{6})$/i;

/** "accent:3b7a0c,accentForeground:ffffff,..." (no # so it stays short in a URL). */
export function themeParam(theme: PdfTheme): string {
  return KEYS.map((k) => `${k}:${theme[k].replace("#", "").toLowerCase()}`).join(",");
}

/**
 * Strict parse: only known keys with #rrggbb values (the # is optional). Anything else (unknown key, bad colour,
 * too long, nothing usable) returns undefined so the report uses the default theme. Missing keys keep the default.
 */
export function parseTheme(raw: unknown): PdfTheme | undefined {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_LENGTH) return undefined;
  const out: PdfTheme = { ...DEFAULT_THEME };
  let seen = 0;
  for (const part of raw.split(",")) {
    const [key, value, ...extra] = part.split(":");
    const hex = HEX.exec(value ?? "");
    if (extra.length > 0 || !hex || !(KEYS as readonly string[]).includes(key)) return undefined;
    out[key as keyof PdfTheme] = `#${hex[1].toLowerCase()}`;
    seen += 1;
  }
  return seen > 0 ? out : undefined;
}
