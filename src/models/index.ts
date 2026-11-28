/**
 * Mongoose models for the data model in docs/spec/06 §8.2 (v2).
 *
 * Importing this module does NOT connect to MongoDB. Connection happens only
 * when a server path calls connectDb() from src/shared/lib/db.ts.
 */
import { Schema, model, models, type Model } from "mongoose";
import { INDUSTRIES, ROLES, STATES, TEST_VARIABLES } from "@/shared/lib/lists";
import {
  ACCOUNT_ROLES,
  ANSWERS,
  ASSISTANT_EVENT_TYPES,
  AUDIENCE_WHO,
  DECK_STATUSES,
  PRICE_MODES,
  RESPONSE_SOURCES,
} from "@/types";

const { ObjectId } = Schema.Types;

// Mongoose enums take mutable string arrays. Readonly literal tuples make the schema types very slow to check.
const strings = (values: readonly string[]): string[] => [...values];

// Untyped document shape: schemas here are the storage contract, types live in src/types.
type Shape = Record<string, unknown>;

const ref = (name: string) => ({ type: ObjectId, ref: name, index: true });

const userSchema = new Schema<Shape>({
  // Firebase Authentication owns sign-in; this is the Firebase user id (uid).
  firebaseUid: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  // Mirror of Firebase's emailVerified, synced when the ID token is verified.
  emailVerified: { type: Boolean, default: false },
  roles: { type: [{ type: String, enum: strings(ACCOUNT_ROLES) }], default: ["swiper"] },
  role: { type: String, enum: strings(ROLES) },
  state: { type: String, enum: strings(STATES) },
  interests: { type: [{ type: String, enum: strings(INDUSTRIES) }], default: [] },
  qualityScore: { type: Number, min: 0, max: 100, default: 0 },
  counting: { type: Boolean, default: false },
  checkReasons: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now },
});

const productSchema = new Schema<Shape>({
  ownerId: { ...ref("User"), required: true },
  name: { type: String, required: true, trim: true },
  icon: { type: String, default: "" },
  category: { type: String, default: "" },
  industry: { type: String, enum: strings(INDUSTRIES), required: true },
  showOwnerName: { type: Boolean, default: false },
  targetUsers: { type: [{ type: String, enum: strings(ROLES) }], default: [] },
  audience: {
    who: { type: String, enum: strings(AUDIENCE_WHO), default: "everyone" },
    states: { type: [{ type: String, enum: strings(STATES) }], default: [] },
    interests: { type: [{ type: String, enum: strings(INDUSTRIES) }], default: [] },
  },
  deckIds: { type: [{ type: ObjectId, ref: "Deck" }], default: [] },
  insights: {
    text: { type: String },
    sourceDeckIds: { type: [{ type: ObjectId, ref: "Deck" }], default: [] },
    generatedAt: { type: Date },
  },
});

const deckSchema = new Schema<Shape>({
  ownerId: { ...ref("User"), required: true },
  productId: { ...ref("Product"), required: true },
  slug: { type: String, required: true, unique: true, index: true },
  variable: { type: String, enum: strings(TEST_VARIABLES), required: true },
  priceMode: { type: String, enum: strings(PRICE_MODES) },
  shared: { type: Schema.Types.Mixed, default: {} },
  question: { type: String, default: "" },
  positiveLabel: { type: String, default: "Yes, I would" },
  negativeLabel: { type: String, default: "No, I would not" },
  flagName: { type: String, required: true, unique: true },
  experimentId: { type: String },
  featureId: { type: Number },
  optionIds: { type: Schema.Types.Mixed },
  rewardMetricId: { type: String },
  flagsmithError: { type: String },
  // Publish claim while the Flagsmith hook runs (src/features/decks/server/store.ts claimPublish); null when no publish is running.
  publishingAt: { type: Date },
  // Set while a draft save replaces the cards (src/features/decks/server/store-mongo.ts updateDeck), so no publish claims mid-replace.
  editingAt: { type: Date },
  status: { type: String, enum: strings(DECK_STATUSES), default: "draft", index: true },
  decidedAt: { type: Date },
  shippedAt: { type: Date },
  shippedBy: { type: ObjectId, ref: "User" },
  winnerCardId: { type: ObjectId, ref: "Card" },
  listedInFeed: { type: Boolean, default: false },
  boost: {
    perSwipe: { type: Number, default: 0 },
    budget: { type: Number, default: 0 },
    spent: { type: Number, default: 0 },
  },
});

const cardSchema = new Schema<Shape>({
  deckId: { ...ref("Deck"), required: true },
  variantKey: { type: String, required: true },
  value: { type: Schema.Types.Mixed, required: true },
});
cardSchema.index({ deckId: 1, variantKey: 1 }, { unique: true });

const responseSchema = new Schema<Shape>({
  deckId: { ...ref("Deck"), required: true },
  swiperId: { ...ref("User"), required: true },
  source: { type: String, enum: strings(RESPONSE_SOURCES), required: true },
  cardId: { ...ref("Card"), required: true },
  role: { type: String, enum: strings(ROLES) },
  isTargetUser: { type: Boolean, default: false },
  answer: { type: String, enum: strings(ANSWERS), required: true },
  dwellMs: { type: Number, required: true, min: 0 },
  region: { type: String, enum: strings(STATES) },
  valid: { type: Boolean, default: false },
  counted: { type: Boolean, default: false },
  // Flagsmith accepted this swiper's $flag_exposure; reward_claim is only sent for exposed responses.
  exposedToFlagsmith: { type: Boolean },
  comment: { type: String, maxlength: 500 },
  commentVoice: {
    audioUrl: { type: String },
    durationSec: { type: Number, max: 30 },
    language: { type: String },
    transcript: { type: String },
    english: { type: String },
    founderCanPlay: { type: Boolean, default: false },
    // Audio is cleared after this moment (30 days). Enforced on read and by /api/cron/audio-cleanup.
    deleteAfter: { type: Date },
  },
  createdAt: { type: Date, default: Date.now, index: true },
});
// One answer per swiper per deck. Makes the upsert in the swipe store atomic; a racing duplicate is E11000.
responseSchema.index({ deckId: 1, swiperId: 1 }, { unique: true });
// Lets the audio cleanup cron find expired voice notes without a collection scan.
responseSchema.index({ "commentVoice.deleteAfter": 1 }, { sparse: true });

const claimSchema = new Schema<Shape>({
  deckId: { ...ref("Deck"), required: true },
  cardId: { ...ref("Card"), required: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  createdAt: { type: Date, default: Date.now },
});
// One claim per email per deck. Makes the claim upsert atomic; a racing duplicate is E11000.
claimSchema.index({ deckId: 1, email: 1 }, { unique: true });

const siteSchema = new Schema<Shape>({
  productId: { ...ref("Product"), required: true },
  domain: { type: String, required: true },
  lastSeenAt: { type: Date },
  elements: {
    type: [
      {
        flagName: { type: String, required: true },
        currentValue: { type: String, default: "" },
      },
    ],
    default: [],
  },
});

const assistantEventSchema = new Schema<Shape>({
  deckId: { ...ref("Deck"), required: true },
  type: { type: String, enum: strings(ASSISTANT_EVENT_TYPES), required: true },
  chanceBest: {
    type: [{ cardId: { type: ObjectId, ref: "Card" }, chance: { type: Number, min: 0, max: 1 } }],
    default: [],
  },
  swipers: { type: Number, default: 0 },
  checksPassed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

const walletSchema = new Schema<Shape>({
  userId: { ...ref("User"), required: true, unique: true },
  balance: { type: Number, default: 0 },
  entries: {
    type: [
      {
        deckId: { type: ObjectId, ref: "Deck" },
        amount: { type: Number, required: true },
        swipeCount: { type: Number, default: 0 },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  },
});

// After the hackathon; kept so the data model is complete.
const creditsSchema = new Schema<Shape>({
  ownerId: { ...ref("User"), required: true, unique: true },
  decksLeft: { type: Number, default: 0 },
  purchases: { type: [Schema.Types.Mixed], default: [] },
});

// Co-founders of a product. Access needs status "active" (an accepted invite). `tokenHash` is the sha-256 of the invite
// token and is removed on accept; the sparse unique index lets the accept step find the invite by hash.
const productMemberSchema = new Schema<Shape>({
  productId: { ...ref("Product"), required: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  uid: { ...ref("User") },
  role: { type: String, enum: ["cofounder"], default: "cofounder" },
  status: { type: String, enum: ["invited", "active"], default: "invited" },
  tokenHash: { type: String },
  invitedBy: { ...ref("User"), required: true },
  createdAt: { type: Date, default: Date.now },
  acceptedAt: { type: Date },
  expiresAt: { type: Date, required: true },
});
productMemberSchema.index({ productId: 1, email: 1 }, { unique: true });
productMemberSchema.index({ tokenHash: 1 }, { unique: true, sparse: true });
productMemberSchema.index({ uid: 1, status: 1 });

// Saved Ask PitchSwipe chats, one document per (uid, chatId). `chatId` is unique across users, so a chatId that belongs to
// someone else can never be written. Chats expire 90 days after the last update (TTL index on updatedAt).
export const ASK_CHAT_TTL_SECONDS = 90 * 24 * 60 * 60;
const askChatSchema = new Schema<Shape>({
  uid: { ...ref("User"), required: true },
  chatId: { type: String, required: true },
  title: { type: String, default: "" },
  // The UIMessage array (capped by the service); approval signatures are never stored.
  messages: { type: Schema.Types.Mixed, default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
askChatSchema.index({ chatId: 1 }, { unique: true });
askChatSchema.index({ uid: 1, updatedAt: -1 });
askChatSchema.index({ updatedAt: 1 }, { expireAfterSeconds: ASK_CHAT_TTL_SECONDS });

function getModel(name: string, schema: Schema<Shape>): Model<Shape> {
  return models[name] || model(name, schema);
}

export const User = getModel("User", userSchema);
export const Product = getModel("Product", productSchema);
export const Deck = getModel("Deck", deckSchema);
export const Card = getModel("Card", cardSchema);
export const Response = getModel("Response", responseSchema);
export const Claim = getModel("Claim", claimSchema);
export const Site = getModel("Site", siteSchema);
export const AssistantEvent = getModel("AssistantEvent", assistantEventSchema);
export const Wallet = getModel("Wallet", walletSchema);
export const Credits = getModel("Credits", creditsSchema);
export const ProductMember = getModel("ProductMember", productMemberSchema);
export const AskChat = getModel("AskChat", askChatSchema);

export const modelNames = [
  "User",
  "Product",
  "Deck",
  "Card",
  "Response",
  "Claim",
  "Site",
  "AssistantEvent",
  "Wallet",
  "Credits",
  "ProductMember",
  "AskChat",
] as const;
