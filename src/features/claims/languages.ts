/**
 * Languages a swiper can speak a voice note in. The browser's speech recognizer cannot detect the language,
 * so the swiper picks one and we set `recognition.lang` from it. Client and server safe (no imports).
 */
export const VOICE_LANGUAGES = [
  { code: "en-IN", name: "English", native: "English" },
  { code: "hi-IN", name: "Hindi", native: "हिन्दी" },
  { code: "bn-IN", name: "Bengali", native: "বাংলা" },
  { code: "ta-IN", name: "Tamil", native: "தமிழ்" },
  { code: "te-IN", name: "Telugu", native: "తెలుగు" },
  { code: "mr-IN", name: "Marathi", native: "मराठी" },
  { code: "gu-IN", name: "Gujarati", native: "ગુજરાતી" },
  { code: "kn-IN", name: "Kannada", native: "ಕನ್ನಡ" },
  { code: "ml-IN", name: "Malayalam", native: "മലയാളം" },
  { code: "pa-IN", name: "Punjabi", native: "ਪੰਜਾਬੀ" },
  { code: "ur-IN", name: "Urdu", native: "اردو" },
] as const;

export type VoiceLanguageCode = (typeof VOICE_LANGUAGES)[number]["code"];

export const DEFAULT_VOICE_LANGUAGE: VoiceLanguageCode = "en-IN";

/** English names by code ("hi-IN" -> "Hindi"). This is the label stored with a voice note. */
export const LANGUAGE_NAMES: Record<VoiceLanguageCode, string> = Object.fromEntries(
  VOICE_LANGUAGES.map((l) => [l.code, l.name]),
) as Record<VoiceLanguageCode, string>;

export function isVoiceLanguage(code: unknown): code is VoiceLanguageCode {
  return typeof code === "string" && VOICE_LANGUAGES.some((l) => l.code === code);
}

export function languageLabel(code: string | undefined): string {
  if (!code) return "Unknown language";
  return isVoiceLanguage(code) ? LANGUAGE_NAMES[code] : code;
}

/** English needs no translation. */
export function isEnglish(code: string): boolean {
  return code.toLowerCase().startsWith("en");
}

/**
 * The language to preselect from the browser's main language (navigator.language). An Indian language we support
 * ("hi-IN", or a bare "hi") is used; anything else, English included, starts on English (India).
 */
export function defaultVoiceLanguage(browserLanguage: string | undefined): VoiceLanguageCode {
  const tag = (browserLanguage ?? "").trim().toLowerCase();
  if (!tag) return DEFAULT_VOICE_LANGUAGE;
  const exact = VOICE_LANGUAGES.find((l) => l.code.toLowerCase() === tag);
  if (exact) return exact.code;
  const [base, region] = tag.split("-");
  if (base === "en" || (region && region !== "in")) return DEFAULT_VOICE_LANGUAGE;
  return VOICE_LANGUAGES.find((l) => l.code.toLowerCase().startsWith(`${base}-`))?.code ?? DEFAULT_VOICE_LANGUAGE;
}

/** Local-storage key for the language this browser last picked for a voice note (listed in the privacy notice). */
export const VOICE_LANGUAGE_STORAGE_KEY = "pitchswipe.voiceLanguage";

/** The code for a stored language label ("Hindi" -> "hi-IN"), or undefined for an unknown label. */
export function languageCodeFor(label: string | undefined): VoiceLanguageCode | undefined {
  if (!label) return undefined;
  return VOICE_LANGUAGES.find((l) => l.name === label || l.code === label)?.code;
}

/**
 * English number words ("five", "hundred", "lakh"). Numbers said in words cannot be checked against the transcript,
 * so a translation that uses them is not trusted. "one" is left out: it is mostly a pronoun ("this one").
 */
const NUMBER_WORDS =
  "zero|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundreds?|thousands?|lakhs?|lacs?|crores?|millions?|billions?|dozens?";
const NUMBER_WORD = new RegExp(`\\b(?:${NUMBER_WORDS})\\b`, "gi");
/** A word that makes a hyphenated compound a number ("twenty-five", "twenty-one", "two-thirds"). */
const NUMBER_PART = new RegExp(
  `^(?:one|${NUMBER_WORDS}|half|halves|thirds?|quarters?|fourths?|fifths?|sixths?|sevenths?|eighths?|ninths?|tenths?)$`,
  "i",
);
const HYPHENS = "-‐‑";

/**
 * The English number words in a text, lower-cased, in order. A number word inside a hyphenated word is counted only
 * when the word next to it is a number too: "twenty-five" counts, "two-wheeler" and "five-star" do not.
 * (No regex lookbehind: this file also runs in older Safari.)
 */
export function englishNumberWords(text: string): string[] {
  const found: string[] = [];
  for (const m of text.matchAll(NUMBER_WORD)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    const joinedBefore = start > 0 && HYPHENS.includes(text[start - 1]);
    const joinedAfter = end < text.length && HYPHENS.includes(text[end]);
    if (joinedBefore || joinedAfter) {
      const before = joinedBefore ? (/[A-Za-z]+$/.exec(text.slice(0, start - 1))?.[0] ?? "") : "";
      const after = joinedAfter ? (/^[A-Za-z]+/.exec(text.slice(end + 1))?.[0] ?? "") : "";
      if (!NUMBER_PART.test(before) && !NUMBER_PART.test(after)) continue;
    }
    found.push(m[0].toLowerCase());
  }
  return found;
}

/** True when a text has letters in an Indian script or Urdu (in an English translation: words left as spoken). */
export function hasIndianScript(text: string): boolean {
  return /[ऀ-෿؀-ۿ]/.test(text);
}
