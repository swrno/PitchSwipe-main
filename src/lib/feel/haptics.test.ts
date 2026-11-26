import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

// The module reads window, navigator and localStorage at call time, so a fake browser per test is enough.
type Call = [string, unknown?];
let calls: Call[];
let vibrations: unknown[];
let store: Map<string, string>;

function fakeNative(withSelection = true) {
  const plugin: Record<string, (arg?: unknown) => Promise<void>> = {
    impact: async (o) => void calls.push(["impact", o]),
    notification: async (o) => void calls.push(["notification", o]),
  };
  if (withSelection) {
    plugin.selectionStart = async () => void calls.push(["selectionStart"]);
    plugin.selectionChanged = async () => void calls.push(["selectionChanged"]);
  }
  return plugin;
}

function install({ native }: { native?: ReturnType<typeof fakeNative> | null }) {
  const g = globalThis as Record<string, unknown>;
  g.window = {
    localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) },
    Capacitor: native ? { isNativePlatform: () => true, Plugins: { Haptics: native } } : undefined,
  };
  Object.defineProperty(globalThis, "navigator", {
    value: { vibrate: (p: unknown) => (vibrations.push(p), true) },
    configurable: true,
  });
}

// A fresh copy of the module per test (it keeps the open native selection in module state).
const fresh = (tag: string) => import(`./haptics.ts?${tag}`) as Promise<typeof import("./haptics")>;

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  calls = [];
  vibrations = [];
  store = new Map();
});

test("native select opens a selection once, then ticks on every call", async () => {
  const { haptic } = await fresh("a");
  install({ native: fakeNative() });
  haptic("select");
  await flush();
  haptic("select");
  await flush();
  assert.deepEqual(calls, [["selectionStart"], ["selectionChanged"], ["selectionChanged"]]);
  assert.deepEqual(vibrations, []);
});

test("native select falls back to a light impact when the plugin has no selection API", async () => {
  const { haptic } = await fresh("b");
  install({ native: fakeNative(false) });
  haptic("select");
  await flush();
  assert.deepEqual(calls, [["impact", { style: "LIGHT" }]]);
});

test("native commit, tick, success and warning map to impact and notification", async () => {
  const { haptic } = await fresh("c");
  install({ native: fakeNative() });
  haptic("commit");
  haptic("tick");
  haptic("success");
  haptic("warning");
  await flush();
  assert.deepEqual(calls, [
    ["impact", { style: "MEDIUM" }],
    ["impact", { style: "LIGHT" }],
    ["notification", { type: "SUCCESS" }],
    ["notification", { type: "WARNING" }],
  ]);
});

test("without the native shell it uses navigator.vibrate", async () => {
  const { haptic } = await fresh("d");
  install({ native: null });
  haptic("select");
  haptic("success");
  assert.deepEqual(vibrations, [10, [12, 60, 22]]);
});

test("turned off: nothing fires", async () => {
  const { haptic, setHapticsEnabled } = await fresh("e");
  install({ native: fakeNative() });
  setHapticsEnabled(false);
  haptic("commit");
  haptic("select");
  await flush();
  assert.deepEqual(calls, []);
});
