/**
 * Voice notes inside the Android and iOS apps. The app's WebView has no speech recognizer, so there we use the phone's
 * own speech service through the Capacitor plugin @capacitor-community/speech-recognition (Google's on Android,
 * Apple's on iOS). The app shell loads the live site, so the plugin is read from `window.Capacitor.Plugins` at call
 * time (as src/lib/feel/haptics.ts does): the web bundle has no native dependency, and an app build without the
 * plugin simply has no `SpeechRecognition` entry.
 *
 * Plain module, no React: src/lib/claims/dictation.ts wraps it in the same hook the browser engine uses, and the tests
 * drive it with a fake plugin. It reports error codes (the Web Speech API's names where one fits); dictation.ts turns
 * them into copy.
 *
 * What the plugin does on a phone (from its source, version 7.0.1):
 *  - start({ partialResults: true }) resolves as soon as listening begins; words then arrive as "partialResults"
 *    events, each one the whole utterance so far (so the text is replaced, never appended).
 *  - Android stops by itself after a pause and sends "listeningState: stopped" BEFORE its last words. iOS sends
 *    "stopped" from stop() before its last words too. So after any end we wait a moment for them.
 *  - Android reports errors after start() only to the already-resolved start call, so they never reach us, and it
 *    sends no "stopped" for them. A watchdog asks isListening() every second to notice that the recognizer has ended.
 *  - Android's stop() never resolves. It is fired and never awaited.
 *  - Android only sends "listeningState: started" when speech begins, so the clock starts when start() resolves.
 */

/** A listener handle. The raw native bridge returns it directly; @capacitor/core's wrapper returns a promise of it. */
export interface NativeListenerHandle {
  remove(): unknown;
}

export interface NativeSpeechEvent {
  matches?: unknown;
  status?: unknown;
}

/** The parts of the SpeechRecognition plugin we use. */
export interface NativeSpeechPlugin {
  available(): Promise<{ available?: boolean }>;
  checkPermissions(): Promise<{ speechRecognition?: string }>;
  requestPermissions(): Promise<{ speechRecognition?: string }>;
  start(options: { language: string; partialResults: boolean; popup: boolean; maxResults: number }): Promise<unknown>;
  stop(): Promise<unknown>;
  isListening?(): Promise<{ listening?: boolean }>;
  getSupportedLanguages?(): Promise<{ languages?: unknown }>;
  addListener(
    eventName: "partialResults" | "listeningState",
    listener: (event: NativeSpeechEvent) => void,
  ): NativeListenerHandle | Promise<NativeListenerHandle>;
}

interface CapacitorLike {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: Record<string, unknown>;
}

function capacitor(): CapacitorLike | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { Capacitor?: CapacitorLike }).Capacitor ?? null;
}

/** True inside the Capacitor Android or iOS app. */
export function inNativeApp(): boolean {
  return capacitor()?.isNativePlatform?.() === true;
}

/** "android", "ios", or "web". */
export function nativePlatform(): string {
  return capacitor()?.getPlatform?.() ?? "web";
}

/** The speech plugin, if this app build has it; null on the web and in an app built without it. */
export function nativeSpeechPlugin(): NativeSpeechPlugin | null {
  const cap = capacitor();
  if (!cap?.isNativePlatform?.()) return null;
  const plugin = cap.Plugins?.SpeechRecognition as Partial<NativeSpeechPlugin> | undefined;
  return plugin && typeof plugin.start === "function" && typeof plugin.addListener === "function"
    ? (plugin as NativeSpeechPlugin)
    : null;
}

/** How long to wait for available() before treating the phone as having no speech service. */
export const PROBE_TIMEOUT_MS = 4000;
/** How long to wait for the phone's last words after the recognizer ends (or after Stop) before going on without them. */
export const NATIVE_STOP_GRACE_MS = 2500;
/** Once words arrive after the end, wait this long for any later (final) words, then finish. */
export const NATIVE_FINAL_WORDS_MS = 400;
/** How often the watchdog asks the plugin whether it is still listening. */
export const NATIVE_WATCHDOG_MS = 1000;
/** How long to wait for the iOS language list before starting anyway. */
const LANGUAGES_TIMEOUT_MS = 2000;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

/** Whether the phone has a speech service the plugin can use. False on a timeout or an error. */
export async function probeNativeSpeech(plugin: NativeSpeechPlugin, timeoutMs = PROBE_TIMEOUT_MS): Promise<boolean> {
  const result = await withTimeout(
    plugin.available().then((r) => r?.available === true),
    timeoutMs,
    false,
  );
  return result;
}

/**
 * The error code for a message the plugin rejects with. Codes are the Web Speech API's where one fits, plus "busy"
 * (the microphone is held by another app).
 */
export function nativeErrorCode(message: unknown): string {
  const text = String((message as { message?: unknown })?.message ?? message ?? "").toLowerCase();
  if (/permission|denied/.test(text)) return "not-allowed";
  if (/restricted|not available/.test(text)) return "service-not-allowed";
  if (/already in use|busy|ongoing/.test(text)) return "busy";
  if (/network|server/.test(text)) return "network";
  if (/no match|no speech/.test(text)) return "no-speech";
  if (/audio/.test(text)) return "audio-capture";
  return "unknown";
}

/** "hi-IN", "hi_IN" and "hi-in" are the same language. */
function sameLanguage(a: string, b: string): boolean {
  return a.replace(/_/g, "-").toLowerCase() === b.replace(/_/g, "-").toLowerCase();
}

/**
 * iOS only (Android 13+ has no language list, and the call may never answer there): false when the phone gives a
 * language list without `lang`. iOS starts with no recognizer at all for an unsupported language and then says
 * nothing, so this is checked first. Unknown (no list, an error, a timeout) counts as supported.
 */
export async function languageSupported(plugin: NativeSpeechPlugin, platform: string, lang: string): Promise<boolean> {
  if (platform !== "ios" || typeof plugin.getSupportedLanguages !== "function") return true;
  const list = await withTimeout(
    plugin.getSupportedLanguages().then((r) => r?.languages),
    LANGUAGES_TIMEOUT_MS,
    undefined,
  );
  if (!Array.isArray(list) || list.length === 0) return true;
  return list.some((code) => typeof code === "string" && sameLanguage(code, lang));
}

const tidy = (text: string) => text.replace(/\s+/g, " ").trim();

/** The best guess in a partialResults event, tidied; "" for none. */
export function bestMatch(event: NativeSpeechEvent | undefined): string {
  const matches = event?.matches;
  if (!Array.isArray(matches)) return "";
  const first = matches[0];
  return typeof first === "string" ? tidy(first) : "";
}

export interface NativeTake {
  transcript: string;
  durationSec: number;
}

export interface NativeDictationOptions {
  /** A BCP 47 code from the language picker, e.g. "hi-IN". */
  lang: string;
  maxSeconds: number;
  /** "android" or "ios". */
  platform: string;
  /** The microphone is live: the clock starts. */
  onLive(): void;
  /** Everything heard so far. */
  onText(text: string): void;
  /** Seconds since the microphone went live (capped at maxSeconds). */
  onTick(seconds: number): void;
  /** The recognizer has ended or was asked to stop; waiting for its last words. */
  onStopping(): void;
  /** The take, once. Never called after onError or cancel(). */
  onDone(take: NativeTake): void;
  /** An error code (see nativeErrorCode; "no-speech" when nothing was heard), once. Never called after cancel(). */
  onError(code: string): void;
}

export interface NativeDictation {
  /** Stop and keep what was heard. */
  stop(): void;
  /** Throw the take away. No callback follows. */
  cancel(): void;
}

/**
 * Starts one voice note on the phone's speech service. Asks for permission first (the time on the prompt is not
 * counted), then listens in `lang` with live words, a `maxSeconds` cap that starts when listening starts, and
 * Stop and keep / Delete. No audio is kept: the phone's recognizer holds the microphone.
 */
export function startNativeDictation(plugin: NativeSpeechPlugin, options: NativeDictationOptions): NativeDictation {
  let text = "";
  let startedAt: number | null = null;
  let endedAt: number | null = null;
  let ending = false;
  let done = false;
  let stopSent = false;
  let tick: ReturnType<typeof setInterval> | undefined;
  let watchdog: ReturnType<typeof setInterval> | undefined;
  let grace: ReturnType<typeof setTimeout> | undefined;
  let settle: ReturnType<typeof setTimeout> | undefined;
  const handles: Promise<NativeListenerHandle | null>[] = [];

  /** Fire and forget: Android's stop() never resolves. */
  const sendStop = () => {
    if (stopSent) return;
    stopSent = true;
    try {
      void Promise.resolve(plugin.stop()).catch(() => undefined);
    } catch {
      /* already stopped */
    }
  };

  const cleanup = () => {
    clearInterval(tick);
    clearInterval(watchdog);
    clearTimeout(grace);
    clearTimeout(settle);
    for (const handle of handles.splice(0)) {
      void handle.then((h) => h?.remove()).catch(() => undefined);
    }
    sendStop();
  };

  const fail = (code: string) => {
    if (done) return;
    done = true;
    cleanup();
    options.onError(code);
  };

  const finish = () => {
    if (done) return;
    done = true;
    cleanup();
    if (!text) {
      options.onError("no-speech");
      return;
    }
    const end = endedAt ?? Date.now();
    const live = startedAt ?? end;
    options.onDone({ transcript: text, durationSec: Math.min(options.maxSeconds, Math.max(0, (end - live) / 1000)) });
  };

  /** The recognizer ended (on its own, or after Stop): wait a moment for its last words. */
  const ended = () => {
    if (done || ending) return;
    ending = true;
    endedAt ??= Date.now();
    clearInterval(tick);
    clearInterval(watchdog);
    options.onStopping();
    grace = setTimeout(finish, NATIVE_STOP_GRACE_MS);
  };

  const stop = () => {
    if (done || ending || startedAt === null) return;
    endedAt = Date.now();
    sendStop();
    ended();
  };

  const goLive = () => {
    if (done || ending || startedAt !== null) return;
    const live = Date.now();
    startedAt = live;
    options.onLive();
    tick = setInterval(() => {
      const elapsed = (Date.now() - live) / 1000;
      options.onTick(Math.min(options.maxSeconds, elapsed));
      if (elapsed >= options.maxSeconds) stop();
    }, 200);
    const isListening = plugin.isListening?.bind(plugin);
    if (isListening) {
      let asking = false;
      watchdog = setInterval(() => {
        if (asking || done || ending) return;
        asking = true;
        isListening()
          .then((r) => {
            if (r?.listening === false) ended();
          })
          .catch(() => undefined)
          .finally(() => {
            asking = false;
          });
      }, NATIVE_WATCHDOG_MS);
    }
  };

  const onResult = (event: NativeSpeechEvent) => {
    if (done) return;
    const heard = bestMatch(event);
    if (!heard) return;
    goLive();
    text = heard;
    options.onText(text);
    if (ending) {
      // Probably the last words: finish shortly, unless more arrive.
      clearTimeout(settle);
      settle = setTimeout(finish, NATIVE_FINAL_WORDS_MS);
    }
  };

  const onState = (event: NativeSpeechEvent) => {
    if (done) return;
    if (event?.status === "started") goLive();
    else if (event?.status === "stopped" && startedAt !== null) ended();
  };

  const listen = (eventName: "partialResults" | "listeningState", listener: (event: NativeSpeechEvent) => void) => {
    const handle = Promise.resolve()
      .then(() => plugin.addListener(eventName, listener))
      .catch(() => null);
    handles.push(handle);
    return handle;
  };

  const run = async () => {
    // Permission first, so the time on the prompt is not counted.
    try {
      let state = (await plugin.checkPermissions())?.speechRecognition;
      if (done) return;
      if (state !== "granted") state = (await plugin.requestPermissions())?.speechRecognition;
      if (done) return;
      if (state !== "granted") return fail("not-allowed");
    } catch (error) {
      return fail(nativeErrorCode(error));
    }
    if (!(await languageSupported(plugin, options.platform, options.lang))) return fail("language-not-supported");
    if (done) return;
    await Promise.all([listen("partialResults", onResult), listen("listeningState", onState)]);
    if (done) return cleanup();
    try {
      await plugin.start({ language: options.lang, partialResults: true, popup: false, maxResults: 1 });
    } catch (error) {
      return fail(nativeErrorCode(error));
    }
    if (done) {
      // Deleted while the recognizer was starting: stop it now that it has started.
      stopSent = false;
      return cleanup();
    }
    goLive();
  };
  // After this call returns, so no callback runs before the caller holds the handle.
  void Promise.resolve().then(run);

  return {
    stop,
    cancel() {
      if (done) return;
      done = true;
      cleanup();
    },
  };
}
