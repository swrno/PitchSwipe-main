// Demo swipes for one founder's live decks, so Overview, Results, Who swiped and Insights show real-looking numbers.
//
//   node --env-file=.env --import ./scripts/register-ts.mjs scripts/seed/seed-swipes.mjs --owner-email you@example.com        dry run
//   ... --owner-email you@example.com --yes                                                                                   writes
//   npm run seed:swipes -- --owner-email you@example.com [--yes]   (needs MONGODB_URI and Firebase admin env in the shell)
//
// Per live deck of that owner: 60 to 200 synthetic swipers spread over the versions, a yes rate of 30-65% that differs by
// version, 10-30% of the yes answers join the waitlist (a claim), a few typed comments. Swipers are a pool of dummy users
// (firebaseUid "seed-swiper-NNN", email "...@pitchswipe.invalid") whose state, role and interests fill the segment groups.
// Writes the same documents the real flow does (Response valid+counted, Claim, User). On a deck that runs on a Flagsmith
// experiment (deck.experimentId) each swiper is assigned the variant Flagsmith serves for identity "<deckId>:u:<userId>"
// (the app's identity format), the DB response is written for THAT card, and the same events the app sends follow
// ($flag_exposure for all, answer_positive for yes, reward_claim for waitlist joins), 5 at a time, retrying 429 with
// backoff. Flagsmith's own results are never faked. A deck without an experiment keeps the local round-robin split. Idempotent: every seeded Response/Claim is marked by its
// swiper (seed-swiper-*), and a re-run deletes the previous seeded ones for these decks before writing again.
// The owner is looked up read-only in Firebase and must already have a profile. Never prints the URI, keys or the full uid.
import { register } from "node:module";

register("./mongoose-hooks.mjs", import.meta.url);

const argValue = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const write = process.argv.includes("--yes");
const ownerEmail = argValue("--owner-email");

function fail(message) {
  console.error(`seed:swipes: ${message}`);
  process.exit(1);
}
if (!ownerEmail) fail("--owner-email is required.");
if (write && !process.env.MONGODB_URI) fail("MONGODB_URI is not set.");
if (write && process.env.PITCHSWIPE_DEMO === "1") fail("PITCHSWIPE_DEMO=1 would use the in-memory demo store. Unset it.");
if (!process.env.MONGODB_URI) fail("MONGODB_URI is not set (needed to find the decks, even for a dry run).");

const POOL = 400;
const PREFIX = "seed-swiper-";
const DOMAIN = "@pitchswipe.invalid";

// Small deterministic generator, so a re-run builds the same pool and the same story.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (s) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);
const pickWeighted = (r, items) => {
  const total = items.reduce((n, [, w]) => n + w, 0);
  let x = r() * total;
  for (const [v, w] of items) if ((x -= w) < 0) return v;
  return items[0][0];
};

const STATE_WEIGHTS = [["Maharashtra", 22], ["Karnataka", 18], ["Delhi", 16], ["Tamil Nadu", 14], ["Uttar Pradesh", 12], ["West Bengal", 10], ["Gujarat", 8]];
const ROLE_WEIGHTS = [["Salaried", 24], ["Student", 20], ["Shop owner", 14], ["Homemaker", 12], ["Freelancer", 10], ["Business owner", 8], ["Farmer", 6], ["Driver", 3], ["Doctor", 3]];
const INTEREST_WEIGHTS = [["Food", 20], ["Retail", 16], ["Education", 14], ["Finance", 14], ["Healthcare", 12], ["Travel", 10], ["Fitness", 8], ["Fashion", 6]];

const YES_COMMENTS = [
  "I would use this every week.",
  "This solves a real problem for me.",
  "Fair price for what it does.",
  "Please build this soon.",
  "Looks simple enough to try.",
];
const NO_COMMENTS = [
  "Too expensive for me right now.",
  "I already do this with WhatsApp.",
  "Not sure I would trust it.",
  "Interesting, but I would not pay.",
];

function swiperProfile(i) {
  const r = rng(1000 + i);
  const interests = new Set();
  while (interests.size < 3) interests.add(pickWeighted(r, INTEREST_WEIGHTS));
  return {
    firebaseUid: `${PREFIX}${String(i).padStart(3, "0")}`,
    email: `${PREFIX}${String(i).padStart(3, "0")}${DOMAIN}`,
    name: `Demo swiper ${i}`,
    state: pickWeighted(r, STATE_WEIGHTS),
    role: pickWeighted(r, ROLE_WEIGHTS),
    interests: [...interests],
  };
}

const { getFirebaseAdminAuth } = await import("../../src/shared/lib/firebase/admin.ts");
const { connectDb } = await import("../../src/shared/lib/db.ts");
const models = await import("../../src/models/index.ts");
const service = await import("../../src/features/decks/server/service.ts");
const { Response, Claim, User, Card } = models;
const flagsmith = await import("../../src/features/flagsmith/index.ts");
const { cardForVariant, matchCard, exposureVariant } = await import("../../src/features/swipe/card.ts");

/** Runs fn over items, `limit` at a time. */
async function pool(items, limit, fn) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      await fn(items[i], i);
    }
  });
  await Promise.all(workers);
}
/** Retries 429 and 5xx with exponential backoff. */
async function withRetry(fn) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const status = error?.status;
      if (attempt >= 6 || !(status === 429 || (status >= 500 && status < 600))) throw error;
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt + Math.random() * 300));
    }
  }
}
const redact = (t) => String(t).split(process.env.MONGODB_URI).join("<MONGODB_URI>");

try {
  await connectDb();
  let fbUser;
  try {
    fbUser = await getFirebaseAdminAuth().getUserByEmail(ownerEmail);
  } catch (error) {
    if (error?.code === "auth/user-not-found") fail("no Firebase account has that email.");
    throw error;
  }
  const owner = await User.findOne({ firebaseUid: fbUser.uid }).select("_id").lean();
  if (!owner) fail(`Firebase account ${fbUser.uid.slice(0, 6)}... has no profile in the database yet.`);
  const ownerId = String(owner._id);
  console.log(`seed:swipes: owner account found (uid ${fbUser.uid.slice(0, 6)}...)`);

  const decks = (await service.listDecks(ownerId)).filter((d) => d.status === "live");
  if (decks.length === 0) fail("that account has no live decks. Run seed:feed -- --owner-email first.");
  const products = new Map((await service.listProducts(ownerId)).map((p) => [p.id, p]));

  // Plan every deck first, so the dry run shows the numbers.
  const now = Date.now();
  const plans = [];
  for (const deck of decks) {
    const cards = await Card.find({ deckId: deck._id }).select("variantKey").sort({ variantKey: 1 }).lean();
    if (cards.length < 2) continue;
    const r = rng(hash(deck._id));
    const n = 60 + Math.floor(r() * 141);
    const base = 0.4 + r() * 0.15;
    const rates = cards.map(() => Math.min(0.65, Math.max(0.3, base + (r() - 0.5) * 0.3)));
    const order = Array.from({ length: POOL }, (_, i) => i + 1).sort(() => r() - 0.5).slice(0, n);
    const targets = new Set(products.get(deck.productId)?.targetUsers ?? []);
    const rows = order.map((idx, k) => {
      const p = swiperProfile(idx);
      const roll = r();
      return {
        idx, p, k,
        roll,
        source: r() < 0.8 ? "feed" : "link",
        dwellMs: 2500 + Math.floor(r() * 7000),
        createdAt: new Date(now - Math.floor(r() * 7 * 24 * 3600 * 1000)),
        joinRoll: r(),
        joinRate: 0.1 + r() * 0.2,
        target: targets.has(p.role),
        commentRoll: r(),
        commentPick: r(),
      };
    });
    const swipeCards = cards.map((c) => ({ id: String(c._id), variantKey: c.variantKey, value: c.value }));
    // Local split (dry run, or a deck without an experiment): round-robin over the versions.
    const place = (row, ci) => {
      row.card = cards[ci];
      row.yes = row.roll < rates[ci];
      row.joins = row.yes && row.joinRoll < row.joinRate;
      const list = row.yes ? YES_COMMENTS : NO_COMMENTS;
      row.comment = row.commentRoll < 0.06 ? list[Math.floor(row.commentPick * list.length)] : undefined;
    };
    rows.forEach((row) => place(row, row.k % cards.length));
    plans.push({ deck, cards, rows, swipeCards, place });
    const per = cards.map((c) => {
      const mine = rows.filter((x) => x.card._id === c._id);
      return `${c.variantKey}:${mine.length}/${mine.filter((x) => x.yes).length}yes`;
    });
    console.log(`seed:swipes: deck ${deck._id.slice(-6)} (${deck.variable}, ${deck.experimentId ? "Flagsmith experiment" : "local split"}): ${rows.length} swipers, ${rows.filter((x) => x.joins).length} joins, ${rows.filter((x) => x.comment).length} comments [${per.join(" ")}]`);
  }
  const total = plans.reduce((n, p) => n + p.rows.length, 0);
  console.log(`seed:swipes: ${plans.length} decks, ${total} swipes planned.`);
  if (!write) {
    console.log("seed:swipes: dry run, nothing written. Add --yes to write.");
    process.exit(0);
  }

  // Swiper pool: upsert by firebaseUid (stable).
  const used = new Set(plans.flatMap((p) => p.rows.map((x) => x.idx)));
  await User.bulkWrite(
    [...used].map((i) => {
      const p = swiperProfile(i);
      return {
        updateOne: {
          filter: { firebaseUid: p.firebaseUid },
          update: { $set: { state: p.state, role: p.role, interests: p.interests, counting: true, qualityScore: 85 }, $setOnInsert: { firebaseUid: p.firebaseUid, name: p.name, email: p.email, emailVerified: true, roles: ["swiper"], checkReasons: [], createdAt: new Date() } },
          upsert: true,
        },
      };
    }),
  );
  const idByUid = new Map((await User.find({ firebaseUid: new RegExp(`^${PREFIX}`) }).select("firebaseUid").lean()).map((u) => [u.firebaseUid, String(u._id)]));
  const seedIds = [...idByUid.values()];

  let responses = 0;
  let claims = 0;
  let exposures = 0;
  let positives = 0;
  let rewardClaims = 0;
  let eventErrors = 0;
  for (const { deck, rows, cards, swipeCards, place } of plans) {
    const uidOf = (x) => idByUid.get(x.p.firebaseUid);
    // 1. Which version does Flagsmith give each swiper? The DB response is written for that card.
    if (deck.experimentId) {
      let fallbacks = 0;
      await pool(rows, 5, async (x) => {
        let card;
        try {
          const a = await withRetry(() => flagsmith.assignSwiper(deck._id, `u:${uidOf(x)}`, deck.flagName, x.source));
          card = cardForVariant(swipeCards, a.variant) ?? matchCard(swipeCards, a.value);
        } catch {
          card = undefined;
        }
        if (!card) {
          fallbacks++;
          x.noFlag = true;
        }
        const ci = card ? swipeCards.findIndex((c) => c.id === card.id) : x.k % cards.length;
        place(x, ci);
      });
      if (fallbacks) console.log(`seed:swipes: deck ${deck._id.slice(-6)}: ${fallbacks} swipers got no variant from Flagsmith (local card used, no events sent for them).`);
    }
    // 2. Replace the previous seeded swipes for this deck.
    await Response.deleteMany({ deckId: deck._id, swiperId: { $in: seedIds } });
    await Claim.deleteMany({ deckId: deck._id, email: new RegExp(`^${PREFIX}`) });
    await Response.insertMany(
      rows.map((x) => ({
        deckId: deck._id,
        swiperId: uidOf(x),
        source: x.source,
        cardId: x.card._id,
        role: x.p.role,
        isTargetUser: x.target,
        answer: x.yes ? "positive" : "negative",
        dwellMs: x.dwellMs,
        region: x.p.state,
        valid: true,
        counted: true,
        ...(x.comment ? { comment: x.comment } : {}),
        createdAt: x.createdAt,
      })),
    );
    const claimRows = rows.filter((x) => x.joins);
    if (claimRows.length) {
      await Claim.insertMany(claimRows.map((x) => ({ deckId: deck._id, cardId: x.card._id, email: x.p.email, createdAt: new Date(x.createdAt.getTime() + 60000) })));
    }
    responses += rows.length;
    claims += claimRows.length;

    // 3. The events the app sends: exposure for every counted swipe, then answer_positive, then reward_claim.
    if (deck.experimentId) {
      const exposedIds = [];
      await pool(rows.filter((x) => !x.noFlag), 5, async (x) => {
        const swiperGuid = `u:${uidOf(x)}`;
        try {
          const t = await withRetry(() =>
            flagsmith.trackExposure({ deckId: deck._id, swiperGuid, flagName: deck.flagName, variant: exposureVariant(swipeCards, swipeCards.find((c) => c.id === String(x.card._id))), source: x.source, experimentId: deck.experimentId, counted: true }),
          );
          if (t.accepted < 1) throw new Error("exposure rejected");
          exposures++;
          exposedIds.push(uidOf(x));
          if (x.yes) {
            const p = await withRetry(() => flagsmith.trackEvent({ deckId: deck._id, swiperGuid, flagName: deck.flagName, event: "answer_positive", source: x.source, counted: true }));
            if (p.accepted > 0) positives++;
            else eventErrors++;
          }
          if (x.joins) {
            const c = await withRetry(() => flagsmith.trackEvent({ deckId: deck._id, swiperGuid, flagName: deck.flagName, event: "reward_claim", source: x.source, counted: true }));
            if (c.accepted > 0) rewardClaims++;
            else eventErrors++;
          }
        } catch (error) {
          eventErrors++;
          if (eventErrors <= 3) console.warn(`seed:swipes: event failed: ${redact(error?.message ?? error).slice(0, 200)}`);
        }
      });
      if (exposedIds.length) await Response.updateMany({ deckId: deck._id, swiperId: { $in: exposedIds } }, { $set: { exposedToFlagsmith: true } });
      console.log(`seed:swipes: deck ${deck._id.slice(-6)}: events sent for ${exposedIds.length}/${rows.length} swipers.`);
    }
  }
  if (plans.some((p) => p.deck.experimentId)) console.log(`seed:swipes: Flagsmith events accepted: ${exposures} exposures, ${positives} answer_positive, ${rewardClaims} reward_claim, ${eventErrors} failed.`);
  console.log(`seed:swipes: done. ${responses} swipes and ${claims} waitlist joins on ${plans.length} decks.`);

  // Verify through the app's own aggregation for the first deck.
  const { loadResults } = await import("../../src/features/results/server/load.ts");
  const payload = await loadResults(ownerId, plans[0].deck._id);
  const lines = [`totals ${JSON.stringify(payload?.totals ?? null)}`, ...(payload?.leaderboard?.everyone ?? []).map((c) => `${c.key}: ${JSON.stringify(c).slice(0, 140)}`)];
  console.log(`seed:swipes: results check, deck ${plans[0].deck._id.slice(-6)}: ${lines.join(" | ") || "payload keys " + Object.keys(payload ?? {}).join(",")}`);
} catch (error) {
  console.error(`seed:swipes: failed: ${redact(error?.message ?? error)}`);
  process.exitCode = 1;
}
process.exit(process.exitCode ?? 0);
