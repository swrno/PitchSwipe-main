import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { decide } = require("../../public/sw-routes.js");

const ORIGIN = "https://app.test";
const req = (url, { method = "GET", mode = "cors", auth = false } = {}) => ({
  url,
  method,
  mode,
  headers: { has: (n) => auth && n.toLowerCase() === "authorization" },
});

test("navigations are network-first", () => {
  assert.equal(decide(req(`${ORIGIN}/swipe`, { mode: "navigate" }), ORIGIN), "navigate");
});

test("static assets are cache-first", () => {
  assert.equal(decide(req(`${ORIGIN}/_next/static/chunks/a.js`), ORIGIN), "static");
  assert.equal(decide(req(`${ORIGIN}/icons/icon-192.png`), ORIGIN), "static");
});

test("/api/ is never handled, even navigations", () => {
  assert.equal(decide(req(`${ORIGIN}/api/pitches`), ORIGIN), "bypass");
  assert.equal(decide(req(`${ORIGIN}/api`), ORIGIN), "bypass");
  assert.equal(decide(req(`${ORIGIN}/api/x`, { mode: "navigate" }), ORIGIN), "bypass");
});

test("non-GET is never handled", () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    assert.equal(decide(req(`${ORIGIN}/icons/icon-192.png`, { method }), ORIGIN), "bypass");
  }
});

test("cross-origin is never handled", () => {
  assert.equal(decide(req("https://fonts.gstatic.com/_next/static/x.js"), ORIGIN), "bypass");
  assert.equal(decide(req("https://evil.test/icons/a.png", { mode: "navigate" }), ORIGIN), "bypass");
});

test("Authorization requests are never handled", () => {
  assert.equal(decide(req(`${ORIGIN}/_next/static/a.js`, { auth: true }), ORIGIN), "bypass");
  assert.equal(decide(req(`${ORIGIN}/swipe`, { mode: "navigate", auth: true }), ORIGIN), "bypass");
});

test("other same-origin GETs (data, images) are not cached", () => {
  assert.equal(decide(req(`${ORIGIN}/wallet`), ORIGIN), "bypass");
  assert.equal(decide(req("not a url"), ORIGIN), "bypass");
});

