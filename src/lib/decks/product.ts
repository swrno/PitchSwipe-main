/** Product settings rules (spec/02 §5.1 "Product settings", "Audience targeting"). Pure. */
import { AUDIENCE_WHO, type AudienceWho } from "@/types";
import { INDUSTRIES, ROLES, STATES, type Industry, type Role, type State } from "@/lib/lists";
import type { FieldError, ValidationResult } from "./types";

export interface ProductInput {
  name: string;
  icon: string;
  category: string;
  industry: Industry;
  showOwnerName: boolean;
  targetUsers: Role[];
  audience: { who: AudienceWho; states: State[]; interests: Industry[] };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function listOf<T extends string>(errors: FieldError[], path: string, value: unknown, allowed: readonly T[], label: string): T[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    errors.push({ path, message: `${label} must be a list.` });
    return [];
  }
  const out: T[] = [];
  for (const item of value) {
    if (!allowed.includes(item as T)) errors.push({ path, message: `"${String(item)}" is not in the ${label} list.` });
    else if (!out.includes(item as T)) out.push(item as T);
  }
  return out;
}

/** Validates and normalises product settings. Nothing is free text for roles, industries or states. */
export function validateProduct(input: unknown): ValidationResult & { value?: ProductInput } {
  const errors: FieldError[] = [];
  if (!isObject(input)) return { ok: false, errors: [{ path: "", message: "Product must be an object." }] };

  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) errors.push({ path: "name", message: "Name is required." });
  else if (name.length > 60) errors.push({ path: "name", message: "Name is too long (max 60 characters)." });

  const category = typeof input.category === "string" ? input.category.trim() : "";
  if (category.length > 60) errors.push({ path: "category", message: "Category line is too long (max 60 characters)." });

  const industry = input.industry as Industry;
  if (!INDUSTRIES.includes(industry)) errors.push({ path: "industry", message: "Pick one industry from the list." });

  const targetUsers = listOf(errors, "targetUsers", input.targetUsers, ROLES, "role");
  const audienceIn = isObject(input.audience) ? input.audience : {};
  const who = (audienceIn.who ?? "everyone") as AudienceWho;
  if (!AUDIENCE_WHO.includes(who)) errors.push({ path: "audience.who", message: "Who must be Everyone or Target users only." });
  const states = listOf(errors, "audience.states", audienceIn.states, STATES, "state");
  const interests = listOf(errors, "audience.interests", audienceIn.interests, INDUSTRIES, "industry");
  if (who === "targetOnly" && targetUsers.length === 0) {
    errors.push({ path: "targetUsers", message: "Pick at least one target user to show decks to target users only." });
  }

  const iconRaw = typeof input.icon === "string" ? input.icon.trim() : "";
  const icon = iconRaw.slice(0, 2) || name.slice(0, 1).toUpperCase();

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    errors,
    value: {
      name,
      icon,
      category,
      industry,
      showOwnerName: input.showOwnerName === true,
      targetUsers,
      audience: { who, states, interests },
    },
  };
}

export type Accent = "green" | "blue" | "purple";
const ACCENTS: Accent[] = ["green", "blue", "purple"];

/** Card accent follows the product (designs: green / blue / purple). Stable per name. */
const KNOWN_ACCENTS: Record<string, Accent> = { "voice khata": "green", queueless: "blue", "ledger for chemists": "green" };

export function accentFor(name: string): Accent {
  const known = KNOWN_ACCENTS[name.trim().toLowerCase()];
  if (known) return known;
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return ACCENTS[hash % ACCENTS.length];
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Deck slug (share link `/d/[slug]`), e.g. "voice-khata-headline-x7k2". */
export function makeDeckSlug(productName: string, variable: string, suffix: string): string {
  return [slugify(productName), slugify(variable), suffix].filter(Boolean).join("-");
}

/** Flag name per deck, as used by WP6 (spec/06 §7: `deck_<id>`). */
export function flagNameFor(slug: string): string {
  return `deck_${slug}`;
}
