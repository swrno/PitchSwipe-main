/**
 * Hand-built live decks for the swipe and claims tests (never imported by the app). Pass them to
 * createMemorySwipeStore(); the app itself reads decks only from MongoDB.
 */
import type { SwipeDeck } from "@/features/swipe/types";

const HEADLINES = {
  A: "Speak your sales. The ledger writes itself.",
  B: "Stop chasing payments. Get paid on time.",
  C: "Your whole ledger for Rs 10 a day.",
} as const;
const REWARD = "Get 3 months free at launch";
const PRICE = "Rs 299 / mo";
const POSITIVE = "Yes, I would pay";
const NEGATIVE = "No, I would not";
const DESCRIPTION = "Say who bought on credit. Voice Khata tracks dues and reminds buyers politely.";
const BOOSTED = { perSwipe: 2, budget: 410, spent: 0 };
const NOT_BOOSTED = { perSwipe: 0, budget: 0, spent: 0 };

export function sampleSwipeDecks(): SwipeDeck[] {
  const voiceKhata = {
    name: "Voice Khata",
    icon: "audio-lines",
    category: "Voice ledger · Retail",
    industry: "Retail" as const,
    accent: "green" as const,
    showOwnerName: true,
    ownerName: "Arjun Sen",
    targetUsers: ["Shop owner", "Wholesaler"] as ("Shop owner" | "Wholesaler")[],
    audience: { who: "everyone" as const, states: [], interests: [] },
  };

  return [
    {
      id: "voice-khata-headline",
      slug: "voice-khata-headline",
      flagName: "deck_voice-khata-headline",
      variable: "headline",
      status: "live",
      listedInFeed: true,
      question: "Would you pay Rs 299 a month for this?",
      positiveLabel: POSITIVE,
      negativeLabel: NEGATIVE,
      shared: { description: DESCRIPTION, reward: REWARD, price: PRICE },
      cards: (["A", "B", "C"] as const).map((k) => ({ id: `voice-khata-headline-${k}`, variantKey: k, value: HEADLINES[k] })),
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
      positiveLabel: POSITIVE,
      negativeLabel: NEGATIVE,
      shared: { price: PRICE },
      cards: [
        {
          id: "voice-khata-language-en",
          variantKey: "A",
          value: {
            language: "English",
            headline: HEADLINES.B,
            description: DESCRIPTION,
            reward: REWARD,
            question: "Would you pay Rs 299 a month for this?",
            positiveLabel: POSITIVE,
            negativeLabel: NEGATIVE,
          },
        },
        {
          id: "voice-khata-language-hi",
          variantKey: "B",
          value: {
            language: "Hindi",
            headline: "पेमेंट के पीछे भागना बंद करें। समय पर पैसा पाएं।",
            description: "बोलिए किसने उधार लिया। Voice Khata बकाया का हिसाब रखता है और शालीनता से याद दिलाता है।",
            reward: "लॉन्च पर 3 महीने मुफ़्त",
            question: "क्या आप इसके लिए हर महीने Rs 299 देंगे?",
            positiveLabel: "हाँ, मैं दूँगा",
            negativeLabel: "नहीं",
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
      shared: { headline: "Empty the waiting room. Book by chat.", reward: "Get Rs 500 credit at launch", price: "Rs 999 / mo" },
      cards: [
        { id: "queueless-description-A", variantKey: "A", value: "Patients book by chat, watch their place in the queue and arrive just before their turn." },
        { id: "queueless-description-B", variantKey: "B", value: "Book a clinic slot on WhatsApp and see your live token number, so you never wait in line." },
      ],
      boost: BOOSTED,
      product: {
        name: "QueueLess",
        icon: "clinic",
        category: "Clinic bookings · Healthcare",
        industry: "Healthcare",
        accent: "blue",
        showOwnerName: false,
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
      shared: { description: "Tell LoadMate where you are headed and it finds a paying load for the trip home.", reward: "Pay 0% fee on your first 5 loads", price: "2% per load" },
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
        targetUsers: ["Driver"],
        audience: { who: "everyone", states: [], interests: [] },
      },
    },
  ];
}
