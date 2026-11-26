/* Pure cache-routing decisions for sw.js. Loaded via importScripts and by node tests. */
(function (root) {
  var STATIC_PREFIXES = ["/_next/static/", "/icons/"];

  function decide(req, origin) {
    // req: { url, method, mode, headers: { has(name) } }
    if (!req || req.method !== "GET") return "bypass";
    var url;
    try { url = new URL(req.url); } catch (e) { return "bypass"; }
    if (url.origin !== origin) return "bypass";
    if (req.headers && req.headers.has("authorization")) return "bypass";
    if (url.pathname === "/api" || url.pathname.indexOf("/api/") === 0) return "bypass";
    if (req.mode === "navigate") return "navigate";
    for (var i = 0; i < STATIC_PREFIXES.length; i++) {
      if (url.pathname.indexOf(STATIC_PREFIXES[i]) === 0) return "static";
    }
    return "bypass";
  }

  var api = { decide: decide, STATIC_PREFIXES: STATIC_PREFIXES };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SWRoutes = api;
})(typeof self !== "undefined" ? self : this);
