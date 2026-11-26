/** Every sentence the assistant shows. Code fills every number from Flagsmith's own results. */
import { percent } from "./decided";
import type {
  AlertRecord,
  AlertView,
  CardChance,
  ReviewCard,
  ReviewView,
  ShipRecord,
  ShippedView,
  WatchedDeck,
} from "./types";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type DeckNames = Pick<WatchedDeck, "productName" | "title" | "noun">;

/** "Headline B" (the card's name in the designs). */
export function cardName(deck: Pick<WatchedDeck, "noun">, key: string): string {
  return `${cap(deck.noun)} ${key}`;
}

export function alertTexts(deck: DeckNames, winnerKey: string, chance: number, swipers: number | null) {
  const headline = `${deck.productName} ${deck.noun} test: ${winnerKey} has a ${percent(chance)}% chance of being best.`;
  const counted = swipers === null ? "All checks passed." : `${swipers} swipers, all checks passed.`;
  return { headline, body: `${counted} Nothing changes until you approve.` };
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function emailTexts(deck: DeckNames, winnerKey: string, chance: number, swipers: number | null, link: string) {
  const { headline, body } = alertTexts(deck, winnerKey, chance, swipers);
  return {
    subject: headline,
    text: `${headline}\n${body}\n\nReview and ship, or keep testing: ${link}\n`,
    html: `<p><strong>${esc(headline)}</strong></p><p>${esc(body)}</p><p><a href="${esc(link)}">Review and ship</a></p>`,
  };
}

export function chanceOf(chances: CardChance[], key: string): number {
  return chances.find((c) => c.key === key)?.chance ?? 0;
}

/** Winner first, then the others by chance. */
export function orderedCards(deck: WatchedDeck, chances: CardChance[], winnerKey: string | null): ReviewCard[] {
  return deck.cards
    .map((c) => ({
      key: c.key,
      text: c.text,
      chancePercent: percent(chanceOf(chances, c.key)),
      isWinner: c.key === winnerKey,
    }))
    .sort((a, b) => Number(b.isWinner) - Number(a.isWinner) || b.chancePercent - a.chancePercent);
}

/** Undo restores the control card for everyone; a completed Flagsmith experiment cannot restart. */
export function switchBack(deck: Pick<WatchedDeck, "noun" | "controlKey">): string {
  return `You can switch back to ${cardName(deck, deck.controlKey)} at any time, but the test itself will not restart.`;
}

export function reviewView(input: {
  deck: WatchedDeck;
  chances: CardChance[];
  winnerKey: string | null;
  swipers: number | null;
  insight: string | null;
  alreadyShipped: boolean;
  notDecidedText?: string;
  /** Connected website of the product, when there is one. */
  siteDomain?: string | null;
  /** Demo mode only: supplied by the demo deps (see sources.ts demoReviewNote). */
  demoNote?: string;
}): ReviewView {
  const { deck, winnerKey } = input;
  const winner = deck.cards.find((c) => c.key === winnerKey);
  const name = winnerKey ? cardName(deck, winnerKey) : "";
  const losers = deck.cards.filter((c) => c.key !== winnerKey).map((c) => c.key);
  const leave = losers.length === 1 ? `Card ${losers[0]} leaves` : `Cards ${losers.join(" and ")} leave`;
  const swipersText = input.swipers === null ? "" : ` · ${input.swipers} valid swipers`;
  return {
    deckId: deck.deckId,
    productName: deck.productName,
    title: deck.title,
    noun: deck.noun,
    flagName: deck.flagName,
    decided: winnerKey !== null,
    notDecidedText: input.notDecidedText,
    winnerKey,
    winnerText: winner?.text ?? null,
    headline: winnerKey
      ? `${name} has a ${percent(chanceOf(input.chances, winnerKey))}% chance of being best. Ship it?`
      : "Not decided yet",
    fromLine: `From Flagsmith experiment ${deck.flagName}${swipersText}`,
    cards: orderedCards(deck, input.chances, winnerKey),
    swipers: input.swipers,
    waitlist: deck.waitlist,
    steps: winnerKey
      ? [
          `Flagsmith ends the experiment and serves ${name} to everyone, using the same flag.`,
          `${leave} the feed. All ${deck.waitlist} waitlist emails stay yours.`,
          // Undo serves the control card to everyone: the test split is gone once Flagsmith completes the experiment.
          input.siteDomain
            ? `Your website ${input.siteDomain} switches to ${input.winnerKey} too (connected). ${switchBack(deck)}`
            : switchBack(deck),
        ]
      : [],
    insight: input.insight,
    alreadyShipped: input.alreadyShipped,
    ...(input.demoNote ? { demoNote: input.demoNote } : {}),
  };
}

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });

export function shippedView(deck: WatchedDeck, ship: ShipRecord, siteDomain?: string | null): ShippedView {
  const name = cardName(deck, ship.winnerKey);
  const winner = deck.cards.find((c) => c.key === ship.winnerKey);
  const losers = deck.cards.filter((c) => c.key !== ship.winnerKey).map((c) => c.key);
  const at = time(ship.approvedAt);
  const frozen = [...ship.chances]
    .sort((a, b) => b.chance - a.chance)
    .map((c) => `${c.key} ${percent(c.chance)}%`)
    .join(", ");
  return {
    deckId: deck.deckId,
    winnerKey: ship.winnerKey,
    winnerText: winner?.text ?? "",
    headline: `Shipped. ${name} is live for everyone.`,
    approvedLine: `Approved by ${ship.approvedBy} at ${at}`,
    ticks: [
      ship.completeConfirmed || ship.simulated
        ? { title: "Experiment completed in Flagsmith", detail: `${at} · results frozen: ${frozen}`, ok: true }
        : {
            title: "Flagsmith did not confirm completion",
            detail: `Results were not frozen by Flagsmith (${frozen} at approval)`,
            ok: false,
          },
      ship.valueWriteError
        ? {
            title: `Signed-in swipers get ${name}; the share link may still show the old text`,
            detail: ship.valueWriteError,
            ok: false,
          }
        : { title: `Flag now serves ${name} to everyone`, detail: `${deck.flagName} · ${ship.winnerKey} at 100%`, ok: true },
      {
        title: `${losers.length === 1 ? `Card ${losers[0]} left` : `Cards ${losers.join(" and ")} left`} the feed`,
        detail: `The share link now opens card ${ship.winnerKey}`,
        ok: true,
      },
      { title: `All ${deck.waitlist} waitlist emails kept`, detail: "Download them any time from results", ok: true },
      ...(siteDomain ? [{ title: `Your website shows ${name}`, detail: `${siteDomain} updated, no deploy`, ok: true }] : []),
    ],
    next:
      deck.noun === "price"
        ? null
        : { text: `Test price with target users, now with ${deck.noun} ${ship.winnerKey} on every card`, variable: "price" },
    undoAvailable: !ship.undoneAt,
    ...(!ship.undoneAt && ship.winnerKey !== deck.controlKey
      ? { undoNote: `Undo serves ${cardName(deck, deck.controlKey)} to everyone again. The test itself will not restart.` }
      : {}),
    simulated: ship.simulated,
  };
}

export function alertView(a: AlertRecord, deck: DeckNames): AlertView {
  const chance = chanceOf(a.chances, a.winnerKey);
  const t = alertTexts(deck, a.winnerKey, chance, a.swipers);
  return {
    deckId: a.deckId,
    productName: deck.productName,
    title: deck.title,
    headline: t.headline,
    body: t.body,
    winnerKey: a.winnerKey,
    chancePercent: percent(chance),
    swipers: a.swipers,
    status: a.status,
    raisedAt: a.createdAt,
    read: a.read === true,
  };
}
