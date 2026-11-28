/**
 * New deck form model (pure, client-safe): defaults per test type, and the
 * conversion between the form and the DeckInput the API validates.
 * The server re-validates everything; this only shapes the data.
 */
import type { TestVariable } from "@/shared/lib/lists";
import type { PriceMode } from "@/types";
import {
  CARD_LANGUAGES,
  TESTED_SHARED_KEYS,
  VARIANT_KEYS,
  cardCountRange,
  type CardLanguage,
  type LanguageValue,
  type LogoValue,
  type SharedFields,
} from "./fields";
import type { DeckInput, DeckRecord } from "./types";

/** One version of the field under test. */
export type VersionValue = string | string[] | LogoValue | LanguageValue;

export interface WizardForm {
  productId: string;
  variable: TestVariable;
  priceMode: PriceMode;
  versions: VersionValue[];
  headline: string;
  description: string;
  reward: string;
  price: string;
  productUI: string[];
  logo?: LogoValue;
  question: string;
  positiveLabel: string;
  negativeLabel: string;
  /**
   * Versions written for other test types in this session, so switching back restores them. Browser only:
   * never sent to the API (a deck stores one variable) and not restored from a saved draft.
   */
  stash?: Partial<Record<TestVariable, { versions: VersionValue[]; priceMode: PriceMode }>>;
}

export const DEFAULT_QUESTION = "Would you pay this price?";
export const DEFAULT_POSITIVE = "Yes, I would pay";
export const DEFAULT_NEGATIVE = "No, I would not";

export function blankLanguage(language: CardLanguage): LanguageValue {
  return { language, headline: "", description: "", reward: "", question: "", positiveLabel: "", negativeLabel: "" };
}

function blankVersion(variable: TestVariable, index: number): VersionValue {
  switch (variable) {
    case "productUI":
      return [];
    case "logo":
      return { name: "", src: "" };
    case "language":
      return blankLanguage(CARD_LANGUAGES[index] ?? "English");
    default:
      return "";
  }
}

/** Starting versions: 3 cards (a price test can grow to 4). */
export function defaultVersions(variable: TestVariable, priceMode: PriceMode = "level"): VersionValue[] {
  const { max } = cardCountRange(variable, variable === "price" ? priceMode : undefined);
  return Array.from({ length: Math.min(max, 3) }, (_, i) => blankVersion(variable, i));
}

export function emptyForm(productId: string, variable: TestVariable = "headline"): WizardForm {
  return {
    productId,
    variable,
    priceMode: "level",
    versions: defaultVersions(variable),
    headline: "",
    description: "",
    reward: "",
    price: "",
    productUI: [],
    question: DEFAULT_QUESTION,
    positiveLabel: DEFAULT_POSITIVE,
    negativeLabel: DEFAULT_NEGATIVE,
  };
}

const TEXT_VARIABLES = ["headline", "description", "reward", "price"] as const;
type TextVariable = (typeof TEXT_VARIABLES)[number];
const isTextVariable = (v: TestVariable): v is TextVariable => (TEXT_VARIABLES as readonly string[]).includes(v);
const firstText = (versions: VersionValue[]) =>
  versions.find((v): v is string => typeof v === "string" && v.trim() !== "")?.trim();

/**
 * Changing what you test never throws away what the founder wrote:
 * - the field you leave becomes a locked field again, keeping version A when the locked field is empty
 *   (so a headline written as a version is still the headline after switching to a price test);
 * - the field you switch to starts from its locked value as version A, or from the versions written for it
 *   earlier in this session.
 * The other locked fields carry over unchanged.
 */
export function switchVariable(form: WizardForm, variable: TestVariable): WizardForm {
  if (variable === form.variable) return form;
  const stash = { ...form.stash, [form.variable]: { versions: form.versions, priceMode: form.priceMode } };
  const next: WizardForm = { ...form, variable, stash };

  // 1. Leaving: what was under test goes back into the locked field (only when that field is still empty).
  const from = form.variable;
  if (isTextVariable(from)) {
    const a = firstText(form.versions);
    if (a && !form[from].trim()) next[from] = a;
  } else if (from === "productUI") {
    const a = form.versions.find((v): v is string[] => Array.isArray(v) && v.length > 0);
    if (a && next.productUI.length === 0) next.productUI = a;
  } else if (from === "logo") {
    const a = form.versions.find((v): v is LogoValue => typeof v === "object" && !Array.isArray(v) && "src" in v && Boolean(v.src));
    if (a && !next.logo?.src) next.logo = a;
  } else if (from === "language") {
    const en = form.versions.find((v) => (v as LanguageValue).language === "English") as LanguageValue | undefined;
    if (en) {
      for (const k of ["headline", "description", "reward"] as const) if (en[k].trim() && !next[k].trim()) next[k] = en[k].trim();
    }
  }

  // 2. Arriving: restore this session's versions, else start fresh with the locked value as version A.
  const saved = form.stash?.[variable];
  if (saved) {
    next.versions = saved.versions;
    next.priceMode = saved.priceMode;
    return next;
  }
  next.priceMode = "level";
  next.versions = defaultVersions(variable);
  if (isTextVariable(variable) && next[variable].trim()) next.versions[0] = next[variable].trim();
  else if (variable === "productUI" && next.productUI.length > 0) next.versions[0] = next.productUI;
  else if (variable === "logo" && next.logo?.src) next.versions[0] = next.logo;
  else if (variable === "language") {
    next.versions[0] = {
      ...blankLanguage("English"),
      headline: next.headline,
      description: next.description,
      reward: next.reward,
      question: next.question,
      positiveLabel: next.positiveLabel,
      negativeLabel: next.negativeLabel,
    };
  }
  return next;
}

export function switchPriceMode(form: WizardForm, priceMode: PriceMode): WizardForm {
  const { max } = cardCountRange("price", priceMode);
  return { ...form, priceMode, versions: form.versions.slice(0, max) };
}

export function addVersion(form: WizardForm): WizardForm {
  const { max } = cardCountRange(form.variable, form.variable === "price" ? form.priceMode : undefined);
  if (form.versions.length >= max) return form;
  if (form.variable === "language") {
    const used = form.versions.map((v) => (v as LanguageValue).language);
    const next = CARD_LANGUAGES.find((l) => !used.includes(l));
    if (!next) return form;
    return { ...form, versions: [...form.versions, blankLanguage(next)] };
  }
  return { ...form, versions: [...form.versions, blankVersion(form.variable, form.versions.length)] };
}

export function removeVersion(form: WizardForm, index: number): WizardForm {
  const { min } = cardCountRange(form.variable, form.variable === "price" ? form.priceMode : undefined);
  if (form.versions.length <= min) return form;
  return { ...form, versions: form.versions.filter((_, i) => i !== index) };
}

/** Form -> API body. Locked fields exclude whatever is under test. */
export function toDeckInput(form: WizardForm): DeckInput {
  const tested = TESTED_SHARED_KEYS[form.variable];
  const shared: SharedFields = {};
  const text = (k: "headline" | "description" | "reward" | "price") => {
    if (!tested.includes(k) && form[k].trim()) shared[k] = form[k].trim();
  };
  text("headline");
  text("description");
  text("reward");
  text("price");
  if (!tested.includes("productUI") && form.productUI.length > 0) shared.productUI = form.productUI;
  if (!tested.includes("logo") && form.logo?.src) shared.logo = form.logo;

  // The Language test writes question and answers per card; the deck keeps the English ones as its base.
  const english =
    form.variable === "language"
      ? (form.versions.find((v) => typeof v === "object" && !Array.isArray(v) && (v as LanguageValue).language === "English") as LanguageValue | undefined)
      : undefined;

  return {
    productId: form.productId,
    variable: form.variable,
    ...(form.variable === "price" ? { priceMode: form.priceMode } : {}),
    cards: form.versions.map((value, i) => ({ variantKey: VARIANT_KEYS[i], value })),
    shared,
    question: (english?.question || form.question).trim(),
    positiveLabel: (english?.positiveLabel || form.positiveLabel).trim(),
    negativeLabel: (english?.negativeLabel || form.negativeLabel).trim(),
  };
}

export function fromDeckRecord(deck: DeckRecord): WizardForm {
  const s = deck.shared;
  return {
    productId: deck.productId,
    variable: deck.variable,
    priceMode: deck.priceMode ?? "level",
    versions: deck.cards.length > 0 ? deck.cards.map((c) => c.value as VersionValue) : defaultVersions(deck.variable, deck.priceMode),
    headline: s.headline ?? "",
    description: s.description ?? "",
    reward: s.reward ?? "",
    price: s.price ?? "",
    productUI: s.productUI ?? [],
    logo: s.logo,
    question: deck.question,
    positiveLabel: deck.positiveLabel,
    negativeLabel: deck.negativeLabel,
  };
}

/** Card text for the live preview: the locked fields with version `index` swapped in. */
export interface PreviewCard {
  headline: string;
  description: string;
  reward: string;
  price: string;
  question: string;
  positiveLabel: string;
  negativeLabel: string;
  productUI: string[];
  logo?: LogoValue;
}

export function previewCard(form: WizardForm, index: number): PreviewCard {
  const v = form.versions[index];
  const card: PreviewCard = {
    headline: form.headline,
    description: form.description,
    reward: form.reward,
    price: form.price,
    question: form.question,
    positiveLabel: form.positiveLabel,
    negativeLabel: form.negativeLabel,
    productUI: form.productUI,
    logo: form.logo,
  };
  if (v === undefined) return card;
  switch (form.variable) {
    case "headline":
    case "description":
    case "reward":
    case "price":
      card[form.variable] = typeof v === "string" ? v : "";
      break;
    case "productUI":
      card.productUI = Array.isArray(v) ? v : [];
      break;
    case "logo":
      card.logo = typeof v === "object" && !Array.isArray(v) && "src" in v ? (v as LogoValue) : undefined;
      break;
    case "language": {
      const l = v as LanguageValue;
      Object.assign(card, {
        headline: l.headline,
        description: l.description,
        reward: l.reward,
        question: l.question || form.question,
        positiveLabel: l.positiveLabel || form.positiveLabel,
        negativeLabel: l.negativeLabel || form.negativeLabel,
      });
    }
  }
  return card;
}
