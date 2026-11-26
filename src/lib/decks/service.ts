/**
 * Deck and product use-cases (server only). Routes and server pages call this;
 * every rule (validation, locked fields, ownership) is enforced here, never in the UI.
 */
import { randomUUID } from "node:crypto";
import { DECK_PLANS } from "@/fixtures";
import { applyDraftPatch, canArchive, canDelete, checkDeckPatch, isContentEditable } from "./lock";
import { onDeckArchived, onDeckPublished } from "./integration";
import { accentFor, flagNameFor, makeDeckSlug, validateProduct } from "./product";
import { getStore, isPublishClaimed, type Store } from "./store";
import { deckStatusView } from "./status";
import { validateDeck } from "./validate";
import { deckLabel, type DeckAllowance, type DecksOverview, type DeckListItem, type ProductListItem, type ProductRecord } from "./views";
import type { ProductSnapshot } from "./fields";
import type { DeckInput, DeckRecord, FieldError } from "./types";

export type ServiceResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: 400 | 404 | 409 | 422; error: string; errors?: FieldError[] };

const fail = (status: 400 | 404 | 409 | 422, error: string, errors?: FieldError[]): ServiceResult<never> => ({
  ok: false,
  status,
  error,
  errors,
});
const ok = <T,>(value: T): ServiceResult<T> => ({ ok: true, value });

function snapshotOf(p: ProductRecord): ProductSnapshot {
  return {
    name: p.name,
    icon: p.icon,
    category: p.category,
    industry: p.industry,
    showOwnerName: p.showOwnerName,
    targetUsers: [...p.targetUsers],
    audience: { who: p.audience.who, states: [...p.audience.states], interests: [...p.audience.interests] },
  };
}

function asInput(deck: DeckRecord): DeckInput {
  return {
    productId: deck.productId,
    variable: deck.variable,
    priceMode: deck.priceMode,
    cards: deck.cards,
    shared: deck.shared,
    question: deck.question,
    positiveLabel: deck.positiveLabel,
    negativeLabel: deck.negativeLabel,
  };
}

export async function getOverview(ownerId: string, store?: Store): Promise<DecksOverview> {
  const s = store ?? (await getStore());
  const [products, decks] = await Promise.all([s.listProducts(ownerId), s.listDecks(ownerId)]);
  const stats = await s.deckStats(ownerId, decks.map((d) => d._id));

  const items: ProductListItem[] = products.map((p) => {
    const rows: DeckListItem[] = decks
      .filter((d) => d.productId === p.id)
      .map((d) => {
        const st = stats[d._id] ?? { swipers: 0, waitlist: 0 };
        const view = deckStatusView({ status: d.status, chance: st.chance, shippedAt: d.shippedAt });
        return {
          id: d._id,
          productId: d.productId,
          variable: d.variable,
          label: deckLabel(d.variable),
          versions: d.cards.length,
          status: d.status,
          statusLabel: view.label,
          tone: view.tone,
          chance: st.chance,
          swipers: st.swipers,
          waitlist: st.waitlist,
        };
      });
    return {
      id: p.id,
      name: p.name,
      icon: p.icon || p.name.slice(0, 1),
      category: p.category,
      accent: accentFor(p.name),
      deckCount: rows.length,
      waitlist: rows.reduce((n, r) => n + r.waitlist, 0),
      decks: rows,
    };
  });

  return {
    demo: s.demo,
    // Billing is Pitch only: the allowance is the designed demo figure, not enforced, and absent in real mode.
    allowance: allowanceFor(s.demo),
    products: items,
  };
}

/** The designed demo allowance (web 06: 7 of 10). Real mode: undefined, never a made-up quota. */
export function allowanceFor(demo: boolean): DeckAllowance | undefined {
  return demo ? { left: DECK_PLANS.decksLeft, total: DECK_PLANS.decksTotal } : undefined;
}

/* Products */

export async function listProducts(ownerId: string): Promise<ProductRecord[]> {
  return (await getStore()).listProducts(ownerId);
}

export async function getProduct(ownerId: string, id: string): Promise<ServiceResult<ProductRecord>> {
  const p = await (await getStore()).getProduct(ownerId, id);
  return p ? ok(p) : fail(404, "Product not found.");
}

export async function createProduct(ownerId: string, body: unknown): Promise<ServiceResult<ProductRecord>> {
  const v = validateProduct(body);
  if (!v.ok || !v.value) return fail(422, "Check the product details.", v.errors);
  return ok(await (await getStore()).createProduct(ownerId, v.value));
}

/** Changes apply to new decks only: running decks keep the snapshot taken at publish. */
export async function updateProduct(ownerId: string, id: string, body: unknown): Promise<ServiceResult<ProductRecord>> {
  const v = validateProduct(body);
  if (!v.ok || !v.value) return fail(422, "Check the product details.", v.errors);
  const p = await (await getStore()).updateProduct(ownerId, id, v.value);
  return p ? ok(p) : fail(404, "Product not found.");
}

/* Decks */

export async function listDecks(ownerId: string): Promise<DeckRecord[]> {
  return (await getStore()).listDecks(ownerId);
}

export async function getDeck(ownerId: string, id: string): Promise<ServiceResult<DeckRecord>> {
  const d = await (await getStore()).getDeck(ownerId, id);
  return d ? ok(d) : fail(404, "Deck not found.");
}

const BEING_PUBLISHED = "This deck is being published. Try again in a moment.";

/** JSON with object keys sorted and undefined dropped, so two reads of the same content compare equal. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
}

/**
 * Identity of everything publish validates (cards, question, labels, shared fields, variable, price mode, product).
 * Cards are order-independent: the Mongo store reads them back sorted by variant key.
 */
const contentKey = (deck: DeckRecord) => {
  const input = asInput(deck);
  return canonical({
    ...input,
    priceMode: input.variable === "price" ? input.priceMode : undefined,
    cards: input.cards
      .map((c) => ({ variantKey: c.variantKey, value: c.value }))
      .sort((a, b) => a.variantKey.localeCompare(b.variantKey)),
  });
};

/**
 * Claims the draft first (an atomic store update), so two publishes of the same deck (double click, retry after a
 * slow response, two tabs) cannot both create Flagsmith flags and experiments: the second one gets 409.
 */
async function publish(store: Store, ownerId: string, deck: DeckRecord, product: ProductRecord): Promise<ServiceResult<DeckRecord>> {
  if (!(await store.claimPublish(ownerId, deck._id, new Date()))) {
    const now = await store.getDeck(ownerId, deck._id);
    if (!now) return fail(404, "Deck not found.");
    if (now.status !== "draft") return fail(409, "This deck is already published.");
    // Draft but not claimable: another publish holds it, or (Mongo) another save is still writing its cards.
    return fail(409, isPublishClaimed(now) ? BEING_PUBLISHED : "Another save of this deck is in progress. Try again in a moment.");
  }
  try {
    // An edit may have landed between the caller's draft save and the claim: publish only what was validated
    // (every field, not just the cards), and build the flag and the saved deck from that fresh read.
    const fresh = await store.getDeck(ownerId, deck._id);
    if (!fresh) return fail(404, "Deck not found.");
    if (contentKey(fresh) !== contentKey(deck)) {
      await store.updateDeck(ownerId, deck._id, { publishingAt: null });
      return fail(409, "This deck changed while it was being published. Check it and publish again.");
    }
    // What goes live must itself pass publish validation (a save racing the caller's own may have been read back).
    const v = validateDeck(asInput(fresh), "publish");
    if (!v.ok) {
      await store.updateDeck(ownerId, deck._id, { publishingAt: null });
      return fail(422, "Check the highlighted fields.", v.errors);
    }
    const withSnapshot: DeckRecord = {
      ...fresh,
      status: "live",
      listedInFeed: true,
      publishingAt: null,
      shared: { ...fresh.shared, product: snapshotOf(product) },
    };
    // Creates and starts the Flagsmith flag + experiment (src/lib/decks/integration.ts). Never throws: a
    // Flagsmith failure comes back as `flagsmithError` and the deck still goes live on a local split.
    const hook = await onDeckPublished(withSnapshot);
    // featureId without experimentId = a half-made flag whose cleanup failed; onDeckArchived archives it.
    const featureId = hook.featureId ?? hook.orphanFeatureId;
    const saved = await store.updateDeck(ownerId, deck._id, {
      status: "live",
      listedInFeed: true,
      shared: withSnapshot.shared,
      publishingAt: null,
      ...(hook.experimentId ? { experimentId: hook.experimentId } : {}),
      ...(hook.flagName ? { flagName: hook.flagName } : {}),
      ...(featureId !== undefined ? { featureId } : {}),
      ...(hook.optionIds ? { optionIds: hook.optionIds } : {}),
      ...(hook.rewardMetricId ? { rewardMetricId: hook.rewardMetricId } : {}),
      ...(hook.flagsmithError ? { flagsmithError: hook.flagsmithError } : {}),
    });
    if (!saved) {
      // The deck is gone (deleted after a stale claim): never report a deck that does not exist as live, and archive
      // the flag just made for it. By feature id with no experiment id, so the cleanup does not depend on a GET.
      if (featureId !== undefined) await onDeckArchived({ ...withSnapshot, experimentId: undefined, featureId });
      return fail(404, "This deck was deleted while it was being published.");
    }
    return ok(saved);
  } catch (error) {
    // Release the claim so the founder can retry at once instead of waiting for it to go stale.
    await store.updateDeck(ownerId, deck._id, { publishingAt: null }).catch(() => null);
    throw error;
  }
}

/** Creates a draft, or publishes straight away when `body.publish` is true. */
export async function createDeck(ownerId: string, body: unknown): Promise<ServiceResult<DeckRecord>> {
  const wantsPublish = typeof body === "object" && body !== null && (body as { publish?: unknown }).publish === true;
  const { publish: _p, ...input } = (body ?? {}) as Record<string, unknown>;
  void _p;
  const v = validateDeck(input, wantsPublish ? "publish" : "draft");
  if (!v.ok) return fail(422, "Check the highlighted fields.", v.errors);

  const store = await getStore();
  const deckInput = input as unknown as DeckInput;
  const product = await store.getProduct(ownerId, deckInput.productId);
  if (!product) return fail(404, "Product not found.", [{ path: "productId", message: "Product not found." }]);

  const slug = makeDeckSlug(product.name, deckInput.variable, randomUUID().slice(0, 4));
  const created = await store.createDeck(ownerId, {
    ownerId,
    productId: deckInput.productId,
    slug,
    variable: deckInput.variable,
    priceMode: deckInput.variable === "price" ? deckInput.priceMode : undefined,
    shared: deckInput.shared ?? {},
    question: deckInput.question ?? "",
    positiveLabel: deckInput.positiveLabel ?? "",
    negativeLabel: deckInput.negativeLabel ?? "",
    flagName: flagNameFor(slug),
    status: "draft",
    listedInFeed: false,
    boost: { perSwipe: 0, budget: 0, spent: 0 },
    cards: deckInput.cards ?? [],
  });
  return wantsPublish ? publish(store, ownerId, created, product) : ok(created);
}

/**
 * A draft's slug and flag name are made at creation from the product and the variable ("voice-khata-headline-x7k2").
 * When a draft moves to another variable or product before it ever had a Flagsmith flag, both follow, so a price test
 * is not published as `deck_..._headline_...`. The random suffix is kept. Nothing outside the draft uses them yet:
 * personal links serve published decks only, and the flag is created at publish.
 */
async function renamedForDraft(
  store: Store,
  ownerId: string,
  existing: DeckRecord,
  next: DeckInput,
): Promise<{ slug: string; flagName: string } | Record<string, never>> {
  if (existing.status !== "draft" || existing.featureId != null || existing.experimentId) return {};
  if (next.variable === existing.variable && next.productId === existing.productId) return {};
  const product = await store.getProduct(ownerId, next.productId);
  if (!product) return {};
  const suffix = existing.slug.split("-").pop() || randomUUID().slice(0, 4);
  const slug = makeDeckSlug(product.name, next.variable, suffix);
  return { slug, flagName: flagNameFor(slug) };
}

/**
 * Edits a deck. Drafts may change anything (re-validated); a published deck
 * rejects every content change (locked fields, immutable cards) with 409, and
 * only allows moving to another product or archiving.
 */
export async function patchDeck(ownerId: string, id: string, body: unknown): Promise<ServiceResult<DeckRecord>> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return fail(400, "Send a JSON object.");
  const patch = body as Record<string, unknown>;
  const store = await getStore();
  const existing = await store.getDeck(ownerId, id);
  if (!existing) return fail(404, "Deck not found.");
  // A publish is building the Flagsmith flag from this draft right now: no edits, no second publish, no archive.
  if (isPublishClaimed(existing)) return fail(409, BEING_PUBLISHED);

  const check = checkDeckPatch({ ...asInput(existing), status: existing.status }, patch);
  if (!check.ok) return fail(409, check.violations[0].message, check.violations);

  let current = existing;

  if (patch.productId && patch.productId !== existing.productId) {
    const target = await store.getProduct(ownerId, String(patch.productId));
    if (!target) return fail(404, "Product not found.", [{ path: "productId", message: "Product not found." }]);
  }

  if (isContentEditable(existing.status)) {
    const next = applyDraftPatch(asInput(existing), patch as Partial<DeckInput>);
    const wantsPublish = patch.publish === true;
    const v = validateDeck(next, wantsPublish ? "publish" : "draft");
    if (!v.ok) return fail(422, "Check the highlighted fields.", v.errors);
    const saved = await store.updateDeck(ownerId, id, {
      ...(await renamedForDraft(store, ownerId, existing, next)),
      productId: next.productId,
      variable: next.variable,
      priceMode: next.variable === "price" ? next.priceMode : undefined,
      shared: next.shared ?? {},
      question: next.question ?? "",
      positiveLabel: next.positiveLabel ?? "",
      negativeLabel: next.negativeLabel ?? "",
      cards: next.cards ?? [],
    });
    if (!saved) {
      // Null with the deck still there: it left draft, a publish claimed it, or another save is replacing its cards.
      const now = await store.getDeck(ownerId, id);
      if (!now) return fail(404, "Deck not found.");
      if (now.status !== "draft") return fail(409, "This deck was published while you were editing it.");
      if (isPublishClaimed(now)) return fail(409, BEING_PUBLISHED);
      return fail(409, "Another save of this deck is in progress. Try again in a moment.");
    }
    current = saved;
    if (wantsPublish) {
      const product = await store.getProduct(ownerId, current.productId);
      if (!product) return fail(404, "Product not found.");
      const published = await publish(store, ownerId, current, product);
      if (!published.ok) return published;
      current = published.value;
    }
  } else if (patch.productId && patch.productId !== existing.productId) {
    current = (await store.updateDeck(ownerId, id, { productId: String(patch.productId) })) ?? current;
  }

  if (patch.archived === true) {
    if (!canArchive(current.status)) return fail(409, "This deck is already archived.");
    const before = current;
    current = (await store.updateDeck(ownerId, id, { status: "closed", listedInFeed: false })) ?? current;
    // Archives the Flagsmith flag (kept for a shipped deck, so the hook gets the status before archiving); logs, never throws.
    await onDeckArchived(before);
  }
  return ok(current);
}

export async function removeDeck(ownerId: string, id: string): Promise<ServiceResult<{ deleted: true }>> {
  const store = await getStore();
  const d = await store.getDeck(ownerId, id);
  if (!d) return fail(404, "Deck not found.");
  if (isPublishClaimed(d)) return fail(409, BEING_PUBLISHED);
  if (!canDelete(d.status)) return fail(409, "Only drafts can be deleted. Archive this deck instead.");
  // Conditional in the store (draft, unclaimed): a publish that claims after the checks above keeps its deck.
  if (!(await store.deleteDeck(ownerId, id))) {
    const now = await store.getDeck(ownerId, id);
    if (!now) return fail(404, "Deck not found.");
    if (isPublishClaimed(now)) return fail(409, BEING_PUBLISHED);
    if (now.status !== "draft") return fail(409, "Only drafts can be deleted. Archive this deck instead.");
    return fail(409, "Another save of this deck is in progress. Try again in a moment.");
  }
  return ok({ deleted: true });
}
