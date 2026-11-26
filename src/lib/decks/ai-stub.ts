/**
 * What "Draft with AI" / "Translate with AI" may do right now (pure; the route applies it).
 *  - demo:           fixture drafts, labelled "Demo data" in the UI.
 *  - not_configured: real mode and no LLM key (GROQ_API_KEY or LLM_API_KEY): answer 503, never fixture copy.
 *  - live:           real mode with a key: Claude drafts through `./ai-live` (checked by code before it is returned).
 */
export type DraftAvailability = "demo" | "not_configured" | "live";

export const AI_NOT_CONFIGURED_MESSAGE = "AI drafts need an LLM key to be configured";

export function draftAvailability(opts: { demo: boolean; env: Record<string, string | undefined> }): DraftAvailability {
  if (opts.demo) return "demo";
  return isLlmConfigured(opts.env) ? "live" : "not_configured";
}

/**
 * Demo-mode drafting: fixture copy (labelled "Demo data" in the UI) so the "Draft 3 with AI" and
 * "Translate with AI" buttons work without a key. Real mode never reaches these: it drafts live through
 * `./ai-live`. Nothing here invents numbers.
 */
import { HEADLINE_TEST, LANGUAGE_TEST_COPY } from "@/fixtures";
import { isLlmConfigured } from "@/lib/ai/llm-env";
import type { CardLanguage, LanguageValue } from "./fields";

export interface LanguageBase {
  headline: string;
  description: string;
  reward: string;
  question: string;
  positiveLabel: string;
  negativeLabel: string;
}

const KNOWN: Record<string, Partial<Record<CardLanguage, Partial<LanguageBase>>>> = {
  [LANGUAGE_TEST_COPY.English]: {
    Hindi: {
      headline: LANGUAGE_TEST_COPY.Hindi,
      reward: LANGUAGE_TEST_COPY.HindiReward,
      question: LANGUAGE_TEST_COPY.HindiQuestion,
      positiveLabel: LANGUAGE_TEST_COPY.HindiAnswers.positive,
      negativeLabel: LANGUAGE_TEST_COPY.HindiAnswers.negative,
    },
    Bengali: { headline: LANGUAGE_TEST_COPY.Bengali },
  },
};

/** Draft translations of the whole card. Marked so nobody mistakes a placeholder for a translation. */
export async function draftLanguageVersions(base: LanguageBase, languages: CardLanguage[]): Promise<LanguageValue[]> {
  const known = KNOWN[base.headline] ?? {};
  return languages.map((language) => {
    if (language === "English") return { language, ...base };
    const hit = known[language] ?? {};
    const tag = (s: string) => (s ? `[${language} draft] ${s}` : s);
    return {
      language,
      headline: hit.headline ?? tag(base.headline),
      description: hit.description ?? tag(base.description),
      reward: hit.reward ?? tag(base.reward),
      question: hit.question ?? tag(base.question),
      positiveLabel: hit.positiveLabel ?? tag(base.positiveLabel),
      negativeLabel: hit.negativeLabel ?? tag(base.negativeLabel),
    };
  });
}

/** "Draft 3 with AI": text versions of the field under test. Stub returns fixture headlines only. */
export async function draftTextVersions(variable: string, count: number): Promise<string[]> {
  if (variable === "headline") return Object.values(HEADLINE_TEST.headlines).slice(0, count);
  return [];
}
