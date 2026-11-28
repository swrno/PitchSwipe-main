/**
 * Dark / light theme. Dark is the default; the choice is kept in this browser (localStorage "ps:theme") and set
 * as data-theme="light" on <html>. THEME_BOOT_SCRIPT runs in <head> before first paint, so a light-mode visitor
 * never sees a dark flash.
 */
import { applyStoredPalette } from "./palette";
import { PALETTE_STORAGE_KEY } from "./palettes";

export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "ps:theme";
export const THEME_COLORS: Record<Theme, string> = { dark: "#000000", light: "#f6f5f1" };

/**
 * Inline in <head>. Plain ES5, no imports: it runs before React. Sets the light/dark attribute, then the saved palette's
 * resolved tokens for that mode ("ps:palette" holds them) as inline custom properties, and the meta theme-color.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var d=document.documentElement,l=localStorage.getItem("${THEME_STORAGE_KEY}")==="light",m=document.querySelector('meta[name="theme-color"]');if(l){d.setAttribute("data-theme","light");if(m)m.setAttribute("content","${THEME_COLORS.light}");}var p=JSON.parse(localStorage.getItem("${PALETTE_STORAGE_KEY}")||"null"),e=p&&p[l?"light":"dark"],v=e&&e.vars;if(v){for(var k in v){if(/^[a-z-]+$/.test(k)&&/^(#[0-9a-f]{3,8}|rgb[a]?\\([^)]*\\))$/i.test(v[k]))d.style.setProperty("--"+k,v[k]);}if(v.background&&m)m.setAttribute("content",v.background);}}catch(e){}})();`;

/** In the Capacitor app: light status-bar icons on the dark theme, dark icons on the light one. No-op on the web. */
export function syncSystemBars(theme: Theme = readTheme()): void {
  const bars = (window as unknown as { Capacitor?: { Plugins?: { SystemBars?: { setStyle?: (o: { style: string }) => Promise<void> } } } })
    .Capacitor?.Plugins?.SystemBars;
  bars?.setStyle?.({ style: theme === "dark" ? "DARK" : "LIGHT" }).catch(() => undefined);
}

export function readTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "light") root.setAttribute("data-theme", "light");
  else root.removeAttribute("data-theme");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);
  applyStoredPalette(theme);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private mode or blocked storage: the choice lasts for this page only.
  }
  syncSystemBars(theme);
  window.dispatchEvent(new CustomEvent("ps:theme", { detail: theme }));
}
