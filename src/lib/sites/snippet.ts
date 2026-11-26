/**
 * Snippet generator (spec 02 5.15). Pure.
 *
 * The snippet is one small script tag for the founder's page. Its ONLY credential is the public
 * Flagsmith client environment key (NEXT_PUBLIC_FLAGSMITH_ENV_KEY); the admin key never reaches
 * this module. It reads flag values with an anonymous request (no identity), because anonymous
 * visitors are not bucketed into A/B/C (flagsmith README): they see the flag's own value, which
 * is the current text during the test and the winning text once "Approve and ship" has set the
 * flag's value (WP8). Elements marked data-pitchswipe="<flag>" get that value as text.
 *
 * Plain fetch instead of the Flagsmith JS SDK: no CDN dependency, works from file:// and any
 * static host, and the same code runs in docs/marketing/demo-site/voice-khata/index.html (a test keeps them equal).
 */

export const PLACEHOLDER_KEY = "YOUR_CLIENT_KEY";
export const DEFAULT_FLAGS_URL = "https://edge.api.flagsmith.com/api/v1/flags/";

export interface SnippetOptions {
  /** Public client-side environment key, or PLACEHOLDER_KEY. */
  envKey: string;
  /** Site id from POST /api/sites (not secret). */
  siteId: string;
  /** PitchSwipe origin that receives the ping, e.g. "https://pitchswipe.app". */
  baseUrl: string;
  flagsUrl?: string;
  /** How often the page re-reads the flags, in seconds (a shipped change shows up within this time). */
  pollSeconds?: number;
}

const KEY_RE = /^[A-Za-z0-9._-]{8,100}$/;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/** True for anything that is shaped like a Flagsmith server-side key; those must never be embedded. */
export function looksLikeServerKey(key: string): boolean {
  return /^ser\./i.test(key) || /^(api-key|token)\s/i.test(key);
}

export function isPlaceholderKey(key: string | undefined): boolean {
  return !key || key === PLACEHOLDER_KEY;
}

function httpUrl(value: string, label: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} is not a valid URL.`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error(`${label} must be http or https.`);
  return url.toString();
}

/** Safe inside an inline script: no raw "<" (so "</script>" cannot appear). */
function js(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/** The script tag the founder pastes before </body>. */
export function buildSnippet(opts: SnippetOptions): string {
  if (!KEY_RE.test(opts.envKey)) throw new Error("The client key is missing or malformed.");
  if (looksLikeServerKey(opts.envKey)) throw new Error("Refusing to put a server key in the snippet.");
  if (!ID_RE.test(opts.siteId)) throw new Error("The site id is malformed.");
  const base = new URL(httpUrl(opts.baseUrl, "baseUrl"));
  const ping = `${base.origin}/api/sites/ping?s=${encodeURIComponent(opts.siteId)}`;
  const flags = httpUrl(opts.flagsUrl ?? DEFAULT_FLAGS_URL, "flagsUrl");
  const poll = Math.min(3600, Math.max(5, Math.round(opts.pollSeconds ?? 30)));
  const live = !isPlaceholderKey(opts.envKey);

  return `<script>
/* PitchSwipe: shows the winning text on elements marked data-pitchswipe="<flag name>".
   Uses only the public client key. Your current text stays as the fallback. */
(function () {
  var C = { env: ${js(opts.envKey)}, flags: ${js(flags)}, ping: ${js(ping)}, live: ${js(live)}, poll: ${poll} * 1000 };
  var last = "";
  function apply(values) {
    var els = document.querySelectorAll("[data-pitchswipe]"), report = [], i, el, flag, v;
    for (i = 0; i < els.length; i++) {
      el = els[i];
      flag = el.getAttribute("data-pitchswipe");
      if (el.__psOrig === undefined) el.__psOrig = el.textContent;
      v = values && values[flag];
      if (typeof v === "string" && v !== "") { if (el.textContent !== v) el.textContent = v; }
      else if (values && el.textContent !== el.__psOrig) el.textContent = el.__psOrig;
      report.push({ flag: flag, value: String(el.textContent).trim().slice(0, 500) });
    }
    send(report);
  }
  function send(report) {
    var body = JSON.stringify({ elements: report.slice(0, 50) });
    if (body === last) return;
    last = body;
    try {
      fetch(C.ping, { method: "POST", headers: { "content-type": "text/plain" }, body: body, keepalive: true, credentials: "omit" }).catch(function () {});
    } catch (e) {}
  }
  function load() {
    if (!C.live) return apply(null);
    fetch(C.flags, { headers: { "X-Environment-Key": C.env }, credentials: "omit" })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (list) {
        var map = {}, i, f;
        for (i = 0; i < list.length; i++) {
          f = list[i];
          if (f && f.enabled !== false && f.feature && typeof f.feature_state_value === "string") map[f.feature.name] = f.feature_state_value;
        }
        apply(map);
      })
      .catch(function () { apply(null); });
  }
  function start() { load(); if (C.live) setInterval(function () { if (!document.hidden) load(); }, C.poll); }
  window.pitchswipe = { apply: apply, refresh: load };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
</script>`;
}

/** Markup example for the second snippet step (designs F2b "Mark what each deck controls"). */
export function markupExample(items: { flagName: string; text: string; tag?: "h1" | "span" | "p" }[]): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return items
    .map(({ flagName, text, tag }) => {
      const t = tag ?? "span";
      return t === "h1" || t === "p"
        ? `<${t} data-pitchswipe="${flagName}">\n  ${esc(text)}\n</${t}>`
        : `<${t} data-pitchswipe="${flagName}">${esc(text)}</${t}>`;
    })
    .join("\n");
}
