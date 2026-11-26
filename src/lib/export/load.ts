/**
 * Server-only loader for the export. Everything is scoped to the signed-in founder: decks come
 * through the owner-scoped store and the WP7 loader, so another founder's deck is "not found".
 *
 * Privacy: the swipe query never selects `ip`, `swiperId` is used only to look up interests and is
 * never copied into a row, and swiper emails are never read. Emails come only from `claims`.
 */
import { getStore } from "@/lib/decks/store";
import { demoDeckData } from "@/lib/results/demo";
import { loadResults } from "@/lib/results/load";

import { demoSwipes } from "./demo";
import type { ExportClaimant, ExportDeckData, ExportScope, ExportSwipe } from "./types";

type Row = Record<string, unknown>;
const str = (v: unknown): string => String(v);

async function loadMongoRows(deckId: string, labels: Record<string, string>): Promise<{ swipes: ExportSwipe[]; claimants: ExportClaimant[] }> {
  const [{ Types, isValidObjectId }, { connectDb }, { Card, Claim, Response, User }] = await Promise.all([
    import("mongoose"),
    import("@/lib/db"),
    import("@/models"),
  ]);
  await connectDb();
  const cardRows = (await Card.find({ deckId }).select("variantKey").lean()) as unknown as Row[];
  const labelById = new Map(cardRows.map((c) => [str(c._id), labels[str(c.variantKey)] ?? str(c.variantKey)]));

  const responses = (await Response.find({ deckId, counted: true, valid: true })
    .select("swiperId cardId source region answer comment commentVoice.english commentVoice.transcript createdAt")
    .lean()) as unknown as Row[];
  const swiperIds = [...new Set(responses.map((r) => str(r.swiperId)))].filter((id) => isValidObjectId(id));
  const users = swiperIds.length
    ? ((await User.find({ _id: { $in: swiperIds.map((i) => new Types.ObjectId(i)) } })
        .select("interests")
        .lean()) as unknown as Row[])
    : [];
  const interestsById = new Map(users.map((u) => [str(u._id), ((u.interests as string[]) ?? []).slice()]));

  const swipes: ExportSwipe[] = responses.map((r) => {
    const voice = (r.commentVoice as { english?: string; transcript?: string } | undefined) ?? {};
    return {
      at: new Date(r.createdAt as Date),
      cardLabel: labelById.get(str(r.cardId)) ?? "Unknown version",
      answer: r.answer === "positive" ? "yes" : "no",
      comment: str(r.comment || voice.english || voice.transcript || ""),
      region: typeof r.region === "string" ? r.region : null,
      source: r.source === "link" ? "link" : "feed",
      interests: interestsById.get(str(r.swiperId)) ?? [],
    };
  });

  const claims = (await Claim.find({ deckId }).select("cardId email createdAt").lean()) as unknown as Row[];
  const claimants: ExportClaimant[] = claims.map((c) => ({
    email: str(c.email),
    cardLabel: labelById.get(str(c.cardId)) ?? "Unknown version",
    claimedAt: new Date(c.createdAt as Date),
  }));
  return { swipes, claimants };
}

export async function loadExportDeck(ownerId: string, deckId: string, now: Date): Promise<ExportDeckData | null> {
  const payload = await loadResults(ownerId, deckId, now);
  if (!payload) return null;
  const store = await getStore();
  const labels = Object.fromEntries(payload.leaderboard.everyone.map((r) => [r.key, r.label]));

  if (store.demo) {
    const demo = demoDeckData(deckId, now);
    if (!demo) return { payload, swipes: [], claimants: [] };
    return {
      payload,
      swipes: demoSwipes(demo.cards, demo.aggregates, now),
      claimants: demo.claimants.map((c) => ({ email: c.email, cardLabel: labels[c.cardKey] ?? c.cardKey, claimedAt: c.createdAt })),
    };
  }
  return { payload, ...(await loadMongoRows(deckId, labels)) };
}

/** The deck, or every started deck of its product, for the founder. Null when the deck is not theirs. */
export async function loadExportDecks(ownerId: string, deckId: string, scope: ExportScope, now: Date): Promise<ExportDeckData[] | null> {
  const first = await loadExportDeck(ownerId, deckId, now);
  if (!first) return null;
  if (scope === "deck") return [first];
  const store = await getStore();
  const siblings = (await store.listDecks(ownerId)).filter(
    (d) => d.productId === first.payload.deck.productId && d._id !== deckId && d.status !== "draft",
  );
  const rest = await Promise.all(siblings.map((d) => loadExportDeck(ownerId, d._id, now)));
  return [first, ...rest.filter((d): d is ExportDeckData => d !== null)];
}

/** For the sheet: how many decks the "Whole product" choice covers, and how many waitlist emails the deck has. */
export async function exportOptions(ownerId: string, deckId: string): Promise<{ deckLabel: string; productDecks: number; waitlistCount: number; demo: boolean } | null> {
  const store = await getStore();
  const deck = await store.getDeck(ownerId, deckId);
  if (!deck) return null;
  const payload = await loadResults(ownerId, deckId);
  if (!payload) return null;
  const decks = (await store.listDecks(ownerId)).filter((d) => d.productId === deck.productId && d.status !== "draft");
  return {
    deckLabel: payload.deck.label,
    productDecks: Math.max(1, decks.length),
    waitlistCount: payload.waitlist.count,
    demo: store.demo,
  };
}
