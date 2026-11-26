// Run: node --import ./scripts/register-ts.mjs --test src/lib/claims/tests/native-dictation.test.ts
// Voice notes in the Android and iOS apps, driven by a fake SpeechRecognition plugin (no phone needed).
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

import {
  NATIVE_STOP_GRACE_MS,
  NATIVE_WATCHDOG_MS,
  bestMatch,
  languageSupported,
  nativeErrorCode,
  nativeSpeechPlugin,
  probeNativeSpeech,
  startNativeDictation,
  type NativeDictationOptions,
  type NativeSpeechEvent,
  type NativeSpeechPlugin,
  type NativeTake,
} from "../native-dictation";
import { NOTHING_HEARD, chooseVoiceSupport, dictationErrorMessage } from "../dictation";

type Listener = (event: NativeSpeechEvent) => void;

/** A fake plugin that behaves like the Android build of @capacitor-community/speech-recognition 7.0.1. */
function fakePlugin(setup: { permission?: string; afterRequest?: string; startError?: string; languages?: unknown; promiseHandles?: boolean } = {}) {
  const listeners = new Map<string, Set<Listener>>();
  const calls: string[] = [];
  let listening = false;
  let startOptions: unknown = null;
  let releaseStart: (() => void) | null = null;
  const plugin: NativeSpeechPlugin & { holdStart: boolean } = {
    holdStart: false,
    async available() {
      return { available: true };
    },
    async checkPermissions() {
      calls.push("checkPermissions");
      return { speechRecognition: setup.permission ?? "granted" };
    },
    async requestPermissions() {
      calls.push("requestPermissions");
      return { speechRecognition: setup.afterRequest ?? "granted" };
    },
    async start(options) {
      calls.push("start");
      startOptions = options;
      if (setup.startError) throw new Error(setup.startError);
      if (plugin.holdStart) await new Promise<void>((resolve) => (releaseStart = resolve));
      listening = true;
      return {};
    },
    stop() {
      calls.push("stop");
      listening = false;
      return new Promise<void>(() => {}); // Android's stop() never resolves.
    },
    async isListening() {
      return { listening };
    },
    async getSupportedLanguages() {
      calls.push("getSupportedLanguages");
      return { languages: setup.languages };
    },
    addListener(eventName, listener) {
      calls.push(`addListener:${eventName}`);
      if (!listeners.has(eventName)) listeners.set(eventName, new Set());
      listeners.get(eventName)!.add(listener);
      const handle = {
        remove() {
          calls.push(`remove:${eventName}`);
          listeners.get(eventName)?.delete(listener);
        },
      };
      return setup.promiseHandles ? Promise.resolve(handle) : handle;
    },
  };
  return {
    plugin,
    calls,
    startOptions: () => startOptions,
    emit(eventName: string, event: NativeSpeechEvent) {
      for (const listener of listeners.get(eventName) ?? []) listener(event);
    },
    listenerCount: () => [...listeners.values()].reduce((n, set) => n + set.size, 0),
    /** The recognizer ends by itself (as after a silent Android error): no event, isListening() says false. */
    endSilently() {
      listening = false;
    },
    releaseStart: () => releaseStart?.(),
  };
}

/** Lets pending promise callbacks run (setImmediate is not mocked). */
async function flush(times = 5) {
  for (let i = 0; i < times; i++) await new Promise((resolve) => setImmediate(resolve));
}

function record(overrides: Partial<NativeDictationOptions> = {}) {
  const events: string[] = [];
  const takes: NativeTake[] = [];
  const errors: string[] = [];
  const texts: string[] = [];
  const options: NativeDictationOptions = {
    lang: "hi-IN",
    maxSeconds: 30,
    platform: "android",
    onLive: () => events.push("live"),
    onText: (text) => texts.push(text),
    onTick: () => undefined,
    onStopping: () => events.push("stopping"),
    onDone: (take) => {
      events.push("done");
      takes.push(take);
    },
    onError: (code) => {
      events.push("error");
      errors.push(code);
    },
    ...overrides,
  };
  return { options, events, takes, errors, texts };
}

describe("engine choice", () => {
  it("uses the browser's recognizer on the web and the plugin in the app", () => {
    assert.equal(chooseVoiceSupport({ native: false, plugin: false, nativeAvailable: null, browserOk: true }), "ok");
    assert.equal(chooseVoiceSupport({ native: false, plugin: false, nativeAvailable: null, browserOk: false }), "browser");
    // In the app the browser path never counts, even if the WebView claims a recognizer.
    assert.equal(chooseVoiceSupport({ native: true, plugin: false, nativeAvailable: null, browserOk: true }), "app");
    assert.equal(chooseVoiceSupport({ native: true, plugin: true, nativeAvailable: null, browserOk: false }), "checking");
    assert.equal(chooseVoiceSupport({ native: true, plugin: true, nativeAvailable: true, browserOk: false }), "ok");
    assert.equal(chooseVoiceSupport({ native: true, plugin: true, nativeAvailable: false, browserOk: true }), "no-speech");
  });

  it("reads the plugin from window.Capacitor only inside the native app", () => {
    const g = globalThis as unknown as { window?: unknown };
    const before = g.window;
    try {
      const { plugin } = fakePlugin();
      g.window = undefined;
      assert.equal(nativeSpeechPlugin(), null);
      g.window = { Capacitor: { isNativePlatform: () => false, Plugins: { SpeechRecognition: plugin } } };
      assert.equal(nativeSpeechPlugin(), null);
      g.window = { Capacitor: { isNativePlatform: () => true, Plugins: { Haptics: {} } } };
      assert.equal(nativeSpeechPlugin(), null, "an app build without the plugin");
      g.window = { Capacitor: { isNativePlatform: () => true, Plugins: { SpeechRecognition: plugin } } };
      assert.equal(nativeSpeechPlugin(), plugin);
    } finally {
      g.window = before;
    }
  });

  it("asks the phone whether it has a speech service, and says no on an error or a timeout", async () => {
    const { plugin } = fakePlugin();
    assert.equal(await probeNativeSpeech(plugin), true);
    assert.equal(await probeNativeSpeech({ ...plugin, available: async () => ({ available: false }) }), false);
    assert.equal(await probeNativeSpeech({ ...plugin, available: async () => Promise.reject(new Error("boom")) }), false);
    assert.equal(await probeNativeSpeech({ ...plugin, available: () => new Promise(() => {}) }, 20), false);
  });
});

describe("native errors and copy", () => {
  it("maps the plugin's messages (Android and iOS) to the existing codes", () => {
    assert.equal(nativeErrorCode(new Error("Missing permission")), "not-allowed");
    assert.equal(nativeErrorCode("User denied access to microphone"), "not-allowed");
    assert.equal(nativeErrorCode("Speech recognition service is not available."), "service-not-allowed");
    assert.equal(nativeErrorCode("Speech recognition restricted on this device"), "service-not-allowed");
    assert.equal(nativeErrorCode("Microphone is already in use by another application."), "busy");
    assert.equal(nativeErrorCode("Ongoing speech recognition"), "busy");
    assert.equal(nativeErrorCode("Network error"), "network");
    assert.equal(nativeErrorCode("No match"), "no-speech");
    assert.equal(nativeErrorCode("Audio recording error"), "audio-capture");
    assert.equal(nativeErrorCode("Something new"), "unknown");
  });

  it("says phone, not browser, in the app; the browser copy is unchanged", () => {
    assert.match(dictationErrorMessage("not-allowed", "native") ?? "", /phone's settings/);
    assert.match(dictationErrorMessage("not-allowed") ?? "", /Allow it in your browser/);
    assert.match(dictationErrorMessage("language-not-supported", "native") ?? "", /This phone cannot listen/);
    assert.match(dictationErrorMessage("busy", "native") ?? "", /in use by another app/);
    assert.match(dictationErrorMessage("network", "native") ?? "", /internet/);
    assert.equal(dictationErrorMessage("no-speech", "native"), NOTHING_HEARD);
    assert.match(dictationErrorMessage("unknown", "native") ?? "", /type your comment/);
    for (const code of ["not-allowed", "service-not-allowed", "language-not-supported", "busy", "unknown"]) {
      assert.doesNotMatch(dictationErrorMessage(code, "native") ?? "", /browser/i, code);
    }
  });

  it("takes the best guess from a results event", () => {
    assert.equal(bestMatch({ matches: ["  मैं  500 दूंगा ", "main 500"] }), "मैं 500 दूंगा");
    assert.equal(bestMatch({ matches: [] }), "");
    assert.equal(bestMatch({ matches: "nope" }), "");
    assert.equal(bestMatch(undefined), "");
  });

  it("checks the language list on iOS only", async () => {
    const ios = fakePlugin({ languages: ["en_US", "hi_IN"] });
    assert.equal(await languageSupported(ios.plugin, "ios", "hi-IN"), true);
    assert.equal(await languageSupported(fakePlugin({ languages: ["en_US"] }).plugin, "ios", "ta-IN"), false);
    assert.equal(await languageSupported(fakePlugin({ languages: [] }).plugin, "ios", "ta-IN"), true, "no list: try anyway");
    const android = fakePlugin({ languages: ["en_US"] });
    assert.equal(await languageSupported(android.plugin, "android", "ta-IN"), true);
    assert.equal(android.calls.length, 0, "Android 13+ has no list and may never answer");
  });
});

describe("native voice note", () => {
  beforeEach(() => mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"], now: 0 }));
  afterEach(() => mock.timers.reset());

  it("listens with live words in the picked language, then Stop keeps the last words", async () => {
    const fake = fakePlugin();
    const run = record();
    const take = startNativeDictation(fake.plugin, run.options);
    assert.equal(fake.calls.length, 0, "nothing runs before the caller holds the handle");
    await flush();
    assert.deepEqual(fake.calls, ["checkPermissions", "addListener:partialResults", "addListener:listeningState", "start"]);
    assert.deepEqual(fake.startOptions(), { language: "hi-IN", partialResults: true, popup: false, maxResults: 1 });
    assert.deepEqual(run.events, ["live"], "the clock starts when start() resolves, not on the first word");

    // Each result is the whole utterance so far: the text is replaced, not appended.
    fake.emit("partialResults", { matches: ["मैं"] });
    fake.emit("partialResults", { matches: ["मैं 500"] });
    assert.deepEqual(run.texts, ["मैं", "मैं 500"]);

    mock.timers.tick(4000);
    take.stop();
    assert.ok(fake.calls.includes("stop"));
    assert.deepEqual(run.events, ["live", "stopping"]);
    // iOS sends "stopped" from stop() before the last words; they still count.
    fake.emit("listeningState", { status: "stopped" });
    fake.emit("partialResults", { matches: ["मैं 500 दूंगा"] });
    mock.timers.tick(NATIVE_STOP_GRACE_MS);
    await flush();
    assert.deepEqual(run.events, ["live", "stopping", "done"]);
    assert.deepEqual(run.takes, [{ transcript: "मैं 500 दूंगा", durationSec: 4 }]);
    assert.equal(fake.listenerCount(), 0, "listeners removed");
  });

  it("keeps the words when Android stops by itself after a pause, with the last words after 'stopped'", async () => {
    const fake = fakePlugin();
    const run = record({ lang: "en-IN" });
    startNativeDictation(fake.plugin, run.options);
    await flush();
    fake.emit("listeningState", { status: "started" });
    fake.emit("partialResults", { matches: ["reminders on"] });
    mock.timers.tick(2500);
    fake.emit("listeningState", { status: "stopped" });
    assert.deepEqual(run.events, ["live", "stopping"]);
    mock.timers.tick(700);
    fake.emit("partialResults", { matches: ["Reminders on WhatsApp would help", "reminders on what's up"] });
    mock.timers.tick(NATIVE_STOP_GRACE_MS);
    await flush();
    assert.deepEqual(run.takes, [{ transcript: "Reminders on WhatsApp would help", durationSec: 2.5 }]);
  });

  it("keeps taking words through the grace period: a corrected final result replaces an earlier partial", async () => {
    const fake = fakePlugin();
    const run = record({ lang: "en-IN" });
    const take = startNativeDictation(fake.plugin, run.options);
    await flush();
    fake.emit("partialResults", { matches: ["I would pay"] });
    mock.timers.tick(3000);
    take.stop();
    fake.emit("listeningState", { status: "stopped" });
    mock.timers.tick(100);
    fake.emit("partialResults", { matches: ["I would pay 200"] });
    mock.timers.tick(900);
    await flush();
    assert.deepEqual(run.takes, [], "a result after the end does not finish the take early");
    fake.emit("partialResults", { matches: ["I would pay 250"] });
    mock.timers.tick(NATIVE_STOP_GRACE_MS);
    await flush();
    assert.deepEqual(run.takes, [{ transcript: "I would pay 250", durationSec: 3 }]);
  });

  it("goes on without the last words if they never come", async () => {
    const fake = fakePlugin();
    const run = record();
    const take = startNativeDictation(fake.plugin, run.options);
    await flush();
    fake.emit("partialResults", { matches: ["so far"] });
    mock.timers.tick(1000);
    take.stop();
    mock.timers.tick(NATIVE_STOP_GRACE_MS - 1);
    assert.deepEqual(run.takes, []);
    mock.timers.tick(1);
    assert.deepEqual(run.takes, [{ transcript: "so far", durationSec: 1 }]);
  });

  it("stops by itself at the cap", async () => {
    const fake = fakePlugin();
    const ticks: number[] = [];
    const run = record({ onTick: (s) => ticks.push(s) });
    startNativeDictation(fake.plugin, run.options);
    await flush();
    fake.emit("partialResults", { matches: ["a long answer"] });
    // The watchdog sees the recognizer still listening every second.
    for (let i = 0; i < 30; i++) {
      mock.timers.tick(1000);
      await flush(2);
    }
    assert.ok(fake.calls.includes("stop"), "stop sent at 30 s");
    assert.equal(ticks.at(-1), 30);
    mock.timers.tick(NATIVE_STOP_GRACE_MS);
    assert.deepEqual(run.takes, [{ transcript: "a long answer", durationSec: 30 }]);
  });

  it("notices a recognizer that ended without telling us (Android errors after start)", async () => {
    const fake = fakePlugin();
    const run = record();
    startNativeDictation(fake.plugin, run.options);
    await flush();
    fake.endSilently();
    mock.timers.tick(NATIVE_WATCHDOG_MS);
    await flush();
    assert.deepEqual(run.events, ["live", "stopping"]);
    mock.timers.tick(NATIVE_STOP_GRACE_MS);
    assert.deepEqual(run.errors, ["no-speech"]);
    assert.equal(dictationErrorMessage(run.errors[0], "native"), NOTHING_HEARD);
  });

  it("asks for permission first and does not count the time on the prompt", async () => {
    const fake = fakePlugin({ permission: "prompt" });
    let answer: (() => void) | null = null;
    const ask = fake.plugin.requestPermissions;
    fake.plugin.requestPermissions = async () => {
      await new Promise<void>((resolve) => (answer = resolve));
      return ask();
    };
    const run = record();
    const take = startNativeDictation(fake.plugin, run.options);
    await flush();
    mock.timers.tick(8000); // the swiper reads the prompt
    assert.deepEqual(run.events, []);
    answer!();
    await flush();
    assert.deepEqual(run.events, ["live"]);
    fake.emit("partialResults", { matches: ["yes"] });
    mock.timers.tick(2000);
    take.stop();
    mock.timers.tick(NATIVE_STOP_GRACE_MS);
    assert.deepEqual(run.takes, [{ transcript: "yes", durationSec: 2 }]);
  });

  it("explains a refused permission and never starts", async () => {
    const fake = fakePlugin({ permission: "prompt", afterRequest: "denied" });
    const run = record();
    startNativeDictation(fake.plugin, run.options);
    await flush();
    assert.deepEqual(run.errors, ["not-allowed"]);
    assert.ok(!fake.calls.includes("start"));
  });

  it("maps a failed start and removes its listeners", async () => {
    const fake = fakePlugin({ startError: "Speech recognition service is not available." });
    const run = record();
    startNativeDictation(fake.plugin, run.options);
    await flush();
    assert.deepEqual(run.errors, ["service-not-allowed"]);
    assert.equal(fake.listenerCount(), 0);
  });

  it("refuses a language the iPhone cannot listen in before starting", async () => {
    const fake = fakePlugin({ languages: ["en_US", "hi_IN"] });
    const run = record({ platform: "ios", lang: "ta-IN" });
    startNativeDictation(fake.plugin, run.options);
    await flush();
    assert.deepEqual(run.errors, ["language-not-supported"]);
    assert.ok(!fake.calls.includes("start"));
  });

  it("Delete throws the take away: no callback after it, and the recognizer is stopped", async () => {
    const fake = fakePlugin({ promiseHandles: true });
    const run = record();
    const take = startNativeDictation(fake.plugin, run.options);
    await flush();
    fake.emit("partialResults", { matches: ["half a"] });
    take.cancel();
    await flush();
    fake.emit("partialResults", { matches: ["half a thought"] });
    mock.timers.tick(60_000);
    assert.deepEqual(run.events, ["live"]);
    assert.deepEqual(run.texts, ["half a"]);
    assert.ok(fake.calls.includes("stop"));
    assert.equal(fake.listenerCount(), 0, "promise handles (the @capacitor/core wrapper) are removed too");
  });

  it("Delete while the recognizer is still starting stops it once it has started", async () => {
    const fake = fakePlugin();
    fake.plugin.holdStart = true;
    const run = record();
    const take = startNativeDictation(fake.plugin, run.options);
    await flush();
    take.cancel();
    const stopsBefore = fake.calls.filter((c) => c === "stop").length;
    fake.releaseStart();
    await flush();
    assert.equal(fake.calls.filter((c) => c === "stop").length, stopsBefore + 1);
    assert.deepEqual(run.events, []);
  });
});
