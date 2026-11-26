import type { CapacitorConfig } from "@capacitor/cli";

// Thin native shell over the deployed web app. See docs/mobile.md.
//
// CAP_SERVER_URL  : URL of the deployed PitchSwipe app (https required for release builds).
// CAP_DEV=1       : dev profile only; permits cleartext http (e.g. http://10.0.2.2:3000
//                   for the Android emulator reaching the host's `next dev`).
// CAP_APP_ID      : optional override of the bundle/application id.
const serverUrl = process.env.CAP_SERVER_URL?.trim();
const isDev = process.env.CAP_DEV === "1";

if (serverUrl) {
  let parsed: URL;
  try {
    parsed = new URL(serverUrl);
  } catch {
    throw new Error(`CAP_SERVER_URL is not a valid URL: ${serverUrl}`);
  }
  if (parsed.protocol !== "https:" && !(isDev && parsed.protocol === "http:")) {
    throw new Error(
      "CAP_SERVER_URL must be https:// (http:// is only allowed with CAP_DEV=1 for local development).",
    );
  }
}

const config: CapacitorConfig = {
  appId: process.env.CAP_APP_ID || "app.pitchswipe.mobile", // placeholder: change before store release
  appName: "PitchSwipe",
  webDir: "mobile/www",
  server: {
    ...(serverUrl ? { url: serverUrl } : {}),
    cleartext: isDev,
    androidScheme: "https",
    // The server.url host is always allowed. Email/password Firebase sign-in uses
    // XHR/fetch (not navigation), so no Firebase domains are needed here. Popup/redirect
    // (Google) sign-in would need *.firebaseapp.com and is not supported in a WebView.
    allowNavigation: serverUrl ? [new URL(serverUrl).host] : [],
  },
  android: {
    path: "mobile/android",
    allowMixedContent: false,
  },
  plugins: {
    // Built into Capacitor 8. The app draws edge to edge; "css" writes the real insets to --safe-area-inset-*
    // on <html>, which globals.css uses for --safe-top / --safe-bottom. DARK = light icons for the default dark
    // theme; the web app switches it when the user picks light mode (src/lib/feel/theme.ts, syncSystemBars).
    SystemBars: {
      insetsHandling: "css",
      style: "DARK",
    },
  },
  ios: {
    path: "mobile/ios",
    contentInset: "always",
    scheme: "PitchSwipe",
  },
};

export default config;
