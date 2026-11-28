/**
 * The chat's tool registry (server only), by kind:
 *  - READ: run at once, return data + a card + facts for the number guard (results tools and the account tools).
 *  - ACTION: every one has `needsApproval: true`. The stream stops at an approval request carrying a preview built by code
 *    from the user's own data; the tool runs only after the user approves in the chat, and re-checks access in the services.
 *  - CLIENT: no `execute`. The browser runs them (open a page, start a download, switch theme).
 * Shipping a winner is not here: the AI never decides or ships.
 */
import { randomBytes } from "node:crypto";
import { tool, type SingleToolApprovalFunction, type ToolSet } from "ai";
import { z } from "zod";

import type { ToolOutput, ToolStep, SourceFact } from "@/shared/lib/ai";
import { PALETTE_PRESETS } from "@/shared/lib/feel/palettes";
import { validateAppPath, TEST_TABS } from "../app-map";
import { COMPUTE_OPS } from "../compute";
import { buildComponents } from "../compose";
import { SEGMENT_BY_NAMES, COMPONENT_NAMES, type AskToolCtx, type ComponentSpec, type RenderedComponent } from "../types";
import { ASK_TOOLS } from "./tools";
import { ACTIONS, ACTION_BY_NAME, type Done } from "./actions";
import * as acct from "./account";
import { getHistoryTool, getWalletTool } from "./swiper";
import type { AccountAskCtx } from "./account-ctx";
import type { Actor } from "./account";

/* Per-request state --------------------------------------------------------------- */

export interface ChatRun {
  ctx: AskToolCtx & Partial<Pick<AccountAskCtx, "ensure">>;
  /** The signed-in user and page. Null only in unit tests of the results tools. */
  actor: Actor | null;
  steps: ToolStep[];
  /** Facts that insight cards added (needed to check the written text). */
  extraFacts: SourceFact[];
  counts: Map<string, number>;
}

export const newRun = (ctx: ChatRun["ctx"], actor: Actor | null = null): ChatRun => ({ ctx, actor, steps: [], extraFacts: [], counts: new Map() });

/* Names -------------------------------------------------------------------------------- */

export const ACCOUNT_READ_TOOLS = ["list_products", "list_tests", "get_plan_usage", "get_wallet", "get_history", "get_current_page", "get_current_time", "get_profile", "list_pages", "compute"] as const;
export const RESULTS_READ_TOOLS = ASK_TOOLS.map((t) => t.name);
export const READ_TOOL_NAMES: readonly string[] = [...RESULTS_READ_TOOLS, ...ACCOUNT_READ_TOOLS];
export const ACTION_TOOL_NAMES: readonly string[] = ACTIONS.map((a) => a.name);
export const CLIENT_TOOL_NAMES = ["open_page", "open_download", "set_theme"] as const;

/** Signs approval requests so a client cannot forge an approval for a call the server never asked about. */
const APPROVAL_SECRET = process.env.CHAT_APPROVAL_SECRET || process.env.SWIPE_SIGNING_SECRET || randomBytes(32).toString("hex");
export const approvalSecret = (): string => APPROVAL_SECRET;

/* Schemas ------------------------------------------------------------------------------- */

const deck = z.string().optional().describe("Test id, or product name plus variable such as 'Mess Menu headline'. Defaults to the test the user is looking at.");

const INPUT_SCHEMAS: Record<string, z.ZodObject> = {
  get_results: z.object({ deck }),
  get_segments: z.object({ deck, by: z.enum(SEGMENT_BY_NAMES).describe("What to split by") }),
  get_experiment: z.object({ deck }),
  get_price_curve: z.object({ deck }),
  get_comments: z.object({
    deck,
    card: z.string().optional().describe('Card key such as "C"'),
    language: z.string().optional().describe('Spoken language such as "Hindi"'),
  }),
  draft_deck: z.object({
    variable: z.enum(["headline", "description", "reward", "price", "language"]),
    versions: z.array(z.string()).optional().describe("2 to 4 short versions in words, no digits"),
    audience: z.array(z.string()).optional(),
    state: z.string().optional(),
    lock_from_deck: z.string().optional(),
  }),
};

const count = z.number().int().min(0).max(1_000_000_000);
const rateSide = z.object({ label: z.string().max(30).optional(), count, total: count });

const ACCOUNT_SCHEMAS = {
  list_products: z.object({}),
  list_tests: z.object({ product: z.string().optional().describe("Product id or name"), status: z.enum(["draft", "live", "decided", "shipped", "closed"]).optional() }),
  get_plan_usage: z.object({}),
  get_wallet: z.object({}),
  get_history: z.object({}),
  get_current_page: z.object({}),
  get_current_time: z.object({ test: z.string().optional().describe("Test id or name: also returns days since it was created"), product: z.string().optional() }),
  get_profile: z.object({}),
  list_pages: z.object({}),
  compute: z.object({
    op: z.enum(COMPUTE_OPS),
    values: z.array(z.number()).max(50).optional().describe("difference/ratio/percent_change/percent_of take 2 (first, second); sum/average take any"),
    a: rateSide.optional().describe("compare_rates: first version, count of successes out of total"),
    b: rateSide.optional(),
    from: z.string().optional().describe("days_between: YYYY-MM-DD"),
    to: z.string().optional(),
  }),
};

const ACCOUNT_DESC: Record<(typeof ACCOUNT_READ_TOOLS)[number], string> = {
  list_products: "The user's products with tests, live tests, swipes and waitlist per product, plus totals.",
  list_tests: "The user's tests across products: variable, status, swipes, waitlist, link. Filter by product or status.",
  get_plan_usage: "Plan name, tests used and tests left.",
  get_wallet: "The user's swiper earnings: balance, this week, today. Payouts are coming soon.",
  get_history: "The user's recent swiper answers and earnings.",
  get_current_page: "The page the user is on, with the product and test in view (checked against their access).",
  get_current_time: "Server time and the user's local date and time. With `test`: days since that test was created.",
  get_profile: "Who the user is: name, founder or swiper, plan, tests left, theme in use.",
  list_pages: "Every page and tab of the app with its path, for open_page and for 'where is X?'.",
  compute: "Safe maths. Returns results as facts you cite with placeholders. Use it for any difference, ratio, percent or comparison; never compute yourself.",
};

const ACCOUNT_RUN = {
  list_products: acct.listProductsTool,
  list_tests: acct.listTestsTool,
  get_plan_usage: acct.getPlanUsageTool,
  get_wallet: getWalletTool,
  get_history: getHistoryTool,
  get_current_page: acct.getCurrentPageTool,
  get_current_time: acct.getCurrentTimeTool,
  get_profile: acct.getProfileTool,
  list_pages: acct.listPagesTool,
  compute: acct.computeTool,
} as const;

type AccountRunner = (args: Record<string, unknown>, actor: Actor, ref: string) => Promise<ToolOutput & { card?: RenderedComponent }>;

const showSchema = z.object({
  components: z
    .array(
      z.object({
        component: z.enum(COMPONENT_NAMES),
        source: z.string().optional().describe('Tool call id from a data tool result, e.g. "get_segments#1"'),
        highlight: z.string().optional().describe("Row label or card key to emphasise"),
        pick: z.array(z.string()).optional().describe("commentQuotes: comment ids"),
        text: z.string().optional().describe("insightCard: wording with {fact.key} placeholders, never digits"),
      }),
    )
    .max(6),
});

/* Running a step ------------------------------------------------------------------------- */

async function step(run: ChatRun, name: string, args: Record<string, unknown>, fn: (ref: string) => Promise<ToolOutput & { card?: RenderedComponent }>) {
  const n = (run.counts.get(name) ?? 0) + 1;
  run.counts.set(name, n);
  const id = `${name}#${n}`;
  const ref = `${name}${n}`;
  try {
    const out = await fn(ref);
    run.steps.push({ id, ref, tool: name, args, ok: true, summary: out.summary, call: out.call, result: out.result, facts: out.facts });
    return { id, summary: out.summary, call: out.call, result: out.result, card: out.card, facts: Object.fromEntries(out.facts.map((f) => [f.key, f.display])) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "The tool failed.";
    run.steps.push({ id, ref, tool: name, args, ok: false, summary: "", call: name, result: { error: message }, facts: [] });
    return { id, error: message };
  }
}

const needActor = (run: ChatRun): Actor => {
  if (!run.actor) throw new Error("Not signed in.");
  return run.actor;
};

/* Tools --------------------------------------------------------------------------------------- */

export function buildChatTools(run: ChatRun): ToolSet {
  const tools: ToolSet = {};

  for (const def of ASK_TOOLS) {
    tools[def.name] = tool({
      description: `${def.description} Args: ${def.args}`,
      inputSchema: INPUT_SCHEMAS[def.name] ?? z.object({}),
      execute: (input) =>
        step(run, def.name, input as Record<string, unknown>, async (ref) => {
          const args = { ...(input as Record<string, unknown>) };
          // Account scope: load the named test (any the user can open) before the tool looks it up.
          if (run.ctx.ensure) {
            const loaded = await run.ctx.ensure(args.deck);
            if (loaded) args.deck = loaded;
            if (!Object.keys(run.ctx.decks).length) throw new Error("The user has no tests yet. Offer to create a product or a draft test.");
          }
          return def.run(args, run.ctx as AskToolCtx, ref);
        }),
    });
  }

  for (const name of ACCOUNT_READ_TOOLS) {
    tools[name] = tool({
      description: ACCOUNT_DESC[name],
      inputSchema: ACCOUNT_SCHEMAS[name] as z.ZodObject,
      execute: (input: unknown) => step(run, name, input as Record<string, unknown>, (ref) => (ACCOUNT_RUN[name] as AccountRunner)(input as Record<string, unknown>, needActor(run), ref)),
    });
  }

  tools.show = tool({
    description:
      "Draw results components in the chat from tool results you already have. Code builds every number. Call it once after the results tools, then write 1 to 2 sentences. Account tools (lists, plan, wallet) draw their own cards: do not call show for them.",
    inputSchema: showSchema,
    async execute(input: z.infer<typeof showSchema>): Promise<{ components: RenderedComponent[]; notes: string[] }> {
      const built = buildComponents(run.steps, input.components as ComponentSpec[]);
      run.extraFacts.push(...built.extraFacts);
      return { components: built.components, notes: built.notes };
    },
  });

  // Actions: approval first (needsApproval), then the service call. The result is the only proof the model may cite.
  for (const def of ACTIONS) {
    tools[def.name] = tool({
      description: `${def.description} The user must approve it in the chat first; do not say it is done until the tool result says so.`,
      inputSchema: def.input,
      needsApproval: true,
      async execute(input): Promise<{ ok: true; done: Done } | { ok: false; error: string }> {
        try {
          return { ok: true, done: await def.run(input as Record<string, unknown>, needActor(run)) };
        } catch (error) {
          return { ok: false, error: error instanceof Error ? error.message : "That did not work." };
        }
      },
    });
  }

  // Client tools: no execute. The browser runs them and sends the output back.
  tools.open_page = tool({
    description: "Open an app page for the user (internal path from list_pages or a link a tool gave you). Open a test's Review and ship screen only when get_experiment says decided.",
    inputSchema: z.object({ path: z.string().refine((p) => validateAppPath(p).ok, "Use an app path from list_pages.") }),
  });
  tools.open_download = tool({
    description: "Start a results download in the browser. tab: results (report + summary), audience (every swipe), waitlist (emails). scope: this test or all tests of its product.",
    inputSchema: z.object({ test: z.string().min(1).max(64).describe("Test id"), scope: z.enum(["deck", "product"]).default("deck"), tab: z.enum(TEST_TABS.filter((t) => t.id !== "share").map((t) => t.id) as ["results", "audience", "waitlist"]) }),
  });
  tools.set_theme = tool({
    description: "Switch the app's color theme and/or light or dark mode in this browser.",
    inputSchema: z.object({ preset: z.enum(PALETTE_PRESETS.map((p) => p.id) as [string, ...string[]]).optional(), mode: z.enum(["light", "dark"]).optional() }).refine((v) => v.preset || v.mode, "Give a preset or a mode."),
  });
  return tools;
}

/* Approval previews ------------------------------------------------------------------------------ */

/** For each action: the preview the user sees, built by code from their own data. A failed preview denies the call (the model is told why). */
export function buildToolApproval(actor: Actor): Record<string, SingleToolApprovalFunction<never, never, never>> {
  const out: Record<string, SingleToolApprovalFunction<never, never, never>> = {};
  for (const def of ACTIONS) {
    out[def.name] = (async (input: unknown) => {
      try {
        const preview = await ACTION_BY_NAME[def.name].preview(input as Record<string, unknown>, actor);
        return { type: "user-approval" as const, reason: JSON.stringify(preview) };
      } catch (error) {
        return { type: "denied" as const, reason: error instanceof Error ? error.message : "That cannot be done." };
      }
    }) as unknown as SingleToolApprovalFunction<never, never, never>;
  }
  return out;
}
