/**
 * ACTION tools (server only). Every one needs the user's approval in the chat before it runs (registry.ts sets
 * needsApproval and a preview card). Each action:
 *  - takes ids only as tokens the model typed, and re-resolves them through the signed-in user's own overview/services
 *    (owner or active co-founder; the services still enforce owner-only rules such as the team),
 *  - is rate-limited per user,
 *  - returns a link to the page it affected.
 * Shipping a winner is NOT an action: the AI never decides or ships.
 */
import { z } from "zod";

import { INDUSTRIES, ROLES, STATES } from "@/shared/lib/lists";
import { rateLimit } from "@/shared/lib/ratelimit";
import { createDeck, createProduct, getOverview, getProduct, patchDeck, updateProduct, type ServiceResult } from "@/features/decks/server/service";
import { listMembers, inviteMember, removeMember } from "@/features/decks/server/members";
import { checkIdeaText, hasInventedDigit, templateDraft } from "@/features/decks/idea";
import { productHref, testHref } from "../app-map";
import { findProduct, findTest, type Actor } from "./account";

export interface Preview {
  title: string;
  /** The exact target and values, as the user will see them on the card. */
  lines: { label: string; value: string }[];
  warning?: string;
  confirmLabel: string;
}
export interface Done {
  title: string;
  text: string;
  href: string;
  linkLabel: string;
}
export interface ActionDef {
  name: string;
  description: string;
  input: z.ZodObject;
  preview(args: Record<string, unknown>, actor: Actor): Promise<Preview>;
  run(args: Record<string, unknown>, actor: Actor): Promise<Done>;
}

const ACTION_LIMIT = { limit: 20, windowMs: 60_000 };

function must<T>(r: ServiceResult<T>): T {
  if (r.ok) return r.value;
  const detail = r.errors?.slice(0, 3).map((e) => e.message).join(" ");
  throw new Error(`${r.error}${detail ? ` ${detail}` : ""}`);
}

const list = (v: unknown): string => (Array.isArray(v) && v.length ? v.join(", ") : "none");
const productFields = {
  category: z.string().max(60).optional().describe("One short line, for example 'Mess meal planner'"),
  who: z.enum(["everyone", "targetOnly"]).optional().describe("Who sees its tests"),
  states: z.array(z.enum(STATES)).optional(),
  interests: z.array(z.enum(INDUSTRIES)).optional(),
  targetUsers: z.array(z.enum(ROLES)).optional().describe("Roles shown as 'Made for'"),
  showOwnerName: z.boolean().optional().describe("Show the founder's name on cards"),
};

const TEXT_VARIABLES = ["headline", "description", "reward", "price"] as const;

function limited(actor: Actor): void {
  const r = rateLimit(`chat:action:${actor.ownerId}`, ACTION_LIMIT);
  if (!r.ok) throw new Error(`Too many changes in a short time. Try again in ${r.retryAfterSeconds} seconds.`);
}

const productBody = (a: Record<string, unknown>, base?: Awaited<ReturnType<typeof getProduct>> extends infer R ? (R extends { ok: true; value: infer V } ? V : never) : never) => ({
  name: a.name ?? base?.name,
  icon: base?.icon,
  category: a.category ?? base?.category ?? "",
  industry: a.industry ?? base?.industry,
  showOwnerName: a.showOwnerName ?? base?.showOwnerName ?? false,
  targetUsers: a.targetUsers ?? base?.targetUsers ?? [],
  audience: { who: a.who ?? base?.audience.who ?? "everyone", states: a.states ?? base?.audience.states ?? [], interests: a.interests ?? base?.audience.interests ?? [] },
});

export const ACTIONS: ActionDef[] = [
  {
    name: "create_product",
    description: "Create a product (name, industry, optional category, audience, who it is for).",
    input: z.object({ name: z.string().min(1).max(60), industry: z.enum(INDUSTRIES), ...productFields }),
    async preview(a) {
      return {
        title: "Create a product",
        lines: [
          { label: "Name", value: String(a.name) },
          { label: "Industry", value: String(a.industry) },
          { label: "Category", value: String(a.category ?? "none") },
          { label: "Shown to", value: a.who === "targetOnly" ? `Target users only (${list(a.targetUsers)})` : "Everyone" },
        ],
        confirmLabel: "Create product",
      };
    },
    async run(a, actor) {
      limited(actor);
      const p = must(await createProduct(actor.ownerId, productBody(a)));
      return { title: "Product created", text: `${p.name} is ready. Add its first test next.`, href: productHref(p.id), linkLabel: "Open product" };
    },
  },
  {
    name: "update_product",
    description: "Change a product's name, category, industry, audience, founder display or target users. Only the fields you pass change; tests already live keep their snapshot.",
    input: z.object({ product: z.string().describe("Product id or name"), name: z.string().min(1).max(60).optional(), industry: z.enum(INDUSTRIES).optional(), ...productFields }),
    async preview(a, actor) {
      const p = findProduct(await getOverview(actor.ownerId), a.product);
      const changes = Object.entries(a).filter(([k, v]) => k !== "product" && v !== undefined).map(([k, v]) => ({ label: k, value: Array.isArray(v) ? list(v) : String(v) }));
      if (!changes.length) throw new Error("Nothing to change. Ask the user what to change.");
      return { title: `Update ${p.name}`, lines: [{ label: "Product", value: p.name }, ...changes], warning: "Applies to new tests only. Live tests keep their snapshot.", confirmLabel: "Update product" };
    },
    async run(a, actor) {
      limited(actor);
      const p = findProduct(await getOverview(actor.ownerId), a.product);
      const current = must(await getProduct(actor.ownerId, p.id));
      const saved = must(await updateProduct(actor.ownerId, p.id, productBody(a, current)));
      return { title: "Product updated", text: `${saved.name} was updated.`, href: productHref(saved.id), linkLabel: "Open product" };
    },
  },
  {
    name: "create_test_draft",
    description:
      "Create a DRAFT test (never published): a product, one variable (headline, description, reward or price), and 2 or 3 versions in the user's words. Or pass `idea` (the user's own overview text, 20+ characters) to draft from an idea.",
    input: z.object({
      product: z.string().describe("Product id or name"),
      variable: z.enum(TEXT_VARIABLES),
      versions: z.array(z.string().min(1).max(200)).min(2).max(3).optional(),
      idea: z.string().max(1000).optional(),
    }),
    async preview(a, actor) {
      const p = findProduct(await getOverview(actor.ownerId), a.product);
      const body = draftBody(a, actor, p.id);
      return {
        title: `Draft a ${String(a.variable)} test`,
        lines: [
          { label: "Product", value: p.name },
          { label: "Testing", value: String(a.variable) },
          ...body.cards.map((c) => ({ label: `Version ${c.variantKey}`, value: String(c.value) })),
        ],
        warning: "Saved as a draft. Nothing goes live until you publish it.",
        confirmLabel: "Save draft",
      };
    },
    async run(a, actor) {
      limited(actor);
      const p = findProduct(await getOverview(actor.ownerId), a.product);
      const deck = must(await createDeck(actor.ownerId, draftBody(a, actor, p.id)));
      return { title: "Draft saved", text: `A ${deck.variable} draft for ${p.name} is saved. Finish it and publish when ready.`, href: `/decks/new?draft=${encodeURIComponent(deck._id)}`, linkLabel: "Open draft" };
    },
  },
  {
    name: "publish_test",
    description: "Publish a DRAFT test so it goes live. Versions cannot be edited afterwards.",
    input: z.object({ test: z.string().describe("Test id, or product plus variable"), product: z.string().optional() }),
    async preview(a, actor) {
      const { test, product } = findTest(await getOverview(actor.ownerId), a.test, a.product);
      if (test.status !== "draft") throw new Error(`${product.name} ${test.label} is ${test.statusLabel}, not a draft. Only drafts can be published.`);
      return {
        title: "Publish this test",
        lines: [{ label: "Product", value: product.name }, { label: "Testing", value: test.label }, { label: "Versions", value: String(test.versions) }],
        warning: "It goes live and swipers start seeing it. Versions are locked once it is live.",
        confirmLabel: "Publish test",
      };
    },
    async run(a, actor) {
      limited(actor);
      const { test, product } = findTest(await getOverview(actor.ownerId), a.test, a.product);
      if (test.status !== "draft") throw new Error("Only drafts can be published.");
      const deck = must(await patchDeck(actor.ownerId, test.id, { publish: true }));
      return { title: "Test published", text: `${product.name} ${test.label} is ${deck.status}.`, href: testHref(deck._id), linkLabel: "Open results" };
    },
  },
  {
    name: "archive_test",
    description: "Archive a test (it stops running; results and waitlist are kept). There is no tool to unarchive.",
    input: z.object({ test: z.string().describe("Test id, or product plus variable"), product: z.string().optional() }),
    async preview(a, actor) {
      const { test, product } = findTest(await getOverview(actor.ownerId), a.test, a.product);
      if (test.status === "closed") throw new Error("That test is already archived.");
      return {
        title: "Archive this test",
        lines: [{ label: "Product", value: product.name }, { label: "Testing", value: test.label }, { label: "Now", value: test.statusLabel }],
        warning: "It stops running. Results and the waitlist are kept.",
        confirmLabel: "Archive test",
      };
    },
    async run(a, actor) {
      limited(actor);
      const { test, product } = findTest(await getOverview(actor.ownerId), a.test, a.product);
      must(await patchDeck(actor.ownerId, test.id, { archived: true }));
      return { title: "Test archived", text: `${product.name} ${test.label} is archived.`, href: testHref(test.id), linkLabel: "Open test" };
    },
  },
  {
    name: "invite_cofounder",
    description: "Invite a co-founder to a product by email (product owner only). They can see its tests and results.",
    input: z.object({ product: z.string().describe("Product id or name"), email: z.string().email().max(200) }),
    async preview(a, actor) {
      const p = findProduct(await getOverview(actor.ownerId), a.product);
      if (p.role === "cofounder") throw new Error("Only the owner of a product can invite co-founders.");
      return { title: "Invite a co-founder", lines: [{ label: "Product", value: p.name }, { label: "Email", value: String(a.email) }], warning: "They get an invite link that works once and expires in 14 days.", confirmLabel: "Send invite" };
    },
    async run(a, actor) {
      limited(actor);
      const p = findProduct(await getOverview(actor.ownerId), a.product);
      const { mailerFromEnv } = await import("@/features/export/server/mailer");
      const r = must(await inviteMember(actor.ownerId, p.id, { email: a.email }, { baseUrl: actor.baseUrl, mailer: mailerFromEnv() }));
      return { title: "Invite created", text: r.emailed ? `An invite email went to ${String(a.email)}.` : `No email could be sent. Copy the invite link from the team page for ${String(a.email)}.`, href: productHref(p.id), linkLabel: "Open team" };
    },
  },
  {
    name: "remove_cofounder",
    description: "Remove a co-founder (or cancel a pending invite) from a product by their email (owner only).",
    input: z.object({ product: z.string().describe("Product id or name"), email: z.string().email().max(200) }),
    async preview(a, actor) {
      const p = findProduct(await getOverview(actor.ownerId), a.product);
      const m = await memberByEmail(actor, p.id, a.email);
      return { title: "Remove a co-founder", lines: [{ label: "Product", value: p.name }, { label: "Email", value: m.email }, { label: "Status", value: m.status }], warning: "They lose access to this product's tests and results.", confirmLabel: "Remove" };
    },
    async run(a, actor) {
      limited(actor);
      const p = findProduct(await getOverview(actor.ownerId), a.product);
      const m = await memberByEmail(actor, p.id, a.email);
      must(await removeMember(actor.ownerId, p.id, m.id));
      return { title: "Co-founder removed", text: `${m.email} no longer has access to ${p.name}.`, href: productHref(p.id), linkLabel: "Open team" };
    },
  },
  {
    name: "set_website",
    description: "Set or change a product's website address.",
    input: z.object({ product: z.string().describe("Product id or name"), domain: z.string().min(3).max(300).describe("For example voice-khata.vercel.app") }),
    async preview(a, actor) {
      const p = findProduct(await getOverview(actor.ownerId), a.product);
      const { normalizeDomain } = await import("@/features/sites/domain");
      const domain = normalizeDomain(a.domain);
      if (!domain) throw new Error("That is not a valid website address.");
      return { title: "Set the website", lines: [{ label: "Product", value: p.name }, { label: "Website", value: domain }], warning: "A changed address starts clean: nothing seen yet.", confirmLabel: "Save website" };
    },
    async run(a, actor) {
      limited(actor);
      const p = findProduct(await getOverview(actor.ownerId), a.product);
      const [{ connectSite }, { siteDeps }] = await Promise.all([import("@/features/sites/server/service"), import("@/features/sites/server/server")]);
      const r = await connectSite(await siteDeps(), { ownerId: actor.ownerId, productId: p.id, domain: a.domain });
      if (!r.ok) throw new Error(r.error);
      return { title: "Website saved", text: `${p.name} now points at ${r.value.domain}.`, href: `/products/${encodeURIComponent(p.id)}/site`, linkLabel: "Open website" };
    },
  },
  {
    name: "remove_website",
    description: "Disconnect a product's website. Tests, flags and ship history stay.",
    input: z.object({ product: z.string().describe("Product id or name") }),
    async preview(a, actor) {
      const p = findProduct(await getOverview(actor.ownerId), a.product);
      return { title: "Remove the website", lines: [{ label: "Product", value: p.name }], warning: "Tests, flags and ship history stay.", confirmLabel: "Remove website" };
    },
    async run(a, actor) {
      limited(actor);
      const p = findProduct(await getOverview(actor.ownerId), a.product);
      const [{ removeSite }, { siteDeps }] = await Promise.all([import("@/features/sites/server/service"), import("@/features/sites/server/server")]);
      const r = await removeSite(await siteDeps(), { ownerId: actor.ownerId, productId: p.id });
      if (!r.ok) throw new Error(r.error);
      return { title: "Website removed", text: r.value.removed ? `${p.name} has no website now.` : `${p.name} had no website connected.`, href: `/products/${encodeURIComponent(p.id)}/site`, linkLabel: "Open website" };
    },
  },
];

async function memberByEmail(actor: Actor, productId: string, email: unknown) {
  const r = must(await listMembers(actor.ownerId, productId));
  if (r.role !== "owner") throw new Error("Only the owner can manage the team.");
  const want = String(email).trim().toLowerCase();
  const m = r.members.find((x) => x.email.toLowerCase() === want && x.role === "cofounder");
  if (!m) throw new Error(`${want} is not on this product's team.`);
  return m;
}

/** The draft body. Digits in drafted copy must come from the user's own message (AI never invents numbers). */
function draftBody(a: Record<string, unknown>, actor: Actor, productId: string) {
  const variable = String(a.variable) as (typeof TEXT_VARIABLES)[number];
  const idea = typeof a.idea === "string" ? a.idea.trim() : "";
  let values: string[] = [];
  let shared: Record<string, string> = {};
  if (idea) {
    const checked = checkIdeaText(idea);
    if (!checked.ok) throw new Error(checked.message);
    const d = templateDraft(checked.text);
    values = [d[variable as "headline" | "description" | "reward"] ?? ""].filter(Boolean);
    shared = Object.fromEntries((["description", "reward"] as const).filter((k) => k !== variable && d[k]).map((k) => [k, d[k]]));
  } else {
    values = (Array.isArray(a.versions) ? a.versions : []).map((v) => String(v).trim()).filter(Boolean);
    if (values.length < 2) throw new Error("A test needs 2 or 3 versions. Ask the user for them.");
  }
  if (!values.length) throw new Error("Nothing to draft. Ask the user for versions or an idea.");
  for (const v of values) {
    if (hasInventedDigit(v, actor.userText)) throw new Error("A version has a number the user did not write. Use only their words.");
  }
  return {
    productId,
    variable,
    question: "",
    positiveLabel: "",
    negativeLabel: "",
    shared,
    cards: values.map((value, i) => ({ variantKey: "ABC"[i], value })),
  };
}

export const ACTION_BY_NAME: Record<string, ActionDef> = Object.fromEntries(ACTIONS.map((x) => [x.name, x]));
