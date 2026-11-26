"use client";

/**
 * Voice notes on the browser's own speech recognizer (Web Speech API: Chrome, Edge, Safari). Words appear live as
 * they are heard. A MediaRecorder runs on a microphone stream next to it, so we know the length, can stop at the
 * cap, and keep the audio for the founder only if the swiper allows it. No audio is sent anywhere to get the text.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/* Minimal types for the parts of the Web Speech API we use (not in every TypeScript DOM lib). */
interface SpeechAlternativeLike {
  readonly transcript: string;
}
interface SpeechResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: SpeechAlternativeLike;
}
export interface SpeechResultListLike {
  readonly length: number;
  readonly [index: number]: SpeechResultLike;
}
interface SpeechResultEventLike {
  readonly results: SpeechResultListLike;
}
interface SpeechErrorEventLike {
  readonly error: string;
}
interface SpeechRecognizer {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onaudiostart: (() => void) | null;
  onresult: ((event: SpeechResultEventLike) => void) | null;
  onerror: ((event: SpeechErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechRecognizerCtor = new () => SpeechRecognizer;

function recognizer(): SpeechRecognizerCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognizerCtor; webkitSpeechRecognition?: SpeechRecognizerCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** True inside the Capacitor Android or iOS app. Its WebView has no working speech recognizer. */
function inNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return cap?.isNativePlatform?.() === true;
}

/** "ok": can take a voice note. "app": inside the native app. "browser": this browser has no recognizer or microphone. */
export type VoiceSupport = "ok" | "app" | "browser";

function voiceSupport(): VoiceSupport {
  if (inNativeApp()) return "app";
  const ok = recognizer() !== null && typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function";
  return ok ? "ok" : "browser";
}

const noopSubscribe = () => () => {};

/** Whether (and if not, why not) this browser can take a voice note. "browser" on the server. */
export function useVoiceSupport(): VoiceSupport {
  return useSyncExternalStore(noopSubscribe, voiceSupport, () => "browser");
}

/** Whether this browser can take a voice note (speech recognizer and microphone, not the native app). */
export function useVoiceSupported(): boolean {
  return useVoiceSupport() === "ok";
}

const tidy = (text: string) => text.replace(/\s+/g, " ").trim();

/** True when `longer` is `shorter` plus more words (case-insensitive), or the same. */
function extends_(longer: string, shorter: string): boolean {
  const a = longer.toLowerCase();
  const b = shorter.toLowerCase();
  return a === b || a.startsWith(`${b} `);
}

/**
 * Everything heard so far, final words first, then the words still being guessed. Chrome on Android can send
 * cumulative results, where each one repeats the one before ("hello", "hello how", "hello how are"): a result that
 * the next one simply extends is skipped, so the words are not repeated.
 */
export function joinResults(results: SpeechResultListLike): string {
  const texts: string[] = [];
  for (let i = 0; i < results.length; i++) {
    const text = tidy(results[i]?.[0]?.transcript ?? "");
    if (text) texts.push(text);
  }
  return texts.filter((text, i) => !(i + 1 < texts.length && extends_(texts[i + 1], text))).join(" ");
}

const ERRORS: Record<string, string> = {
  "not-allowed": "The microphone is blocked. Allow it in your browser, or type your comment instead.",
  "service-not-allowed": "Voice typing is turned off in this browser. Type your comment instead.",
  "audio-capture": "We could not find a microphone. Type your comment instead.",
  network: "Voice typing needs an internet connection. Try again, or type your comment instead.",
  "no-speech": "We did not hear anything. Try again, or type your comment instead.",
  "language-not-supported": "This browser cannot listen in that language. Pick another one, or type your comment instead.",
};
export const NOTHING_HEARD = ERRORS["no-speech"];

/** Friendly copy for a recognizer error code. "aborted" is our own cancel and has none. */
export function dictationErrorMessage(code: string): string | null {
  if (code === "aborted") return null;
  return ERRORS[code] ?? "Voice typing stopped. Try again, or type your comment instead.";
}

export interface DictationTake {
  /** What the browser heard. */
  transcript: string;
  durationSec: number;
  /** The recording, or null if this browser could not record next to the recognizer, or the recording missed the start. */
  audio: Blob | null;
}

/** "waiting": asked for the microphone, not live yet (no clock). "listening": live, the clock runs. */
export type DictationPhase = "idle" | "waiting" | "listening" | "stopping";

/**
 * The status line while the microphone may be open: empty. The recognizer is started inside the tap, before React
 * can render anything, so even an announcement made "on the tap" could still be playing when audio capture begins.
 */
export const MIC_OPEN_ANNOUNCEMENT = "";

/**
 * The screen-reader status line for a voice note. It says nothing while the microphone may be open (waiting,
 * listening, stopping): a screen reader on a phone speaker would be heard by the recognizer and its words would land
 * in the transcript. It speaks again only once the recognizer has ended (translating, review).
 */
export function voiceStatusLine(phase: DictationPhase, stage: "idle" | "translating" | "review", english: boolean): string {
  if (phase !== "idle") return MIC_OPEN_ANNOUNCEMENT;
  if (stage === "translating") return english ? "One moment." : "Translating to English.";
  if (stage === "review") return "Ready to review.";
  return "";
}

interface Session {
  rec: SpeechRecognizer;
  /** The microphone stream for the recorder and the level meter; null until (or unless) the browser gives it. */
  stream: MediaStream | null;
  recorder: MediaRecorder | null;
  chunks: Blob[];
  ctx: AudioContext | null;
  /** When the microphone went live (the 30 s clock starts here, not at the tap); null while waiting. */
  startedAt: number | null;
  /** When the recognizer said it was listening. */
  recLiveAt: number | null;
  /** When the recorder started. */
  recorderAt: number | null;
  endedAt: number | null;
  text: string;
  error: string | null;
  recEnded: boolean;
  stopping: boolean;
  done: boolean;
  timer: number | undefined;
  fallback: number | undefined;
}

/** How long to wait for the recognizer's last words after Stop before giving up on them. */
const STOP_GRACE_MS = 2500;
/** A recording that started this long after the recognizer went live misses the first words: it is not offered. */
const LATE_RECORDER_MS = 1000;

/**
 * One voice note at a time. `start()` (call it inside the tap) listens in `lang`; `stop()` keeps what was heard
 * (also called at `maxSeconds`, and when the browser ends on its own after a silence); `cancel()` throws the take away.
 * `onDone` gets the take; `onError` gets copy to show.
 */
export function useDictation(options: {
  lang: string;
  maxSeconds: number;
  onDone: (take: DictationTake) => void;
  onError: (message: string) => void;
}) {
  const [phase, setPhase] = useState<DictationPhase>("idle");
  const [text, setText] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const session = useRef<Session | null>(null);
  const opts = useRef(options);
  useEffect(() => {
    opts.current = options;
  });

  const release = useCallback((s: Session) => {
    window.clearInterval(s.timer);
    window.clearTimeout(s.fallback);
    s.stream?.getTracks().forEach((t) => t.stop());
    void s.ctx?.close().catch(() => undefined);
    if (session.current === s) session.current = null;
    setAnalyser(null);
    setPhase("idle");
  }, []);

  /** Called when the recognizer has ended and the recorder has stopped; hands the take up once. */
  const settle = useCallback(
    (s: Session) => {
      if (s.done || !s.recEnded || (s.recorder && s.recorder.state !== "inactive")) return;
      s.done = true;
      release(s);
      const transcript = s.text.trim();
      if (!transcript) {
        opts.current.onError(s.error ?? NOTHING_HEARD);
        return;
      }
      const ended = s.endedAt ?? Date.now();
      const live = s.startedAt ?? ended;
      const durationSec = Math.min(opts.current.maxSeconds, Math.max(0, (ended - live) / 1000));
      const type = s.recorder?.mimeType || "audio/webm";
      const late = s.recLiveAt !== null && s.recorderAt !== null && s.recorderAt - s.recLiveAt > LATE_RECORDER_MS;
      const audio = s.chunks.length && !late ? new Blob(s.chunks, { type }) : null;
      opts.current.onDone({ transcript, durationSec, audio: audio && audio.size > 0 ? audio : null });
    },
    [release],
  );

  /** The recognizer is done (asked to stop, hit an error, or ended after a silence): stop the recorder too. */
  const recognizerEnded = useCallback(
    (s: Session) => {
      if (s.recEnded) return;
      s.recEnded = true;
      s.endedAt ??= Date.now();
      window.clearInterval(s.timer);
      window.clearTimeout(s.fallback);
      if (s.recorder && s.recorder.state !== "inactive") s.recorder.stop();
      else settle(s);
    },
    [settle],
  );

  const stop = useCallback(() => {
    const s = session.current;
    if (!s || s.stopping) return;
    s.stopping = true;
    s.endedAt = Date.now();
    window.clearInterval(s.timer);
    setPhase("stopping");
    // stop() (not abort) lets the last words arrive before onend. If onend never comes, go on without them.
    s.fallback = window.setTimeout(() => {
      s.rec.onend = null;
      s.rec.onresult = null;
      try {
        s.rec.abort();
      } catch {
        /* already ended */
      }
      recognizerEnded(s);
    }, STOP_GRACE_MS);
    try {
      s.rec.stop();
    } catch {
      recognizerEnded(s);
    }
  }, [recognizerEnded]);

  /**
   * The microphone is live: start the clock and the cap. Called once, by whichever comes first: the recognizer's
   * audiostart event, the recorder's stream, or the first words (for a browser that skips the event).
   */
  const goLive = useCallback(
    (s: Session) => {
      if (s.startedAt !== null || s.done || s.stopping || s.recEnded) return;
      const startedAt = Date.now();
      s.startedAt = startedAt;
      if (session.current === s) setPhase("listening");
      s.timer = window.setInterval(() => {
        const elapsed = (Date.now() - startedAt) / 1000;
        setSeconds(Math.min(opts.current.maxSeconds, elapsed));
        if (elapsed >= opts.current.maxSeconds) stop();
      }, 200);
    },
    [stop],
  );

  const teardown = useCallback(
    (s: Session) => {
      s.done = true;
      s.rec.onaudiostart = null;
      s.rec.onresult = null;
      s.rec.onerror = null;
      s.rec.onend = null;
      try {
        s.rec.abort();
      } catch {
        /* already ended */
      }
      if (s.recorder) {
        s.recorder.onstop = null;
        if (s.recorder.state !== "inactive") s.recorder.stop();
      }
      release(s);
    },
    [release],
  );

  /** Throw this take away. */
  const cancel = useCallback(() => {
    const s = session.current;
    if (s) teardown(s);
    else setPhase("idle");
    setText("");
    setSeconds(0);
  }, [teardown]);

  /** Recorder and level meter on their own microphone stream. Both are optional. */
  const attachMicrophone = useCallback(
    async (s: Session) => {
      let stream: MediaStream;
      try {
        if (!navigator.mediaDevices?.getUserMedia) return;
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        return;
      }
      if (s.done || s.recEnded || s.stopping) {
        // Finished, stopping, cancelled or unmounted while the permission prompt was open: no recording for this take.
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      s.stream = stream;
      try {
        if (typeof MediaRecorder !== "undefined") {
          const recorder = new MediaRecorder(stream);
          recorder.ondataavailable = (e) => {
            if (e.data.size > 0) s.chunks.push(e.data);
          };
          recorder.onstop = () => settle(s);
          recorder.start();
          s.recorder = recorder;
          s.recorderAt = Date.now();
        }
      } catch {
        // Some browsers will not record while the recognizer listens. The text still works; there is just no audio.
        s.recorder = null;
      }
      goLive(s);
      // The level meter is decoration only.
      try {
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (Ctx) {
          const ctx = new Ctx();
          s.ctx = ctx;
          const node = ctx.createAnalyser();
          node.fftSize = 256;
          ctx.createMediaStreamSource(stream).connect(node);
          if (session.current === s) setAnalyser(node);
        }
      } catch {
        /* no meter */
      }
    },
    [goLive, settle],
  );

  /**
   * Starts the recognizer right away, inside the tap (some browsers only allow that), then asks for a microphone
   * stream for the recorder and the level meter. If that stream never comes, the text still works without audio.
   * The phase is "waiting" (no clock) until the microphone is live, so time on a permission prompt is not counted.
   */
  const start = useCallback(() => {
    if (session.current) return;
    const Ctor = recognizer();
    if (!Ctor) {
      opts.current.onError("Voice notes need Chrome, Edge or Safari. Type your comment instead.");
      return;
    }
    const rec = new Ctor();
    rec.lang = opts.current.lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    const s: Session = {
      rec,
      stream: null,
      recorder: null,
      chunks: [],
      ctx: null,
      startedAt: null,
      recLiveAt: null,
      recorderAt: null,
      endedAt: null,
      text: "",
      error: null,
      recEnded: false,
      stopping: false,
      done: false,
      timer: undefined,
      fallback: undefined,
    };

    const recognizerLive = () => {
      s.recLiveAt ??= Date.now();
      goLive(s);
    };
    // audiostart, not start: audio capture has begun, so the permission prompt is over.
    rec.onaudiostart = recognizerLive;
    rec.onresult = (event) => {
      recognizerLive();
      s.text = joinResults(event.results);
      setText(s.text);
    };
    rec.onerror = (event) => {
      const message = dictationErrorMessage(event.error);
      if (message) s.error = message;
    };
    // Chrome ends by itself after a silence: treat that as Stop and keep.
    rec.onend = () => recognizerEnded(s);

    try {
      rec.start();
    } catch {
      opts.current.onError("Voice typing could not start. Try again, or type your comment instead.");
      return;
    }
    session.current = s;
    setText("");
    setSeconds(0);
    setPhase("waiting");

    void attachMicrophone(s);
  }, [attachMicrophone, goLive, recognizerEnded]);

  useEffect(
    () => () => {
      if (session.current) teardown(session.current);
    },
    [teardown],
  );

  return { phase, text, seconds, analyser, start, stop, cancel };
}
