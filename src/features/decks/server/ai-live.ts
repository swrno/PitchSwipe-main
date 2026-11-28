/**
 * Live AI drafting for the deck wizard (real mode with LLM_API_KEY). Pure apart from the provider call, so tests pass
 * a mock provider. Every answer goes through code checks before the founder sees it:
 *  - text versions (headline, description) may not contain any figure: numbers on a card are the founder's to write;
 *  - translations must keep every figure of the English card, unchanged, and add none.
 * Drafts that fail a check are dropped, never "fixed" by code. AI only drafts; it never publishes.
 */
import { ai, extractJson, type LlmProvider } from "@/shared/lib/ai";
import { LANGUAGE_TEXT_KEYS, LIMITS, type CardLanguage, type LanguageValue } from "../fields";
import type { LanguageBase } from "./ai-availability";
import { asciiDigits } from "@/shared/lib/ai/digits";

/** The fields "Draft 3 with AI" can write live. The rest (reward, price, images...) are the founder's. */
export const LIVE_TEXT_VARIABLES = ["headline", "description"] as const;
export type LiveTextVariable = (typeof LIVE_TEXT_VARIABLES)[number];

export function isLiveTextVariable(v: string): v is LiveTextVariable {
  return (LIVE_TEXT_VARIABLES as readonly string[]).includes(v);
}

export interface DraftProductContext {
  name: string;
  category: string;
  targetUsers: string[];
}

const hasFigure = (text: string) => ai.extractNumbers(text).length > 0 || /\d/.test(text);

function clean(text: unknown, max: number): string | null {
  if (typeof text !== "string") return null;
  const t = text.replace(/\s+/g, " ").trim();
  if (!t || t.length > max) return null;
  return t;
}

/**
 * Up to `count` distinct versions of the field under test (problem-, outcome- and price-led angles, spec 05 6.1.1).
 * `idea` is what the card says today (headline and description), so the drafts stay about this product.
 */
export async function draftTextVersionsLive(
  provider: LlmProvider,
  input: { variable: LiveTextVariable; count: number; product: DraftProductContext; idea: { headline: string; description: string } },
): Promise<string[]> {
  const request = ai.threeAnglesPrompt({
    idea: input.idea,
    product: { name: input.product.name, category: input.product.category },
    targetRoles: input.product.targetUsers,
  });
  const { text } = await provider.complete(request);
  const parsed = extractJson(text);
  const angles = Array.isArray(parsed?.angles) ? (parsed.angles as Record<string, unknown>[]) : [];
  const max = input.variable === "headline" ? LIMITS.headline : LIMITS.description;
  const out: string[] = [];
  for (const angle of angles) {
    const t = clean(angle?.[input.variable], max);
    if (!t || hasFigure(t)) continue;
    if (out.some((o) => o.toLowerCase() === t.toLowerCase())) continue;
    out.push(t);
    if (out.length >= input.count) break;
  }
  return out;
}

export interface LanguageDraftOutcome {
  versions: LanguageValue[];
  /** Languages whose draft was dropped, with the first reason (shown to the founder). */
  failed: { language: CardLanguage; reason: string }[];
}

export const LANGUAGE_FIELD_LIMITS: Record<(typeof LANGUAGE_TEXT_KEYS)[number], number> = {
  headline: LIMITS.headline,
  description: LIMITS.description,
  reward: LIMITS.reward,
  question: LIMITS.question,
  positiveLabel: LIMITS.label,
  negativeLabel: LIMITS.label,
};

/** One request per language, in parallel: the whole card, field by field, figures copied exactly (checked by code). */
export async function draftLanguageVersionsLive(
  provider: LlmProvider,
  base: LanguageBase,
  languages: CardLanguage[],
): Promise<LanguageDraftOutcome> {
  const unique = [...new Set(languages)];
  const drafts = await Promise.all(unique.map((language) => draftOneLanguage(provider, base, language)));
  return {
    versions: drafts.flatMap((d) => ("value" in d ? [d.value] : [])),
    failed: drafts.flatMap((d) => ("reason" in d ? [{ language: d.language, reason: d.reason }] : [])),
  };
}

/** System prompt for translating a card: figures are copied, never invented, never turned into words or placeholders. */
export const LANGUAGE_CARD_SYSTEM = [
  "You translate a short product card written for small business owners in India.",
  "Copy every number exactly as written, with the same digits 0-9 (Rs 99 stays Rs 99, 3 stays 3).",
  "Never turn a number into words, never use local-script digits, never use placeholders such as {price}.",
  "Do not add claims, numbers or words that are not in the card. Keep each field about as short as the original.",
  "Reply with JSON only.",
].join("\n");

async function draftOneLanguage(
  provider: LlmProvider,
  base: LanguageBase,
  language: CardLanguage,
): Promise<{ value: LanguageValue } | { language: CardLanguage; reason: string }> {
  if (language === "English") return { value: { language, ...base } };
  const card = Object.fromEntries(LANGUAGE_TEXT_KEYS.map((k) => [k, base[k]]));
  const { text } = await provider.complete({
    task: "language_card",
    // Not ai.SYSTEM_RULES: those forbid typing any number ("use a {key} placeholder"), which made models replace the
    // card's own figures ("Rs 99", "3 months") with placeholders or words, so every translation failed the figure check.
    system: LANGUAGE_CARD_SYSTEM,
    user: JSON.stringify(
      {
        instruction: `Translate every field of this card into ${language}. Keep the meaning and tone, and keep it short. Copy every figure exactly as written. Leave an empty field empty.`,
        card,
        output: `{"card":{${LANGUAGE_TEXT_KEYS.map((k) => `"${k}":"..."`).join(",")}}}`,
      },
      null,
      2,
    ),
    maxTokens: 1200,
  });
  const draft = (extractJson(text)?.card ?? null) as Record<string, unknown> | null;
  if (!draft) return { language, reason: "the answer could not be read" };
  const value = { language } as LanguageValue;
  for (const key of LANGUAGE_TEXT_KEYS) {
    const source = base[key];
    if (!source.trim()) {
      value[key] = "";
      continue;
    }
    // A figure in Hindi or Bengali digits (৩, ३) is the same figure: stored and checked as 0-9, like the English card.
    const t = clean(typeof draft[key] === "string" ? asciiDigits(draft[key] as string) : draft[key], LANGUAGE_FIELD_LIMITS[key]);
    if (!t) return { language, reason: `the ${key} came back empty or too long` };
    if (!ai.checkLanguageDraft(t, source).ok) return { language, reason: `the ${key} changed a figure` };
    value[key] = t;
  }
  return { value };
}
