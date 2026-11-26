import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { getFirebaseAdminAuth } from "@/lib/firebase/admin";
import { AuthError, verifyRequestToken } from "@/lib/auth/server";
import { isIndustry, isRole, isState } from "@/lib/lists";
import { QUALITY, isCounting } from "@/lib/quality";
import { qualityCheckEnabled, swiperCounts } from "@/lib/quality/switch";
import { limitKey, limitRequest } from "@/lib/ratelimit";
import { AssistantEvent, Card, Claim, Credits, Deck, Product, Response as ResponseModel, Site, User, Wallet } from "@/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Doc = Record<string, unknown>;

function serialize(doc: Doc) {
  const score = typeof doc.qualityScore === "number" ? doc.qualityScore : 0;
  const reasons = Array.isArray(doc.checkReasons) ? doc.checkReasons : [];
  const created = doc.createdAt instanceof Date ? doc.createdAt.toISOString() : typeof doc.createdAt === "string" ? doc.createdAt : null;
  return {
    id: String(doc._id),
    name: doc.name,
    email: doc.email,
    emailVerified: Boolean(doc.emailVerified),
    role: doc.role,
    state: doc.state,
    interests: doc.interests ?? [],
    counting: swiperCounts(Boolean(doc.counting)),
    // Same rule as GET /api/practice/status: a 0 score with no reasons means the check was not taken yet.
    qualityScore: score,
    qualityChecked: score > 0 || reasons.length > 0 || Boolean(doc.counting),
    countsTowardPay: qualityCheckEnabled() ? isCounting(score) : true,
    qualityCheck: qualityCheckEnabled(),
    countingThreshold: QUALITY.countingScore,
    createdAt: created,
  };
}

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

function fail(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  if (error instanceof Error && error.message.startsWith("MONGODB_URI")) {
    return NextResponse.json({ error: error.message, code: "not_configured" }, { status: 503 });
  }
  console.error("profile route", error);
  return NextResponse.json({ error: "Could not reach the database." }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const token = await verifyRequestToken(request);
    await connectDb();
    const doc = await User.findOne({ firebaseUid: token.uid }).lean<Doc>();
    if (!doc) return NextResponse.json({ error: "No profile yet.", code: "no_profile" }, { status: 404 });
    const verified = Boolean(token.email_verified);
    if (Boolean(doc.emailVerified) !== verified) {
      await User.updateOne({ firebaseUid: token.uid }, { $set: { emailVerified: verified } });
      doc.emailVerified = verified;
    }
    return NextResponse.json({ user: serialize(doc) });
  } catch (error) {
    return fail(error);
  }
}

/** Create or update the signed-in user's profile. email/emailVerified always come from the verified token. */
export async function POST(request: Request) {
  try {
    const token = await verifyRequestToken(request);
    const body = (await request.json().catch(() => null)) as Doc | null;
    if (!body || typeof body !== "object") return bad("Invalid request body.");

    const set: Doc = { emailVerified: Boolean(token.email_verified) };
    if (body.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (name.length < 1 || name.length > 80) return bad("Enter your name (up to 80 characters).");
      set.name = name;
    }
    if (body.role !== undefined) {
      if (typeof body.role !== "string" || !isRole(body.role)) return bad("Pick a role from the list.");
      set.role = body.role;
    }
    if (body.state !== undefined) {
      if (typeof body.state !== "string" || !isState(body.state)) return bad("Pick a state from the list.");
      set.state = body.state;
    }
    if (body.interests !== undefined) {
      if (!Array.isArray(body.interests) || !body.interests.every((i) => typeof i === "string" && isIndustry(i))) {
        return bad("Interests must come from the list.");
      }
      set.interests = [...new Set(body.interests as string[])];
    }

    await connectDb();
    const existing = await User.findOne({ firebaseUid: token.uid }).select("_id").lean<Doc>();
    if (!existing) {
      if (!token.email) return bad("Your account has no email address.");
      // A deleted account's ID token stays valid for up to an hour; never re-create a profile for it.
      try {
        await getFirebaseAdminAuth().getUser(token.uid);
      } catch (error) {
        if ((error as { code?: string })?.code === "auth/user-not-found") {
          return NextResponse.json({ error: "This account was deleted.", code: "unauthenticated" }, { status: 401 });
        }
        throw error;
      }
      const name = (set.name as string | undefined) ?? (typeof token.name === "string" ? token.name : undefined);
      if (!name || !set.role || !set.state) return bad("Name, role and state are required.");
      set.name = name;
    }
    if (token.email) set.email = token.email.toLowerCase();

    const doc = await User.findOneAndUpdate(
      { firebaseUid: token.uid },
      { $set: set, $setOnInsert: { firebaseUid: token.uid } },
      { upsert: true, returnDocument: "after", runValidators: true, setDefaultsOnInsert: true },
    ).lean<Doc>();
    return NextResponse.json({ user: serialize(doc as Doc) }, { status: existing ? 200 : 201 });
  } catch (error) {
    if ((error as { code?: number })?.code === 11000) {
      return NextResponse.json({ error: "That email already has a profile." }, { status: 409 });
    }
    return fail(error);
  }
}

/**
 * DELETE /api/profile: the signed-in, email-verified user deletes their own account.
 *
 * Everything is keyed from the verified Firebase uid (-> User._id) and the token's email. What happens per collection:
 *
 * DELETED (the user's own data):
 *  - Wallet  { userId: user._id }   the demo earnings ledger.
 *  - Credits { ownerId: user._id }  the founder deck allowance.
 *  - Claim   { email = the verified token email }  reward claims. A claim is only an email on a founder's
 *            waitlist, so it cannot be anonymised; it is removed (that founder's waitlist shrinks by one).
 *  - Founder data the user owns: Product { ownerId }, Deck { ownerId }, and for those: Card, AssistantEvent,
 *            Site (by productId), and the Response and Claim rows collected on those decks (they are the deleted
 *            founder's research and unreachable once the deck is gone). Other swipers' Wallet entries for those
 *            decks are NOT touched: each entry stores its own amount and title, so balances do not change.
 *  - flagsmith_state (native collection, src/lib/flagsmith/mongo-store.ts): the `snapshot:<flagName>` and
 *            `refresh:<experimentId>` bookkeeping rows of the deleted founder's decks.
 *  - assistantAlerts, assistantShips (native collections, src/lib/assistant/store.ts): rows whose ownerId is the
 *            user's id or whose _id is one of the user's deck ids. Ship rows carry the founder's name (approvedBy)
 *            and Flagsmith snapshots. Matching by owner also catches rows whose deck is already gone.
 *  - User    { firebaseUid }  deleted last of the Mongo steps, because every other key is derived from it.
 *  - The Firebase Authentication user (firebase-admin auth().deleteUser).
 *
 * ANONYMISED (shared: other founders' results are computed from these rows, deleting would change their numbers):
 *  - Response { swiperId: user._id } on decks the user does NOT own. swiperId is required and part of a unique
 *    (deckId, swiperId) index, so it is reassigned to ONE fresh random ObjectId (not derivable from the user; one id
 *    for all rows keeps per-deck and distinct-swiper counts exact). The free-text `comment`, the whole
 *    `commentVoice` (the voice note audio is stored inline there as a data URL) and any natively written `ip` are
 *    removed. answer, cardId, role, region, dwellMs, valid and counted stay.
 *
 * NOT CLEANED HERE: the feature flags / experiments themselves live in Flagsmith (not MongoDB) and are left as they
 * are. A deleted user's Firebase ID token stays valid until it expires (up to an hour); POST refuses to create a
 * new profile for a uid Firebase no longer knows, but other routes that only verify the token are not checked here.
 *
 * Retry-safe: a missing profile skips straight to the Firebase delete, and a Firebase user that is already gone
 * counts as success.
 */
export async function DELETE(request: Request) {
  const byIp = limitRequest(request, "profile:delete", { limit: 10, windowMs: 10 * 60_000 });
  if (byIp) return byIp;
  try {
    const token = await verifyRequestToken(request);
    const byUser = limitKey(`profile:delete:${token.uid}`, { limit: 5, windowMs: 10 * 60_000 });
    if (byUser) return byUser;
    // An unverified address could be someone else's: only a verified owner may delete the account.
    if (token.email_verified !== true) {
      return NextResponse.json({ error: "Verify your email first.", code: "unverified" }, { status: 403 });
    }

    const mongoose = await connectDb();
    const user = await User.findOne({ firebaseUid: token.uid }).select("_id email").lean<Doc>();
    if (user) {
      const userId = user._id as Types.ObjectId;
      const emails = [
        ...new Set(
          // Only the token's email: DELETE requires email_verified, so this is an address the caller proved they own.
          // The stored profile email is not used, since it may never have been verified by this caller.
          [token.email]
            .filter((e): e is string => typeof e === "string" && e.length > 0)
            .map((e) => e.toLowerCase()),
        ),
      ];

      // Founder data the user owns.
      const decks = (await Deck.find({ ownerId: userId }).select("_id flagName experimentId").lean()) as unknown as Doc[];
      const deckIds = decks.map((d) => d._id);
      const productIds = ((await Product.find({ ownerId: userId }).select("_id").lean()) as unknown as Doc[]).map((p) => p._id);
      if (deckIds.length > 0) {
        // Flagsmith bookkeeping kept in MongoDB for these decks (src/lib/flagsmith: snapshot:<flagName>, refresh:<experimentId>).
        const stateKeys = decks.flatMap((d) => [
          ...(typeof d.flagName === "string" ? [`snapshot:${d.flagName}`] : []),
          ...(typeof d.experimentId === "string" ? [`refresh:${d.experimentId}`] : []),
        ]);
        const db = mongoose.connection.db;
        await Promise.all([
          Card.deleteMany({ deckId: { $in: deckIds } }),
          AssistantEvent.deleteMany({ deckId: { $in: deckIds } }),
          ResponseModel.deleteMany({ deckId: { $in: deckIds } }),
          Claim.deleteMany({ deckId: { $in: deckIds } }),
          db && stateKeys.length > 0
            ? db.collection<{ _id: string }>("flagsmith_state").deleteMany({ _id: { $in: stateKeys } })
            : Promise.resolve(),
        ]);
        await Deck.deleteMany({ _id: { $in: deckIds }, ownerId: userId });
      }
      // Assistant alert and ship records (native collections, src/lib/assistant/store.ts: _id = deckId string,
      // ownerId = String(User._id)). Matched by owner too, so rows whose deck is already gone are removed as well.
      const nativeDb = mongoose.connection.db;
      if (nativeDb) {
        const assistantFilter = {
          $or: [{ ownerId: String(userId) }, ...(deckIds.length > 0 ? [{ _id: { $in: deckIds.map(String) } }] : [])],
        };
        await Promise.all([
          nativeDb.collection<{ _id: string; ownerId?: string }>("assistantAlerts").deleteMany(assistantFilter),
          nativeDb.collection<{ _id: string; ownerId?: string }>("assistantShips").deleteMany(assistantFilter),
        ]);
      }
      if (productIds.length > 0) {
        await Site.deleteMany({ productId: { $in: productIds } });
        await Product.deleteMany({ _id: { $in: productIds }, ownerId: userId });
      }

      // The user's answers on other founders' decks: anonymise through the native collection, so fields written
      // outside the schema (ip, commentVoice.deleteAfter) go too.
      await ResponseModel.collection.updateMany(
        { swiperId: userId },
        { $set: { swiperId: new Types.ObjectId() }, $unset: { comment: "", commentVoice: "", ip: "" } },
      );

      await Promise.all([
        Wallet.collection.deleteMany({ userId }),
        Credits.deleteMany({ ownerId: userId }),
        emails.length > 0 ? Claim.deleteMany({ email: { $in: emails } }) : Promise.resolve(),
      ]);
      await User.deleteOne({ _id: userId });
    }

    try {
      await getFirebaseAdminAuth().deleteUser(token.uid);
    } catch (error) {
      if ((error as { code?: string })?.code !== "auth/user-not-found") {
        console.error("profile delete: Firebase deleteUser failed after the data was removed", error);
        return NextResponse.json(
          { error: "Your data was deleted, but we could not remove your sign-in. Try again in a minute.", code: "auth_delete_failed" },
          { status: 502 },
        );
      }
    }
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return fail(error);
  }
}
