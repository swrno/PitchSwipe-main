"use client";

import * as React from "react";
import { Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  VoiceRequestError,
  transcribeRequest,
  voiceIdToken,
  type Fetcher,
  type TranscriptionResult,
  type VoiceDraft,
} from "@/lib/claims/client";
import { useAuth } from "@/lib/auth/provider";
import { MAX_COMMENT_CHARS, MAX_VOICE_SECONDS, VOICE_TRANSLATE_CLIENT_TIMEOUT_MS, formatClock } from "@/lib/claims/rules";
import {
  NOT_IN_APP,
  NO_SPEECH_SERVICE,
  useDictation,
  useVoiceEngine,
  useVoiceSupport,
  voiceStatusLine,
  type DictationTake,
} from "@/lib/claims/dictation";
import {
  DEFAULT_VOICE_LANGUAGE,
  VOICE_LANGUAGES,
  VOICE_LANGUAGE_STORAGE_KEY,
  defaultVoiceLanguage,
  hasIndianScript,
  isEnglish,
  isVoiceLanguage,
  languageCodeFor,
  languageLabel,
  type VoiceLanguageCode,
} from "@/lib/claims/languages";

const BARS = 28;
const NO_ENGLISH = "We could not translate it. Type the English yourself if you can.";
const NUMBERS_AS_SPOKEN = "Numbers you said in words are left as you said them. Write them in English before you send.";
const TOO_MANY = "Too many voice notes. Wait a minute, or type the English yourself.";
const SIGN_IN_TO_SPEAK = "Sign in and verify your email to leave a voice note.";
const VERIFY_TO_SPEAK = "Verify your email to leave a voice note.";
const SIGN_IN_FIRST = `${SIGN_IN_TO_SPEAK} Type your comment instead.`;
const VERIFY_FIRST = `${VERIFY_TO_SPEAK} Type your comment instead.`;
const MOVED_TO_TEXT = "Your words are in the comment box, so you can send them as a typed comment.";

/** `promise`, or a rejection as soon as `signal` aborts (getIdToken takes no signal of its own). */
function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new DOMException("Aborted", "AbortError"));
    if (signal.aborted) return onAbort();
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

const noopSubscribe = () => () => {};

/** The last language this browser picked, else one from the browser's own language. */
function browserLanguage(): VoiceLanguageCode {
  try {
    const saved = window.localStorage.getItem(VOICE_LANGUAGE_STORAGE_KEY);
    if (isVoiceLanguage(saved)) return saved;
  } catch {
    /* storage blocked */
  }
  return defaultVoiceLanguage(navigator.language);
}

function rememberLanguage(code: VoiceLanguageCode) {
  try {
    window.localStorage.setItem(VOICE_LANGUAGE_STORAGE_KEY, code);
  } catch {
    /* storage blocked */
  }
}

/** Copy for a failed English request when the note is still kept (the swiper types the English). */
function noEnglishNote(error: unknown): string {
  if (error instanceof VoiceRequestError) {
    if (error.code === "rate_limited") return TOO_MANY;
    if (error.code === "daily_limit") return error.message;
  }
  return NO_ENGLISH;
}

/**
 * S8b: "Or say it - up to 30 s". The browser's own speech recognizer turns speech into text while the swiper talks
 * (src/lib/claims/dictation.ts), in the language they picked; inside the Android and iOS apps the phone's own speech
 * service does it instead (src/lib/claims/native-dictation.ts), and no audio is kept there. Only that text goes to /api/voice/transcribe for an
 * English version. The swiper reviews and edits both, then the reviewed text is handed up. The audio is only kept
 * when they tick "Let <founder> play my voice note". Voice notes need a verified email, as the server requires; if
 * the server says no, the words go to the typed comment through `onKeepAsText` instead of being lost.
 */
export function VoiceNote({
  fetcher,
  swiperGuid,
  founder,
  value,
  onChange,
  onKeepAsText,
}: {
  fetcher: Fetcher;
  swiperGuid: string;
  founder: string;
  value: VoiceDraft | null;
  onChange: (draft: VoiceDraft | null) => void;
  /** The server refused the voice note (sign-in or verified email): hand the words to the typed comment. */
  onKeepAsText: (text: string) => void;
}) {
  const { user, configured } = useAuth();
  const support = useVoiceSupport();
  // In the app the phone's own speech service listens, so the copy says "phone" where the browser says "browser".
  const inApp = useVoiceEngine() === "native";
  const fromBrowser = React.useSyncExternalStore(noopSubscribe, browserLanguage, () => DEFAULT_VOICE_LANGUAGE);
  const [picked, setPicked] = React.useState<VoiceLanguageCode | null>(null);
  const lang = picked ?? fromBrowser;

  const [stage, setStage] = React.useState<"idle" | "translating" | "review">(value ? "review" : "idle");
  const [problem, setProblem] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<VoiceDraft | null>(value);
  const [levels, setLevels] = React.useState<number[]>(() => Array(BARS).fill(0.08));
  const run = React.useRef(0);
  const pending = React.useRef<{ controller: AbortController; skipped: boolean } | null>(null);

  async function translate(take: DictationTake, code: VoiceLanguageCode) {
    const attempt = ++run.current;
    const text = take.transcript.slice(0, MAX_COMMENT_CHARS);
    const job = { controller: new AbortController(), skipped: false };
    pending.current = job;
    // Covers the token too, so a hung token refresh still ends; Skip aborts the same controller.
    const timer = window.setTimeout(() => job.controller.abort(), VOICE_TRANSLATE_CLIENT_TIMEOUT_MS);
    setStage("translating");
    let result: TranscriptionResult;
    let note: string | null = null;
    try {
      const idToken = user ? await abortable(voiceIdToken(user), job.controller.signal) : undefined;
      result = await transcribeRequest(fetcher, {
        swiperGuid,
        text,
        languageCode: code,
        durationSec: take.durationSec,
        idToken,
        signal: job.controller.signal,
      });
      if (!result.english && !isEnglish(code)) note = NO_ENGLISH;
      else if (!isEnglish(code) && hasIndianScript(result.english)) note = NUMBERS_AS_SPOKEN;
    } catch (error) {
      if (attempt !== run.current) return;
      // The server will not take a voice note from this swiper: keep the words as a typed comment instead.
      if (error instanceof VoiceRequestError && (error.status === 401 || (error.status === 403 && error.code === "unverified"))) {
        onKeepAsText(text);
        setProblem(`${error.status === 401 ? SIGN_IN_TO_SPEAK : VERIFY_TO_SPEAK} ${MOVED_TO_TEXT}`);
        setStage("idle");
        return;
      }
      // Anything else (skipped, timed out, rate limited, offline, no AI key): keep what was heard; the swiper can type the English.
      result = { transcript: text, english: isEnglish(code) ? text : "", language: languageLabel(code) };
      if (!isEnglish(code) && !job.skipped) note = noEnglishNote(error);
    } finally {
      window.clearTimeout(timer);
      if (pending.current === job) pending.current = null;
    }
    if (attempt !== run.current) return;
    const next: VoiceDraft = {
      ...result,
      durationSec: Math.round(take.durationSec * 10) / 10,
      founderCanPlay: false,
      audio: take.audio ?? undefined,
    };
    setDraft(next);
    onChange(next);
    setNotice(note);
    setStage("review");
  }

  /** Stop waiting for the English; the swiper types it. */
  function skipTranslation() {
    const job = pending.current;
    if (!job) return;
    job.skipped = true;
    job.controller.abort();
  }

  const dictation = useDictation({
    lang,
    maxSeconds: MAX_VOICE_SECONDS,
    onDone: (take) => void translate(take, lang),
    onError: (message) => setProblem(message),
  });

  const { analyser } = dictation;
  React.useEffect(() => {
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
      setLevels((prev) => [...prev.slice(1), Math.max(0.08, Math.min(1, peak / 90))]);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [analyser]);

  function begin() {
    setProblem(null);
    setNotice(null);
    setLevels(Array(BARS).fill(0.08));
    dictation.start();
  }

  function pick(code: string) {
    if (!isVoiceLanguage(code)) return;
    setPicked(code);
    rememberLanguage(code);
  }

  function remove() {
    run.current++;
    pending.current?.controller.abort();
    pending.current = null;
    dictation.cancel();
    setDraft(null);
    onChange(null);
    setProblem(null);
    setNotice(null);
    setStage("idle");
  }

  function update(patch: Partial<VoiceDraft>) {
    setDraft((d) => {
      if (!d) return d;
      const next = { ...d, ...patch };
      onChange(next);
      return next;
    });
  }

  const listening = dictation.phase !== "idle";

  // One status line, always mounted in the same place. It stays silent while the microphone may be open (see
  // voiceStatusLine); the live words, clock and countdown are not in a live region either.
  const status = (
    <p role="status" className="sr-only">
      {voiceStatusLine(dictation.phase, stage, isEnglish(lang))}
    </p>
  );

  if (!listening && stage === "idle") {
    // Sign-in state is checked only where sign-in exists (not on the demo, where the server allows voice notes).
    // Still asking the phone whether it has a speech service (a moment): show nothing yet.
    if (support === "checking") return status;
    const blocked =
      support === "app"
        ? NOT_IN_APP
        : support === "no-speech"
          ? NO_SPEECH_SERVICE
          : support === "browser"
          ? "Voice notes need Chrome, Edge or Safari. Type your comment instead."
          : configured && !user
            ? SIGN_IN_FIRST
            : configured && user && !user.emailVerified
              ? VERIFY_FIRST
              : null;
    if (blocked) {
      return (
        <>
          {status}
          <p className="text-sm text-muted-foreground">{blocked}</p>
        </>
      );
    }
    return (
      <>
        {status}
        <div>
          <button
            type="button"
            onClick={begin}
            className="flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-dashed border-muted-foreground/50 px-3 py-3.5 text-sm font-bold sm:px-4 sm:text-base"
          >
            <Mic aria-hidden className="size-5 shrink-0" />
            Or say it out loud
            <span className="font-normal text-muted-foreground">· up to {MAX_VOICE_SECONDS} s</span>
          </button>
          <label className="mt-2 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            I will speak in
            <select
              value={lang}
              onChange={(e) => pick(e.target.value)}
              className="rounded-lg border border-border bg-background px-2 py-1 text-sm font-semibold text-foreground"
            >
              {VOICE_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.native === l.name ? l.name : `${l.name} · ${l.native}`}
                </option>
              ))}
            </select>
          </label>
          {problem ? (
            <p role="alert" className="mt-2 text-sm text-warning">
              {problem}
            </p>
          ) : null}
        </div>
      </>
    );
  }

  const draftLang = draft ? languageCodeFor(draft.language) : undefined;

  return (
    <>
      {status}
      <div className="rounded-2xl border-2 border-foreground p-4">
        {listening ? (
          <>
            <div className="flex items-center gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-destructive text-white">
                <Mic aria-hidden className="size-5" />
              </span>
              {inApp ? (
                // No level meter in the app: the phone's recognizer holds the microphone, so we never get its sound.
                <div aria-hidden className="h-10 flex-1" />
              ) : (
                <div aria-hidden className="flex h-10 flex-1 items-center gap-[3px]">
                  {levels.map((l, i) => (
                    <span key={i} className="w-[3px] rounded-full bg-accent" style={{ height: `${Math.round(l * 100)}%` }} />
                  ))}
                </div>
              )}
              {dictation.phase === "waiting" ? null : (
                <span className="text-lg font-extrabold tabular-nums">{formatClock(dictation.seconds)}</span>
              )}
            </div>
            <p className="mt-2 text-right text-sm text-muted-foreground">
              {dictation.phase === "waiting"
                ? inApp
                  ? "Waiting for the microphone. Allow it if your phone asks."
                  : "Waiting for the microphone. Allow it if your browser asks."
                : dictation.phase === "stopping"
                  ? "Finishing..."
                  : `Listening · ${Math.max(0, Math.ceil(MAX_VOICE_SECONDS - dictation.seconds))} s left`}
            </p>
            <p className="text-sm text-muted-foreground">Speak in {languageLabel(lang)}, the language you picked.</p>
            {dictation.text ? (
              <p lang={lang} dir="auto" className="mt-2 min-h-12 rounded-xl bg-muted p-3 text-base">
                {dictation.text}
              </p>
            ) : (
              <p lang="en" className="mt-2 min-h-12 rounded-xl bg-muted p-3 text-base text-muted-foreground">
                Your words show up here.
              </p>
            )}
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Button variant="outline" size="lg" className="rounded-2xl" onClick={remove}>
                Delete
              </Button>
              <Button
                size="lg"
                className="rounded-2xl bg-destructive hover:bg-destructive/90"
                onClick={dictation.stop}
                disabled={dictation.phase !== "listening"}
              >
                Stop and keep
              </Button>
            </div>
          </>
        ) : null}

        {!listening && stage === "translating" ? (
          <div className="py-2 text-center">
            <p className="py-2 text-base text-muted-foreground">{isEnglish(lang) ? "One moment..." : "Translating to English..."}</p>
            {isEnglish(lang) ? null : (
              <Button variant="outline" size="lg" className="mt-2 w-full rounded-2xl" onClick={skipTranslation}>
                Skip. I will type the English
              </Button>
            )}
          </div>
        ) : null}

        {!listening && stage === "review" && draft ? (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-accent">Spoken in {draft.language}</p>
              <p className="text-sm text-muted-foreground tabular-nums">Voice note · {formatClock(draft.durationSec)}</p>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Check the words. Fix anything the {inApp ? "phone" : "browser"} misheard.</p>
            <div className="mt-3 space-y-3 rounded-xl bg-muted p-3">
              <label className="block text-sm font-semibold text-muted-foreground">
                What you said
                <textarea
                  value={draft.transcript}
                  onChange={(e) => update({ transcript: e.target.value })}
                  maxLength={MAX_COMMENT_CHARS}
                  rows={2}
                  lang={draftLang}
                  dir="auto"
                  className="mt-1 w-full resize-none rounded-lg border border-border bg-background p-2 text-base font-normal text-foreground"
                />
              </label>
              <label className="block text-sm font-semibold text-muted-foreground">
                In English
                <textarea
                  value={draft.english}
                  onChange={(e) => update({ english: e.target.value })}
                  maxLength={MAX_COMMENT_CHARS}
                  rows={3}
                  lang="en"
                  placeholder="Type it in English"
                  className="mt-1 w-full resize-none rounded-lg border border-border bg-background p-2 text-base font-normal text-foreground placeholder:text-muted-foreground"
                />
              </label>
              {notice ? <p className="text-sm text-warning">{notice}</p> : null}
            </div>
            {draft.audio ? (
              <>
                <p className="mt-3 text-sm text-muted-foreground">
                  {founder} sees the text and the English. {founder} can play your voice only if you allow it.
                </p>
                <label className="mt-3 flex items-center gap-3 text-base">
                  <input
                    type="checkbox"
                    checked={draft.founderCanPlay}
                    onChange={(e) => update({ founderCanPlay: e.target.checked })}
                    className="size-5 accent-[var(--accent)]"
                  />
                  Let {founder} play my voice note
                </label>
                <p className="mt-1 pl-8 text-xs text-muted-foreground">Off by default. If you tick it, the audio is deleted after 30 days.</p>
              </>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">{founder} sees the text and the English. Your voice is not kept.</p>
            )}
            <div className="mt-4">
              <Button variant="outline" size="lg" className="w-full rounded-2xl" onClick={remove}>
                Delete voice note
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}
