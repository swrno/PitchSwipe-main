// Run: npm test -- claims
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import type { LlmProvider, LlmRequest } from "../../../shared/lib/ai";
import { rateLimit, resetRateLimits } from "../../../shared/lib/ratelimit";
import { takesEffort } from "../../../shared/lib/ai/anthropic-provider";
import {
  DEFAULT_VOICE_LANGUAGE,
  LANGUAGE_NAMES,
  VOICE_LANGUAGES,
  VOICE_LANGUAGE_STORAGE_KEY,
  defaultVoiceLanguage,
  englishNumberWords,
  hasIndianScript,
  isEnglish,
  isVoiceLanguage,
  languageCodeFor,
  languageLabel,
} from "../languages";
import {
  MIC_OPEN_ANNOUNCEMENT,
  NOTHING_HEARD,
  dictationErrorMessage,
  joinResults,
  voiceStatusLine,
  type SpeechResultListLike,
} from "../ui/dictation";
import { appendComment, voiceIdToken, type IdTokenUser } from "../ui/client";
import { MAX_COMMENT_CHARS, VOICE_TRANSLATE_CLIENT_TIMEOUT_MS, VOICE_TRANSLATE_LLM_TIMEOUT_MS } from "../rules";
import {
  DAILY_TRANSLATIONS_PER_USER,
  MAX_VOICE_TEXT_CHARS,
  TRANSLATE_PROVIDER_OPTIONS,
  asciiDigits,
  handleVoiceText,
  keepsFigures,
  parseVoiceTextBody,
  translateProviderFromEnv,
  translateVoiceText,
  translationRequest,
  type VerifyResult,
  type VoiceTextDeps,
} from "../voice-text";

/** A provider that answers with fixed text and records every request. */
function fakeProvider(reply: string | (() => never)): LlmProvider & { calls: LlmRequest[] } {
  const calls: LlmRequest[] = [];
  return {
    name: "fake",
    model: "fake-1",
    calls,
    async complete(request) {
      calls.push(request);
      if (typeof reply === "function") reply();
      return { text: reply as string, model: "fake-1" };
    },
  };
}

const GUID = "abcdefgh12";

describe("voice languages", () => {
  it("lists the eleven languages, English (India) first and default", () => {
    assert.equal(VOICE_LANGUAGES.length, 11);
    assert.equal(VOICE_LANGUAGES[0].code, "en-IN");
    assert.equal(DEFAULT_VOICE_LANGUAGE, "en-IN");
    assert.equal(LANGUAGE_NAMES["hi-IN"], "Hindi");
    assert.equal(LANGUAGE_NAMES["ur-IN"], "Urdu");
  });
  it("validates codes and labels them", () => {
    assert.equal(isVoiceLanguage("bn-IN"), true);
    assert.equal(isVoiceLanguage("fr-FR"), false);
    assert.equal(isVoiceLanguage(undefined), false);
    assert.equal(languageLabel("ta-IN"), "Tamil");
    assert.equal(languageLabel("xx-YY"), "xx-YY");
    assert.equal(languageLabel(undefined), "Unknown language");
    assert.equal(isEnglish("en-IN"), true);
    assert.equal(isEnglish("hi-IN"), false);
  });
  it("preselects an Indian browser language, else English (India)", () => {
    assert.equal(defaultVoiceLanguage("hi-IN"), "hi-IN");
    assert.equal(defaultVoiceLanguage("HI-in"), "hi-IN");
    assert.equal(defaultVoiceLanguage("bn"), "bn-IN");
    assert.equal(defaultVoiceLanguage("en-IN"), "en-IN");
    assert.equal(defaultVoiceLanguage("en-US"), "en-IN");
    assert.equal(defaultVoiceLanguage("bn-BD"), "en-IN", "Bengali outside India is not an Indian locale");
    assert.equal(defaultVoiceLanguage("fr-FR"), "en-IN");
    assert.equal(defaultVoiceLanguage(""), "en-IN");
    assert.equal(defaultVoiceLanguage(undefined), "en-IN");
  });
  it("maps a stored label back to its code, and names the storage key", () => {
    assert.equal(languageCodeFor("Urdu"), "ur-IN");
    assert.equal(languageCodeFor("hi-IN"), "hi-IN");
    assert.equal(languageCodeFor("Klingon"), undefined);
    assert.equal(languageCodeFor(undefined), undefined);
    assert.equal(VOICE_LANGUAGE_STORAGE_KEY, "pitchswipe.voiceLanguage");
  });
  it("finds English number words, but not 'one' or words that only contain them", () => {
    assert.deepEqual(englishNumberWords("I would pay Five Thousand rupees, or two lakhs"), ["five", "thousand", "two", "lakhs"]);
    assert.deepEqual(englishNumberWords("This one is often useful. Add UPI, at 299."), []);
  });
  it("skips number words inside hyphenated words, unless the compound is a number", () => {
    assert.deepEqual(englishNumberWords("Good for two-wheeler and four-wheeler owners, a five-star idea."), []);
    assert.deepEqual(englishNumberWords("Good for two‑wheeler owners"), []);
    assert.deepEqual(englishNumberWords("I would pay twenty-five rupees"), ["twenty", "five"]);
    assert.deepEqual(englishNumberWords("twenty-one days"), ["twenty"]);
    assert.deepEqual(englishNumberWords("two-thirds of my friends"), ["two"]);
    assert.deepEqual(englishNumberWords("one or two weeks, hundreds of people"), ["two", "hundreds"]);
  });
  it("spots words left in an Indian script or Urdu", () => {
    assert.equal(hasIndianScript("I will use it in दो weeks"), true);
    assert.equal(hasIndianScript("In মাত্র two"), true);
    assert.equal(hasIndianScript("I would pay 299"), false);
  });
});

describe("dictation helpers", () => {
  const list = (...items: [string, boolean][]): SpeechResultListLike =>
    Object.assign(
      items.map(([transcript, isFinal]) => Object.assign([{ transcript }], { isFinal })),
      { length: items.length },
    ) as unknown as SpeechResultListLike;
  it("joins final and interim words in order", () => {
    assert.equal(joinResults(list([" Reminders on", true], ["WhatsApp  would help ", false])), "Reminders on WhatsApp would help");
    assert.equal(joinResults(list()), "");
    assert.equal(joinResults(list(["Not for me", true], ["I would not pay", true], ["for this", false])), "Not for me I would not pay for this");
  });
  it("does not repeat words when results are cumulative (Chrome on Android)", () => {
    assert.equal(joinResults(list(["hello", true], ["hello how", true], ["hello how are", false])), "hello how are");
    assert.equal(joinResults(list(["मैं 500", true], ["मैं 500 दूंगा", false])), "मैं 500 दूंगा");
    assert.equal(joinResults(list(["same words", true], ["Same words", true])), "Same words");
  });
  it("maps recognizer errors to plain copy and ignores our own abort", () => {
    assert.match(dictationErrorMessage("not-allowed") ?? "", /microphone is blocked/);
    assert.match(dictationErrorMessage("network") ?? "", /internet/);
    assert.match(dictationErrorMessage("audio-capture") ?? "", /microphone/);
    assert.match(dictationErrorMessage("language-not-supported") ?? "", /language/);
    assert.equal(dictationErrorMessage("no-speech"), NOTHING_HEARD);
    assert.equal(dictationErrorMessage("aborted"), null);
    assert.match(dictationErrorMessage("something-new") ?? "", /type your comment/);
  });
  it("keeps the screen-reader status line silent while the microphone may be open", () => {
    assert.equal(MIC_OPEN_ANNOUNCEMENT, "");
    for (const english of [true, false]) {
      for (const stage of ["idle", "translating", "review"] as const) {
        for (const phase of ["waiting", "listening", "stopping"] as const) {
          assert.equal(voiceStatusLine(phase, stage, english), MIC_OPEN_ANNOUNCEMENT, `${phase}/${stage}`);
        }
      }
    }
    assert.equal(voiceStatusLine("idle", "idle", false), "");
    assert.equal(voiceStatusLine("idle", "translating", false), "Translating to English.");
    assert.equal(voiceStatusLine("idle", "translating", true), "One moment.");
    assert.equal(voiceStatusLine("idle", "review", false), "Ready to review.");
  });
});

describe("voice client helpers", () => {
  const fakeUser = (emailVerified: boolean, claim: unknown) => {
    const forced: boolean[] = [];
    const user: IdTokenUser = {
      emailVerified,
      async getIdToken(force) {
        forced.push(force === true);
        return "fresh-token";
      },
      async getIdTokenResult() {
        return { token: "cached-token", claims: { email_verified: claim } };
      },
    };
    return { user, forced };
  };
  it("refreshes a stale token when the email was verified after it was issued", async () => {
    const stale = fakeUser(true, false);
    assert.equal(await voiceIdToken(stale.user), "fresh-token");
    assert.deepEqual(stale.forced, [true]);
  });
  it("uses the cached token when it already says verified, or the user is not verified", async () => {
    const fresh = fakeUser(true, true);
    assert.equal(await voiceIdToken(fresh.user), "cached-token");
    assert.deepEqual(fresh.forced, []);
    const unverified = fakeUser(false, false);
    assert.equal(await voiceIdToken(unverified.user), "cached-token");
    assert.deepEqual(unverified.forced, []);
  });
  it("adds refused voice words to the typed comment, within the limit", () => {
    assert.equal(appendComment("", " मैं 500 दूंगा "), "मैं 500 दूंगा");
    assert.equal(appendComment("Nice idea.  ", "मैं 500 दूंगा"), "Nice idea. मैं 500 दूंगा");
    assert.equal(appendComment("a".repeat(MAX_COMMENT_CHARS - 2), "bcdef").length, MAX_COMMENT_CHARS);
  });
  it("gives the browser a real margin over the server's LLM timeout", () => {
    assert.equal(TRANSLATE_PROVIDER_OPTIONS.timeoutMs, VOICE_TRANSLATE_LLM_TIMEOUT_MS);
    assert.ok(VOICE_TRANSLATE_CLIENT_TIMEOUT_MS - VOICE_TRANSLATE_LLM_TIMEOUT_MS >= 4_000);
  });
});

describe("parseVoiceTextBody", () => {
  const ok = { text: "  namaste   ji ", languageCode: "hi-IN", durationSec: 4.2, swiperGuid: GUID };
  it("accepts a valid body and tidies the text", () => {
    const r = parseVoiceTextBody(ok);
    assert.ok(r.ok);
    assert.equal(r.ok && r.value.text, "namaste ji");
  });
  it("rejects bad input", () => {
    assert.equal(parseVoiceTextBody(null).ok, false);
    assert.equal(parseVoiceTextBody([]).ok, false);
    assert.equal(parseVoiceTextBody({ ...ok, swiperGuid: "x" }).ok, false);
    assert.equal(parseVoiceTextBody({ ...ok, languageCode: "fr-FR" }).ok, false);
    assert.equal(parseVoiceTextBody({ ...ok, text: "   " }).ok, false);
    assert.equal(parseVoiceTextBody({ ...ok, text: 5 }).ok, false);
    assert.equal(parseVoiceTextBody({ ...ok, text: "a".repeat(MAX_VOICE_TEXT_CHARS + 1) }).ok, false);
    assert.equal(parseVoiceTextBody({ ...ok, text: "a".repeat(MAX_VOICE_TEXT_CHARS) }).ok, true);
    assert.equal(parseVoiceTextBody({ ...ok, durationSec: 90 }).ok, false);
    assert.equal(parseVoiceTextBody({ ...ok, durationSec: "x" }).ok, false);
  });
});

describe("figure check", () => {
  it("reads Indian-script digits as ASCII", () => {
    assert.equal(asciiDigits("₹५०० और ৩০ দিন"), "₹500 और 30 দিন");
  });
  it("accepts the same figures and rejects changed, added or dropped ones", () => {
    assert.equal(keepsFigures("I would pay 299 a month", "मैं महीने के 299 दूंगा"), true);
    assert.equal(keepsFigures("I would pay 299 a month", "मैं महीने के २९९ दूंगा"), true);
    assert.equal(keepsFigures("I would pay 199 a month", "मैं महीने के 299 दूंगा"), false);
    assert.equal(keepsFigures("I would pay 299 for 3 months", "मैं महीने के 299 दूंगा"), false);
    assert.equal(keepsFigures("I would pay a little", "मैं महीने के 299 दूंगा"), false);
    // Numbers said in words stay words on both sides, so they are not "added" figures.
    assert.equal(keepsFigures("I would pay five hundred rupees. One more thing: add UPI.", "मैं पांच सौ रुपये दूंगा। एक बात और: UPI जोड़ो।"), true);
    assert.equal(keepsFigures("At 9:30 I pay 1,500.", "9:30 बजे मैं 1500 दूंगा"), true);
  });
});

describe("translateVoiceText", () => {
  it("passes English through with no AI call", async () => {
    const provider = fakeProvider('{"english":"never used"}');
    const r = await translateVoiceText(provider, { text: "Add UPI please", languageCode: "en-IN" });
    assert.deepEqual(r, { transcript: "Add UPI please", english: "Add UPI please", language: "English", translated: "english" });
    assert.equal(provider.calls.length, 0);
  });
  it("translates other languages through the provider, with the text and language in the prompt", async () => {
    const provider = fakeProvider('Sure: {"english":"Reminders on WhatsApp would help. I would pay 299."}');
    const r = await translateVoiceText(provider, { text: "WhatsApp पर रिमाइंडर अच्छे होंगे। मैं 299 दूंगा।", languageCode: "hi-IN" });
    assert.equal(r.english, "Reminders on WhatsApp would help. I would pay 299.");
    assert.equal(r.language, "Hindi");
    assert.equal(r.translated, "ai");
    assert.equal(provider.calls.length, 1);
    assert.match(provider.calls[0].user, /Hindi/);
    assert.match(provider.calls[0].user, /299/);
    assert.match(provider.calls[0].system, /figure/);
  });
  it("without a provider (no LLM key) returns empty English, never placeholder text", async () => {
    const r = await translateVoiceText(null, { text: "নমস্কার", languageCode: "bn-IN" });
    assert.deepEqual(r, { transcript: "নমস্কার", english: "", language: "Bengali", translated: "none" });
  });
  it("drops a translation that changes a figure, and never returns it", async () => {
    const provider = fakeProvider('{"english":"I would pay 199 a month."}');
    const r = await translateVoiceText(provider, { text: "मैं महीने के 299 दूंगा", languageCode: "hi-IN" });
    assert.equal(r.english, "");
    assert.equal(r.translated, "failed");
    assert.equal(r.transcript, "मैं महीने के 299 दूंगा");
  });
  it("asks the model to copy numbers said in words as spoken, and keeps a faithful translation that does", async () => {
    const system = translationRequest("x", "hi-IN").system;
    assert.match(system, /Never write a number in English words/);
    assert.doesNotMatch(system, /stays in words/);
    const provider = fakeProvider('{"english":"I will use it in दो weeks. Good for two-wheeler owners."}');
    const r = await translateVoiceText(provider, {
      text: "मैं इसे दो हफ्ते में इस्तेमाल करूँगा। टू-व्हीलर वालों के लिए अच्छा है।",
      languageCode: "hi-IN",
    });
    assert.equal(r.translated, "ai");
    assert.equal(r.english, "I will use it in दो weeks. Good for two-wheeler owners.");
  });
  it("drops English that carries a number in English words, which the figure check cannot verify", async () => {
    const provider = fakeProvider('{"english":"I would pay five thousand rupees for this."}');
    const original = console.warn;
    console.warn = () => undefined;
    try {
      const r = await translateVoiceText(provider, { text: "मैं इसके लिए पाँच सौ रुपये दूँगा", languageCode: "hi-IN" });
      assert.equal(r.english, "");
      assert.equal(r.translated, "failed");
    } finally {
      console.warn = original;
    }
    const ok = await translateVoiceText(fakeProvider('{"english":"This one is good. I would pay 500."}'), {
      text: "यह अच्छा है। मैं 500 दूँगा",
      languageCode: "hi-IN",
    });
    assert.equal(ok.english, "This one is good. I would pay 500.");
  });
  it("gives empty English on an unreadable, empty or too long answer, or a provider error", async () => {
    const text = "நன்றாக உள்ளது";
    for (const reply of ["no json here", '{"english":""}', '{"english":5}', `{"english":"${"a".repeat(MAX_VOICE_TEXT_CHARS + 1)}"}`]) {
      const r = await translateVoiceText(fakeProvider(reply), { text, languageCode: "ta-IN" });
      assert.equal(r.english, "", reply.slice(0, 20));
    }
    const original = console.error;
    console.error = () => undefined;
    try {
      const failing = fakeProvider(() => {
        throw new Error("upstream down");
      });
      const r = await translateVoiceText(failing, { text, languageCode: "ta-IN" });
      assert.equal(r.english, "");
      assert.equal(r.translated, "failed");
    } finally {
      console.error = original;
    }
  });
});

describe("translateProviderFromEnv", () => {
  it("is null without LLM_API_KEY (no mock English)", () => {
    assert.equal(translateProviderFromEnv({}), null);
  });
  it("uses LLM_TRANSLATE_MODEL when set, else LLM_MODEL", () => {
    assert.equal(translateProviderFromEnv({ LLM_API_KEY: "k", LLM_MODEL: "big", LLM_TRANSLATE_MODEL: "small" })?.model, "small");
    assert.equal(translateProviderFromEnv({ LLM_API_KEY: "k", LLM_MODEL: "big", LLM_TRANSLATE_MODEL: " " })?.model, "big");
    assert.equal(translateProviderFromEnv({ LLM_API_KEY: "k", LLM_MODEL: "big" })?.model, "big");
  });
  it("sends a short, low-effort request with no retries", async () => {
    const sent: Record<string, unknown>[] = [];
    const fetchImpl = (async (_url: unknown, init?: RequestInit) => {
      sent.push(JSON.parse(String(init?.body ?? "{}")));
      const message = {
        id: "msg_1",
        type: "message",
        role: "assistant",
        model: "claude-opus-5-5",
        content: [{ type: "text", text: '{"english":"Good idea."}' }],
        stop_reason: "end_turn",
        stop_details: null,
        usage: { input_tokens: 1, output_tokens: 1 },
      };
      return new Response(JSON.stringify(message), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;
    const provider = translateProviderFromEnv({ LLM_API_KEY: "k" }, { fetchImpl });
    const r = await translateVoiceText(provider, { text: "अच्छा आइडिया है", languageCode: "hi-IN" });
    assert.equal(r.english, "Good idea.");
    assert.equal(sent.length, 1);
    assert.equal(sent[0].max_tokens, TRANSLATE_PROVIDER_OPTIONS.maxTokens);
    assert.ok((sent[0].max_tokens as number) < 16_000);
    assert.deepEqual(sent[0].output_config, { effort: "low" });
    assert.equal(TRANSLATE_PROVIDER_OPTIONS.maxRetries, 0);
  });
  it("does not retry an overloaded or failed call", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls++;
      const error = { type: "error", error: { type: "overloaded_error", message: "Overloaded" } };
      return new Response(JSON.stringify(error), { status: 529, headers: { "content-type": "application/json" } });
    }) as typeof fetch;
    const original = console.error;
    console.error = () => undefined;
    try {
      const provider = translateProviderFromEnv({ LLM_API_KEY: "k" }, { fetchImpl });
      const r = await translateVoiceText(provider, { text: "अच्छा आइडिया है", languageCode: "hi-IN" });
      assert.equal(calls, 1, "one request, no SDK retries");
      assert.equal(r.english, "");
      assert.equal(r.translated, "failed");
    } finally {
      console.error = original;
    }
  });
  it("gives up when the call takes longer than the timeout", { timeout: 5_000 }, async () => {
    let calls = 0;
    // Never answers; rejects only when the SDK aborts the request.
    const fetchImpl = ((_url: unknown, init?: RequestInit) => {
      calls++;
      return new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        signal?.addEventListener("abort", () => reject(new DOMException("The operation was aborted.", "AbortError")), { once: true });
      });
    }) as typeof fetch;
    const original = console.error;
    console.error = () => undefined;
    try {
      const provider = translateProviderFromEnv({ LLM_API_KEY: "k" }, { fetchImpl, timeoutMs: 50 });
      const started = Date.now();
      const r = await translateVoiceText(provider, { text: "अच्छा आइडिया है", languageCode: "hi-IN" });
      assert.equal(r.translated, "failed");
      assert.equal(r.english, "");
      assert.equal(calls, 1, "a timeout is not retried either");
      assert.ok(Date.now() - started < 3_000);
    } finally {
      console.error = original;
    }
  });
  it("sends effort only to models that take it", () => {
    assert.equal(takesEffort("claude-opus-5-5"), true);
    assert.equal(takesEffort("claude-sonnet-5"), true);
    assert.equal(takesEffort("claude-opus-4-8"), true);
    assert.equal(takesEffort("claude-haiku-5-5"), true);
    assert.equal(takesEffort("claude-haiku-4-5"), false);
    assert.equal(takesEffort("claude-haiku-4-5-20251001"), false);
    assert.equal(takesEffort("claude-3-5-haiku-latest"), false);
    assert.equal(takesEffort("some-proxy-model"), false);
  });
});

describe("handleVoiceText (POST /api/voice/transcribe)", () => {
  beforeEach(() => resetRateLimits());

  const verified: VerifyResult = { ok: true, uid: "user-1", emailVerified: true };
  const deps = (over: Partial<VoiceTextDeps> = {}): VoiceTextDeps => ({
    verify: async () => verified,
    provider: () => fakeProvider('{"english":"Good idea."}'),
    ...over,
  });
  const request = (body: unknown, headers: Record<string, string> = {}) =>
    new Request("http://localhost/api/voice/transcribe", {
      method: "POST",
      headers: { "content-type": "application/json", "x-real-ip": "10.0.0.1", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
  const body = { text: "अच्छा आइडिया है", languageCode: "hi-IN", durationSec: 3, swiperGuid: GUID };

  it("answers { transcript, english, language } for a verified user", async () => {
    const res = await handleVoiceText(request(body), deps());
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { transcript: "अच्छा आइडिया है", english: "Good idea.", language: "Hindi" });
  });
  it("does not build a provider for English", async () => {
    let built = 0;
    const res = await handleVoiceText(
      request({ ...body, text: "Good idea", languageCode: "en-IN" }),
      deps({ provider: () => (built++, null) }),
    );
    assert.deepEqual(await res.json(), { transcript: "Good idea", english: "Good idea", language: "English" });
    assert.equal(built, 0);
  });
  it("with no LLM key returns the transcript and empty English", async () => {
    const res = await handleVoiceText(request(body), deps({ provider: () => null }));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { transcript: "अच्छा आइडिया है", english: "", language: "Hindi" });
  });
  it("needs sign-in and a verified email", async () => {
    const out = await handleVoiceText(
      request(body),
      deps({ verify: async () => ({ ok: false, status: 401, code: "unauthenticated", error: "Sign in required." }) }),
    );
    assert.equal(out.status, 401);
    const unverified = await handleVoiceText(request(body), deps({ verify: async () => ({ ...verified, emailVerified: false }) }));
    assert.equal(unverified.status, 403);
    assert.equal((await unverified.json()).code, "unverified");
    const unconfigured = await handleVoiceText(
      request(body),
      deps({ verify: async () => ({ ok: false, status: 503, code: "not_configured", error: "Not set up." }) }),
    );
    assert.equal(unconfigured.status, 503);
  });
  it("validates content type, JSON, fields and size", async () => {
    const check = async (req: Request) => {
      resetRateLimits();
      return (await handleVoiceText(req, deps())).status;
    };
    assert.equal(await check(request(body, { "content-type": "text/plain" })), 415);
    assert.equal(await check(request("{not json")), 400);
    assert.equal(await check(request({ ...body, languageCode: "fr-FR" })), 400);
    assert.equal(await check(request({ ...body, swiperGuid: "?" })), 400);
    assert.equal(await check(request({ ...body, text: "a".repeat(MAX_VOICE_TEXT_CHARS + 1) })), 400);
    assert.equal(await check(request({ ...body, text: "a".repeat(20_000) })), 413);
  });
  it("limits each user to 5 a minute", async () => {
    for (let i = 0; i < 5; i++) assert.equal((await handleVoiceText(request(body), deps())).status, 200);
    const limited = await handleVoiceText(request(body), deps());
    assert.equal(limited.status, 429);
    assert.ok(limited.headers.get("retry-after"));
    const other = await handleVoiceText(request(body), deps({ verify: async () => ({ ...verified, uid: "user-2" }) }));
    assert.equal(other.status, 200);
  });
  it("caps translations per user per day, but not English notes", async () => {
    for (let i = 0; i < DAILY_TRANSLATIONS_PER_USER; i++) rateLimit("voice:user-day:user-1", { limit: DAILY_TRANSLATIONS_PER_USER, windowMs: 86_400_000 });
    const original = console.warn;
    console.warn = () => undefined;
    try {
      const capped = await handleVoiceText(request(body), deps());
      assert.equal(capped.status, 429);
      assert.equal((await capped.json()).code, "daily_limit");
    } finally {
      console.warn = original;
    }
    const english = await handleVoiceText(request({ ...body, text: "Good idea", languageCode: "en-IN" }), deps());
    assert.equal(english.status, 200);
    const noKey = await handleVoiceText(request(body), deps({ provider: () => null }));
    assert.equal(noKey.status, 200, "no AI call, so no daily cap");
  });
  it("limits each IP to 20 a minute before checking the token", async () => {
    let verifies = 0;
    const counting = deps({
      verify: async () => {
        verifies++;
        return { ok: false, status: 401, code: "unauthenticated", error: "Sign in required." };
      },
    });
    for (let i = 0; i < 20; i++) await handleVoiceText(request(body), counting);
    assert.equal((await handleVoiceText(request(body), counting)).status, 429);
    assert.equal(verifies, 20);
  });
});
