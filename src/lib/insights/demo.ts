/**
 * Demo-mode inputs for the Voice Khata insights page (no MongoDB / Flagsmith env). Every per-deck count comes from
 * src/fixtures (VOICE_KHATA_DECK_COUNTS, PRICE_TEST_ARMS, HEADLINE_FLAGSMITH_RESULTS), the same source My decks, Results
 * and Ask read, so the screens cannot drift. The product header uses PRODUCT_TOTALS (612 distinct swipers; the deck
 * rows add up to more because a swiper can answer several decks). The page is labelled "Demo data" in demo mode.
 *
 * Also the demo wording: the mock "model" used when LLM_API_KEY is unset. It writes only the words of
 * the two design cards (no figures, citing {fact.key} placeholders) and only for these demo decks, so a real
 * product never gets invented copy. Everything it writes still goes through the same post-check.
 */
import {
  DECIDED_HEADLINE_TEST,
  HEADLINE_FLAGSMITH_RESULTS,
  HEADLINE_TEST,
  PERSONA_PREVIEW,
  PRICE_TEST_ARMS,
  PRICE_TEST_DESIGN_VALUES,
  VOICE_KHATA_DECK_COUNTS as COUNTS,
} from "@/fixtures";
import type { LlmRequest } from "@/lib/ai";

import type { DeckFacts, PersonaInput } from "./types";

export const DEMO_PRODUCT_ID = "voice-khata";

/** Product UI has 3 screenshot sets; its swipers split 75 / 75 / 74 (demo-only, sums to the fixture's 224). */
const UI_IDENTITIES = [75, 75, 74];

const cards = (identities: number[], chances: number[]): DeckFacts["cards"] =>
  chances.map((chancePct, i) => ({ id: String.fromCharCode(65 + i), chancePct, identities: identities[i] }));

/** Version chances of the decided headline deck (B 96%, A 3%, C 1%), listed A, B, C like the cards. */
const HEADLINE_CHANCES = (["A", "B", "C"] as const).map((k) => Math.round(DECIDED_HEADLINE_TEST.chanceByVariant[k] * 100));

export function demoDecks(): DeckFacts[] {
  return [
    {
      id: "voice-khata-headline",
      index: 1,
      label: "Headline",
      noun: "headline",
      variable: "headline",
      status: "decided",
      finished: true,
      swipers: COUNTS["voice-khata-headline"].swipers,
      saidYes: COUNTS["voice-khata-headline"].saidYes,
      joined: COUNTS["voice-khata-headline"].joined,
      waitlist: COUNTS["voice-khata-headline"].joined,
      comments: COUNTS["voice-khata-headline"].comments,
      leaderText: HEADLINE_TEST.headlines.B,
      leaderChancePct: 96,
      cards: cards(HEADLINE_FLAGSMITH_RESULTS.cards.map((c) => c.identities), HEADLINE_CHANCES),
      srmWarning: false,
      targetSwipers: 71,
      topState: null,
    },
    {
      id: "voice-khata-product-ui",
      index: 2,
      label: "Product UI",
      noun: "product screens",
      variable: "productUI",
      status: "decided",
      finished: true,
      swipers: COUNTS["voice-khata-product-ui"].swipers,
      saidYes: COUNTS["voice-khata-product-ui"].saidYes,
      joined: COUNTS["voice-khata-product-ui"].joined,
      waitlist: COUNTS["voice-khata-product-ui"].joined,
      comments: COUNTS["voice-khata-product-ui"].comments,
      leaderText: "Reminder screens",
      leaderChancePct: 95,
      cards: cards(UI_IDENTITIES, [2, 95, 3]),
      srmWarning: false,
      targetSwipers: null,
      topState: null,
    },
    {
      id: "voice-khata-price",
      index: 3,
      label: "Price",
      noun: "price",
      variable: "price",
      status: "live",
      finished: false,
      swipers: COUNTS["voice-khata-price"].swipers,
      saidYes: COUNTS["voice-khata-price"].saidYes,
      joined: COUNTS["voice-khata-price"].joined,
      waitlist: COUNTS["voice-khata-price"].joined,
      comments: COUNTS["voice-khata-price"].comments,
      leaderText: "Rs 199 / mo",
      leaderChancePct: 88,
      cards: cards(
        PRICE_TEST_ARMS.map((a) => a.swipers),
        PRICE_TEST_ARMS.map((a) => PRICE_TEST_DESIGN_VALUES.chancePctByPrice[a.price]),
      ),
      srmWarning: false,
      targetSwipers: 83,
      topState: null,
    },
    {
      id: "voice-khata-launch-reward",
      index: 4,
      label: "Launch reward",
      noun: "reward",
      variable: "reward",
      status: "decided",
      finished: true,
      swipers: COUNTS["voice-khata-launch-reward"].swipers,
      saidYes: COUNTS["voice-khata-launch-reward"].saidYes,
      joined: COUNTS["voice-khata-launch-reward"].joined,
      waitlist: COUNTS["voice-khata-launch-reward"].joined,
      comments: COUNTS["voice-khata-launch-reward"].comments,
      leaderText: "3 months free at launch",
      leaderChancePct: 97,
      cards: cards([COUNTS["voice-khata-launch-reward"].swipers / 2, COUNTS["voice-khata-launch-reward"].swipers / 2], [2, 97]),
      srmWarning: false,
      targetSwipers: null,
      topState: null,
    },
  ];
}

export const DEMO_SUGGESTION = 'Description: "WhatsApp reminders" vs "Speak your sales"';

export function demoPersona(): PersonaInput {
  return {
    personasPerCard: PERSONA_PREVIEW.personasPerCard,
    totalPersonas: PERSONA_PREVIEW.totalPersonas,
    picks: Object.entries(PERSONA_PREVIEW.picksOfTwenty).map(([key, count]) => ({ key, count })),
    right: 1,
    finished: 3,
  };
}

/* Demo wording (the mock provider) ---------------------------------------------------- */

interface WordingUser {
  kind?: string;
  facts?: { key: string }[];
  decks?: { id: string }[];
  comments?: { id: string; text: string }[];
}

const parse = (request: LlmRequest): WordingUser => {
  try {
    return JSON.parse(request.user) as WordingUser;
  } catch {
    return {};
  }
};

/** Only the demo decks get the design copy; anything else gets an empty answer and code's template. */
export function demoWording(request: LlmRequest): string {
  const user = parse(request);
  const ids = new Set((user.decks ?? []).map((d) => d.id));
  const keys = (user.facts ?? []).map((f) => f.key);
  if (user.kind === "result" && ids.has("voice-khata-headline") && ids.has("voice-khata-product-ui")) {
    return JSON.stringify({
      title: 'People buy "get paid", not "voice".',
      text: "Every winner talks about collecting dues. The voice feature never won on its own.",
    });
  }
  const leader = keys.find((x) => x.endsWith(".leader"));
  const chance = keys.find((x) => x.endsWith(".chance"));
  if (user.kind === "lead" && ids.has("voice-khata-price") && leader && chance && keys.includes("min")) {
    return JSON.stringify({
      title: "Price matters most to small shops.",
      text: `{${leader}} leads among target users with {${chance}} chance of being best, below the {min} needed. Keep it running before you lock a price.`,
    });
  }
  return "{}";
}

const THEME_RULES: { label: string; test: RegExp }[] = [
  { label: "Not clear what you get", test: /not clear|do not know|clear what/i },
  { label: "Getting paid on time is the pain", test: /paid|money|calling/i },
  { label: "Already have a way, or heard it before", test: /notebook|another app|heard this/i },
];

/** Groups demo comments by keyword. The model only groups ids; code counts them. */
export function demoThemes(request: LlmRequest): string {
  const comments = parse(request).comments ?? [];
  const themes = THEME_RULES.map((r) => ({ label: r.label, commentIds: comments.filter((c) => r.test.test(c.text)).map((c) => c.id) })).filter(
    (t) => t.commentIds.length > 0,
  );
  return JSON.stringify({ themes });
}
