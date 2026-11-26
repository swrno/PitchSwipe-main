/**
 * Dark / light theme. Dark is the default; the choice is kept in this browser (localStorage "ps:theme") and set
 * as data-theme="light" on <html>. THEME_BOOT_SCRIPT runs in <head> before first paint, so a light-mode visitor
 * never sees a dark flash.
 */
export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "ps:theme";
export const THEME_COLORS: Record<Theme, string> = { dark: "#000000", light: "#f6f5f1" };

/** Inline in <head>. Plain ES5, no imports: it runs before React. */
export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"){document.documentElement.setAttribute("data-theme","light");var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content","${THEME_COLORS.light}");}}catch(e){}})();`;

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
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private mode or blocked storage: the choice lasts for this page only.
  }
  syncSystemBars(theme);
  window.dispatchEvent(new CustomEvent("ps:theme", { detail: theme }));
}
