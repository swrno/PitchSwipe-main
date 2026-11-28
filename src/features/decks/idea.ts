import { z } from "zod";
import { INDUSTRIES, ROLES, type Industry, type Role } from "@/shared/lib/lists";
import { LIMITS } from "@/features/decks/fields";
import { asciiDigits } from "@/shared/lib/ai/digits";

/** "Tell me what's on your mind": the founder's own overview, drafted into the fields the wizard already has. */
export const IDEA_MIN = 20;
export const IDEA_MAX = 1000;

export const IdeaDraftSchema = z.object({
  name: z.string().describe("Product name, 1 to 4 words. Use the name the founder gave; empty if none."),
  industry: z.enum(INDUSTRIES),
  audience: z.enum(ROLES).describe("Who the product is for."),
  headline: z.string().describe("One plain sentence for the card, no price, no numbers the founder did not write."),
  description: z.string().describe("1 to 2 plain sentences about what it does and for whom."),
  reward: z.string().describe("A launch reward only if the founder mentioned one, else empty."),
});

export interface IdeaDraft {
  name: string;
  industry: Industry;
  audience: Role;
  headline: string;
  description: string;
  reward: string;
}

export const IDEA_SYSTEM = [
  "You turn a founder's short overview of their product into a draft for a pitch card.",
  "Write in the founder's own plain words, simple English, no hype, no emojis.",
  "Never invent facts, prices or numbers. Use only digits that appear in the founder's text.",
  "Leave reward empty unless the founder described one. Pick industry and audience from the allowed values only.",
].join(" ");

/** Digits (any script) in a string, normalised to ASCII. */
const digitsIn = (s: string): string[] => asciiDigits(s).match(/\d/g) ?? [];

/** True when text holds a digit that the founder's own text does not have. */
export function hasInventedDigit(text: string, source: string): boolean {
  const allowed = new Set(digitsIn(source));
  return digitsIn(text).some((d) => !allowed.has(d));
}

const clip = (s: string, max: number) => {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max / 2))}…`.replace(/…$/, "");
};

/** Trim, fit to the deck limits, and drop any text field with a digit the founder did not write. Never throws. */
export function cleanDraft(raw: Partial<Record<keyof IdeaDraft, unknown>>, source: string): IdeaDraft {
  const text = (v: unknown, max: number) => {
    const s = typeof v === "string" ? clip(v, max) : "";
    return s && !hasInventedDigit(s, source) ? s : "";
  };
  return {
    name: text(raw.name, 60),
    industry: (INDUSTRIES as readonly string[]).includes(raw.industry as string) ? (raw.industry as Industry) : guessIndustry(source),
    audience: (ROLES as readonly string[]).includes(raw.audience as string) ? (raw.audience as Role) : guessAudience(source),
    headline: text(raw.headline, LIMITS.headline),
    description: text(raw.description, LIMITS.description),
    reward: text(raw.reward, LIMITS.reward),
  };
}

const INDUSTRY_WORDS: [Industry, RegExp][] = [
  ["Finance", /\b(payment|invoice|ledger|loan|bank|credit|upi|accounting|insurance|invest|money)/i],
  ["Healthcare", /\b(health|doctor|clinic|patient|medical|medicine|hospital|therapy)/i],
  ["Education", /\b(learn|student|school|tutor|course|exam|teach|education)/i],
  ["Food", /\b(food|restaurant|recipe|meal|kitchen|cafe|grocery|tiffin)/i],
  ["Logistics", /\b(delivery|logistics|shipping|truck|fleet|warehouse|courier)/i],
  ["Travel", /\b(travel|trip|hotel|tour|flight|booking)/i],
  ["Fashion", /\b(fashion|clothes|clothing|apparel|saree|wear)/i],
  ["Real estate", /\b(real estate|property|rent|tenant|landlord|home buying)/i],
  ["Agriculture", /\b(farm|crop|agri|harvest|seed|soil)/i],
  ["Gaming", /\b(game|gaming|esports|player)/i],
  ["Fitness", /\b(fitness|workout|gym|yoga|exercise)/i],
  ["Beauty", /\b(beauty|salon|skincare|makeup|cosmetic)/i],
  ["Pets", /\b(pet|dog|cat|vet)\b/i],
  ["Kids", /\b(kids|children|parent|toddler|baby)/i],
  ["Retail", /\b(shop|store|retail|inventory|customers|kirana|sell)/i],
];

export function guessIndustry(text: string): Industry {
  return INDUSTRY_WORDS.find(([, re]) => re.test(text))?.[0] ?? "SaaS";
}

const ROLE_WORDS: [Role, RegExp][] = [
  ["Shop owner", /\b(shop|store|kirana|retailer)/i],
  ["Wholesaler", /\bwholesal/i],
  ["Doctor", /\b(doctor|clinic|physician)/i],
  ["Farmer", /\bfarmer/i],
  ["Driver", /\bdriver/i],
  ["Homemaker", /\b(homemaker|housewife|home makers)/i],
  ["Student", /\bstudent/i],
  ["Freelancer", /\bfreelanc/i],
  ["Business owner", /\b(business owner|founder|small business|sme|msme)/i],
  ["Salaried", /\b(salaried|employee|office worker)/i],
];

export function guessAudience(text: string): Role {
  return ROLE_WORDS.find(([, re]) => re.test(text))?.[0] ?? "Other";
}

/** No LLM key: first sentence is the headline, the rest the description, reward left empty. */
export function templateDraft(source: string): IdeaDraft {
  const clean = source.replace(/\s+/g, " ").trim();
  const [first = "", ...rest] = clean.split(/(?<=[.!?])\s+/);
  const restText = rest.join(" ");
  return cleanDraft(
    {
      name: "",
      headline: first.replace(/[.!?]+$/, ""),
      description: restText || (first.length > LIMITS.headline ? first : ""),
      reward: "",
    },
    clean,
  );
}

/** Validates the request body text. */
export function checkIdeaText(value: unknown): { ok: true; text: string } | { ok: false; message: string } {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length < IDEA_MIN) return { ok: false, message: `Write a little more, at least ${IDEA_MIN} characters.` };
  if (text.length > IDEA_MAX) return { ok: false, message: `Keep it under ${IDEA_MAX} characters.` };
  return { ok: true, text };
}

export const IDEA_JSON_SYSTEM = `${IDEA_SYSTEM} Reply with ONE JSON object only, no prose, with exactly these keys: name, industry, audience, headline, description, reward. industry must be one of: ${INDUSTRIES.join(", ")}. audience must be one of: ${ROLES.join(", ")}.`;

/**
 * Lenient parse of a model reply: finds the JSON object (even inside prose or a code fence), then validates field by
 * field through cleanDraft, so one bad field (wrong enum, invented digit, missing key) never discards the rest.
 * Returns null only when no JSON object can be read at all.
 */
export function parseLenientDraft(reply: string, source: string): IdeaDraft | null {
  const start = reply.indexOf("{");
  const end = reply.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let obj: unknown;
  try {
    obj = JSON.parse(reply.slice(start, end + 1));
  } catch {
    return null;
  }
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) return null;
  const draft = cleanDraft(obj as Record<string, unknown>, source);
  const tmpl = templateDraft(source);
  return { ...draft, headline: draft.headline || tmpl.headline, description: draft.description || tmpl.description };
}

const words = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2));

/** Should a drafted idea default to a new product? True when its name and industry both clearly differ from the current product. */
export function looksLikeNewProduct(draft: Pick<IdeaDraft, "name" | "industry">, current: { name: string; industry: string }): boolean {
  const a = words(draft.name);
  const b = words(current.name);
  const sameName = draft.name.trim() !== "" && ([...a].some((w) => b.has(w)) || draft.name.trim().toLowerCase() === current.name.trim().toLowerCase());
  if (sameName) return false;
  return draft.industry !== current.industry || draft.name.trim() !== "";
}
