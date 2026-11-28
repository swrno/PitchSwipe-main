/**
 * Server-side validation of a deck (pure, unit-testable).
 *
 * "draft" mode is lenient so a founder can save half-finished work; "publish"
 * mode enforces everything: one variable per deck, 2-3 distinct cards (2-4
 * prices for a best-price test), every locked field present, and the tested
 * field NOT present in the locked set.
 */
import { TEST_VARIABLES, type TestVariable } from "@/shared/lib/lists";
import { PRICE_MODES } from "@/types";
import {
  CARD_LANGUAGES,
  LANGUAGE_TEXT_KEYS,
  LIMITS,
  SHARED_KEYS,
  VARIANT_KEYS,
  cardCountRange,
  requiredSharedKeysFor,
  sharedKeysFor,
} from "./fields";
import { imageDataUrlError } from "./image";
import { checkPriceLevels } from "./price";
import type { DeckInput, FieldError, ValidationResult } from "./types";

export type ValidationMode = "draft" | "publish";

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

function textRule(errors: FieldError[], path: string, value: unknown, label: string, max: number, required: boolean) {
  const s = text(value);
  if (value !== undefined && typeof value !== "string") errors.push({ path, message: `${label} must be text.` });
  else if (required && !s) errors.push({ path, message: `${label} is required.` });
  else if (s.length > max) errors.push({ path, message: `${label} is too long (max ${max} characters).` });
}

function imageRule(errors: FieldError[], path: string, value: unknown) {
  if (typeof value === "string" && value.length > LIMITS.imageChars) return void errors.push({ path, message: "Image is too large." });
  // Data URLs of PNG/JPEG/WebP only: no http(s) links, no SVG (see ./image.ts).
  const problem = imageDataUrlError(value);
  if (problem) errors.push({ path, message: problem });
}

function logoRule(errors: FieldError[], path: string, value: unknown) {
  if (!isObject(value)) {
    errors.push({ path, message: "Logo needs a name and an image." });
    return;
  }
  textRule(errors, `${path}.name`, value.name, "Logo name", LIMITS.logoName, true);
  imageRule(errors, `${path}.src`, value.src);
}

/** Normalised key for "are these two versions identical?". */
function fingerprint(variable: TestVariable, value: unknown): string {
  if (typeof value === "string") return value.trim().toLowerCase();
  if (variable === "logo" && isObject(value)) return `${text(value.name).toLowerCase()}|${text(value.src)}`;
  if (variable === "language" && isObject(value)) return text(value.language).toLowerCase();
  return JSON.stringify(value);
}

export function validateDeck(input: unknown, mode: ValidationMode): ValidationResult {
  const errors: FieldError[] = [];
  const add = (path: string, message: string) => errors.push({ path, message });

  if (!isObject(input)) return { ok: false, errors: [{ path: "", message: "Deck must be an object." }] };

  if (typeof input.productId !== "string" || !input.productId) add("productId", "Pick the product this deck belongs to.");
  const variable = input.variable as TestVariable;
  if (!(TEST_VARIABLES as readonly string[]).includes(variable)) {
    add("variable", "Pick what you are testing (headline, description, reward, price, product UI, logo or language).");
    return { ok: false, errors };
  }

  // Price mode applies to price decks only.
  if (variable === "price") {
    if (input.priceMode !== undefined && !(PRICE_MODES as readonly string[]).includes(String(input.priceMode))) {
      add("priceMode", "Price test must be 'level' (find the best price) or 'framing'.");
    }
    if (mode === "publish" && !input.priceMode) add("priceMode", "Choose Find the best price or Test framing.");
  } else if (input.priceMode !== undefined) {
    add("priceMode", "Price mode only applies to price decks.");
  }
  const priceMode = input.priceMode as DeckInput["priceMode"];

  // Shared (locked) fields: no unknown keys, and the tested field must NOT be locked.
  if (input.shared !== undefined && !isObject(input.shared)) add("shared", "Locked fields must be an object.");
  const shared = isObject(input.shared) ? input.shared : {};
  const allowedShared = sharedKeysFor(variable) as string[];
  for (const key of Object.keys(shared)) {
    if (!(SHARED_KEYS as readonly string[]).includes(key)) add(`shared.${key}`, `Unknown locked field "${key}".`);
    else if (!allowedShared.includes(key)) {
      add(`shared.${key}`, `"${key}" is the field under test, so it cannot also be locked. Only one thing changes between cards.`);
    }
  }
  if (mode === "publish") {
    for (const key of requiredSharedKeysFor(variable)) {
      if (!text(shared[key])) add(`shared.${key}`, `${key[0].toUpperCase()}${key.slice(1)} is required on every card.`);
    }
  }
  textRule(errors, "shared.headline", shared.headline, "Headline", LIMITS.headline, false);
  textRule(errors, "shared.description", shared.description, "Description", LIMITS.description, false);
  textRule(errors, "shared.reward", shared.reward, "Launch reward", LIMITS.reward, false);
  textRule(errors, "shared.price", shared.price, "Price", LIMITS.price, false);
  if (shared.productUI !== undefined) {
    if (!Array.isArray(shared.productUI) || shared.productUI.length > LIMITS.productUiMax) {
      add("shared.productUI", `Product UI takes up to ${LIMITS.productUiMax} images.`);
    } else shared.productUI.forEach((img, i) => imageRule(errors, `shared.productUI.${i}`, img));
  }
  if (shared.logo !== undefined) logoRule(errors, "shared.logo", shared.logo);

  // Swipe question and answers (same on every card; the Language test also translates them per card).
  const publish = mode === "publish";
  textRule(errors, "question", input.question, "Swipe question", LIMITS.question, publish);
  textRule(errors, "positiveLabel", input.positiveLabel, "Positive answer", LIMITS.label, publish);
  textRule(errors, "negativeLabel", input.negativeLabel, "Negative answer", LIMITS.label, publish);

  // Cards.
  if (input.cards !== undefined && !Array.isArray(input.cards)) add("cards", "Cards must be a list.");
  const cards = Array.isArray(input.cards) ? input.cards : [];
  const range = cardCountRange(variable, priceMode);
  if (cards.length > range.max) add("cards", `A ${variable} deck has at most ${range.max} cards.`);
  if (publish && cards.length < range.min) add("cards", `Add at least ${range.min} versions to compare.`);

  cards.forEach((card, i) => {
    if (!isObject(card)) {
      add(`cards.${i}`, "Card must be an object.");
      return;
    }
    if (card.variantKey !== VARIANT_KEYS[i]) add(`cards.${i}.variantKey`, `Card ${i + 1} must be "${VARIANT_KEYS[i]}".`);
    validateCardValue(errors, `cards.${i}.value`, variable, card.value, publish);
  });

  const cardErrors = errors.some((e) => e.path.startsWith("cards."));
  // Two identical versions cannot show a difference.
  if (publish && cards.length > 1 && !cardErrors) {
    const prints = cards.map((c) => fingerprint(variable, isObject(c) ? c.value : undefined));
    prints.forEach((p, i) => {
      if (p && prints.indexOf(p) !== i) add(`cards.${i}.value`, `Version ${VARIANT_KEYS[i]} is the same as an earlier version.`);
    });
  }

  if (variable === "price" && priceMode === "level" && publish && !errors.some((e) => e.path.startsWith("cards"))) {
    const check = checkPriceLevels(cards.map((c) => text((c as { value?: unknown }).value)));
    if (!check.ok) add("cards", check.message ?? "Check the prices.");
  }

  return { ok: errors.length === 0, errors };
}

/** A version the founder has not filled in yet (allowed in a draft, never when publishing). */
function isBlank(variable: TestVariable, value: unknown): boolean {
  if (value === undefined || value === null || value === "") return true;
  if (variable === "productUI") return Array.isArray(value) && value.length === 0;
  if (variable === "logo") return isObject(value) && !text(value.name) && !text(value.src);
  if (variable === "language") {
    return isObject(value) && LANGUAGE_TEXT_KEYS.every((k) => !text(value[k]));
  }
  return false;
}

function validateCardValue(errors: FieldError[], path: string, variable: TestVariable, value: unknown, required: boolean) {
  if (!required && isBlank(variable, value)) return;
  switch (variable) {
    case "headline":
      return textRule(errors, path, value, "Headline", LIMITS.headline, required);
    case "description":
      return textRule(errors, path, value, "Description", LIMITS.description, required);
    case "reward":
      return textRule(errors, path, value, "Launch reward", LIMITS.reward, required);
    case "price":
      return textRule(errors, path, value, "Price", LIMITS.price, required);
    case "productUI": {
      if (!Array.isArray(value) || value.length > LIMITS.productUiMax || (required && value.length === 0)) {
        errors.push({ path, message: `Each version needs 1 to ${LIMITS.productUiMax} screenshots.` });
        return;
      }
      value.forEach((img, i) => imageRule(errors, `${path}.${i}`, img));
      return;
    }
    case "logo":
      if (!required && value === undefined) return;
      return logoRule(errors, path, value);
    case "language": {
      if (!isObject(value)) {
        errors.push({ path, message: "Each language version needs the whole translated card." });
        return;
      }
      if (!(CARD_LANGUAGES as readonly string[]).includes(String(value.language))) {
        errors.push({ path: `${path}.language`, message: "Pick English, Hindi or Bengali." });
      }
      const max = {
        headline: LIMITS.headline,
        description: LIMITS.description,
        reward: LIMITS.reward,
        question: LIMITS.question,
        positiveLabel: LIMITS.label,
        negativeLabel: LIMITS.label,
      };
      for (const key of LANGUAGE_TEXT_KEYS) textRule(errors, `${path}.${key}`, value[key], key, max[key], required);
    }
  }
}
