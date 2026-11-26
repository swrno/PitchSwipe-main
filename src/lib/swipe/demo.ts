/**
 * Demo decks for the swipe feed when MongoDB is not configured. Copy and numbers come from
 * goal/spec/08-build-reference.md and the designs (phone 34, 35, 39, 40), via src/fixtures.
 */
import { FOUNDER, HEADLINE_TEST, LANGUAGE_TEST_COPY } from "@/fixtures";
import type { SwipeDeck } from "./types";

/**
 * "Product UI" screenshots of the demo decks: real PNG files in public/demo (same-origin paths; the
 * image validator renders only data URLs and /demo/ files, never SVG).
 */
const demoScreens = (prefix: string) => [1, 2, 3].map((n) => `/demo/${prefix}-${n}.png`);
const voiceKhataScreens = demoScreens("vk");
const queueLessScreens = demoScreens("ql");
const loadMateScreens = demoScreens("lm");

const VK_DESCRIPTION =
  "Say who bought on credit. Voice Khata tracks dues and reminds buyers politely.";
const BOOSTED = { perSwipe: 2, budget: 410, spent: 0 };
const NOT_BOOSTED = { perSwipe: 0, budget: 0, spent: 0 };

export function demoDecks(): SwipeDeck[] {
  const voiceKhata = {
    name: "Voice Khata",
    icon: "audio-lines",
    category: HEADLINE_TEST.cardCategory,
    industry: "Retail" as const,
    accent: "green" as const,
    showOwnerName: true,
    ownerName: FOUNDER.name,
    targetUsers: [...HEADLINE_TEST.madeFor],
    audience: { who: "everyone" as const, states: [], interests: [] },
  };

  return [
    {
      id: "voice-khata-headline",
      slug: "voice-khata-headline",
      flagName: HEADLINE_TEST.flagName,
      variable: "headline",
      status: "live",
      listedInFeed: true,
      question: "Would you pay Rs 299 a month for this?",
      positiveLabel: HEADLINE_TEST.positiveLabel,
      negativeLabel: HEADLINE_TEST.negativeLabel,
      shared: {
        description: VK_DESCRIPTION,
        reward: HEADLINE_TEST.reward,
        price: HEADLINE_TEST.price,
        productUI: voiceKhataScreens,
      },
      cards: HEADLINE_TEST.variantKeys.map((k) => ({
        id: `voice-khata-headline-${k}`,
        variantKey: k,
        value: HEADLINE_TEST.headlines[k],
      })),
      boost: BOOSTED,
      product: voiceKhata,
    },
    {
      id: "voice-khata-language",
      slug: "voice-khata-language",
      flagName: "deck_voice-khata-language",
      variable: "language",
      status: "live",
      listedInFeed: true,
      question: "Would you pay Rs 299 a month for this?",
      positiveLabel: HEADLINE_TEST.positiveLabel,
      negativeLabel: HEADLINE_TEST.negativeLabel,
      shared: { price: HEADLINE_TEST.price, productUI: voiceKhataScreens },
      cards: [
        {
          id: "voice-khata-language-en",
          variantKey: "A",
          value: {
            language: "English",
            headline: LANGUAGE_TEST_COPY.English,
            description: VK_DESCRIPTION,
            reward: HEADLINE_TEST.reward,
            question: "Would you pay Rs 299 a month for this?",
            positiveLabel: HEADLINE_TEST.positiveLabel,
            negativeLabel: HEADLINE_TEST.negativeLabel,
          },
        },
        {
          id: "voice-khata-language-hi",
          variantKey: "B",
          value: {
            language: "Hindi",
            headline: LANGUAGE_TEST_COPY.Hindi,
            description:
              "बोलिए किसने उधार लिया। Voice Khata बकाया का हिसाब रखता है और शालीनता से याद दिलाता है।",
            reward: LANGUAGE_TEST_COPY.HindiReward,
            question: LANGUAGE_TEST_COPY.HindiQuestion,
            positiveLabel: LANGUAGE_TEST_COPY.HindiAnswers.positive,
            negativeLabel: LANGUAGE_TEST_COPY.HindiAnswers.negative,
          },
        },
      ],
      boost: BOOSTED,
      product: voiceKhata,
    },
    {
      id: "queueless-description",
      slug: "queueless-description",
      flagName: "deck_queueless-description",
      variable: "description",
      status: "live",
      listedInFeed: true,
      question: "Would you book your next visit this way?",
      positiveLabel: "Yes, I would book",
      negativeLabel: "No, I would not",
      shared: {
        headline: "Empty the waiting room. Book by chat.",
        reward: "Get Rs 500 credit at launch",
        price: "Rs 999 / mo",
        productUI: queueLessScreens,
      },
      cards: [
        {
          id: "queueless-description-A",
          variantKey: "A",
          value: "Patients book by chat, watch their place in the queue and arrive just before their turn.",
        },
        {
          id: "queueless-description-B",
          variantKey: "B",
          value: "Book a clinic slot on WhatsApp and see your live token number, so you never wait in line.",
        },
      ],
      boost: BOOSTED,
      product: {
        name: "QueueLess",
        icon: "clinic",
        category: "Clinic bookings · Healthcare",
        industry: "Healthcare",
        accent: "blue",
        showOwnerName: false,
        // Design says "Local clinics", which is not in the standard role list (spec gap).
        targetUsers: ["Doctor"],
        audience: { who: "everyone", states: [], interests: [] },
      },
    },
    {
      id: "loadmate-headline",
      slug: "loadmate-headline",
      flagName: "deck_loadmate-headline",
      variable: "headline",
      status: "live",
      listedInFeed: true,
      question: "Would you try it on your next trip?",
      positiveLabel: "Yes, I would try it",
      negativeLabel: "Not for me",
      shared: {
        description: "Tell LoadMate where you are headed and it finds a paying load for the trip home.",
        reward: "Pay 0% fee on your first 5 loads",
        price: "2% per load",
        productUI: loadMateScreens,
      },
      cards: [
        { id: "loadmate-headline-A", variantKey: "A", value: "Never drive back empty. Find return loads." },
        { id: "loadmate-headline-B", variantKey: "B", value: "Turn every empty trip home into income." },
      ],
      boost: NOT_BOOSTED,
      product: {
        name: "LoadMate",
        icon: "truck",
        category: "Return loads · Logistics",
        industry: "Logistics",
        accent: "purple",
        showOwnerName: false,
        // Design says "Truck owners", which is not in the standard role list (spec gap).
        targetUsers: ["Driver"],
        audience: { who: "everyone", states: [], interests: [] },
      },
    },
  ];
}
