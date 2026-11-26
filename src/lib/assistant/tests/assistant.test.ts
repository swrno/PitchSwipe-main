// Run: node --import ./scripts/register-ts.mjs --test src/lib/assistant/tests/assistant.test.ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { HEADLINE_FLAGSMITH_RESULTS } from "@/fixtures";
import type { FlagsmithExperimentResults } from "@/types";

import { nextAlertAction } from "../alerts";
import { alertTexts, emailTexts } from "../copy";
import { assessDeck } from "../decided";
import { createResendMailer, defaultMailer, noopMailer, type Mailer, type MailMessage } from "../mailer";
import { demoDecidedResults, demoReviewNote, type DeckSource, type ResultsSource } from "../sources";
import { createMemoryAssistantStore } from "../store";
import { getReview, listAlerts, shipDeck, snoozeAlert, undoDeck, type FlagsmithPort, type ShipDeps } from "../ship";
import type { AlertRecord, ResultsSnapshot, WatchedDeck } from "../types";
import { FlagsmithApiError, FlagsmithCompletedDifferently, FlagsmithVersioningError } from "@/lib/flagsmith/errors";
import { runWatcher } from "../watcher";

const NOW = new Date("2026-11-15T13:12:00Z");

function results(chances: Record<string, number>, identities = 85, srm = false): FlagsmithExperimentResults {
  return {
    ...HEADLINE_FLAGSMITH_RESULTS,
    srmWarning: srm,
    cards: ["A", "B", "C"].map((k) => ({
      cardId: `card-${k}`,
      variantKey: k,
      identities,
      chanceToBeatControl: chances[k],
    })),
  };
}

describe("decided rule", () => {
  it("is decided at 95%+ with 50+ identities each and no SRM", () => {
    const a = assessDeck(results({ A: 0.03, B: 0.96, C: 0.01 }), "A", 256);
    assert.equal(a.decided, true);
    assert.equal(a.decided && a.winnerKey, "B");
    assert.equal(a.checksPassed, true);
  });
  it("is not decided at 94.9% or at 91%", () => {
    assert.equal(assessDeck(results({ A: 0.03, B: 0.949, C: 0.01 }), "A").decided, false);
    assert.equal(assessDeck(results({ A: 0.03, B: 0.91, C: 0.01 }), "A").decided, false);
  });
  it("waits while any card has under 50 identities", () => {
    const a = assessDeck(results({ A: 0.03, B: 0.99, C: 0.01 }, 49), "A");
    assert.equal(a.decided, false);
    assert.equal(!a.decided && a.reason, "collecting");
  });
  it("never decides with a sample-ratio warning", () => {
    assert.equal(assessDeck(results({ A: 0.03, B: 0.99, C: 0.01 }, 85, true), "A").decided, false);
  });
  it("the control cannot win against itself", () => {
    assert.equal(assessDeck(results({ A: 0.99, B: 0.2, C: 0.1 }), "A").decided, false);
  });
  it("no results means not decided", () => {
    const a = assessDeck(null, "A");
    assert.equal(!a.decided && a.reason, "no_results");
  });
});

describe("alert lifecycle", () => {
  const dec = assessDeck(results({ A: 0.03, B: 0.96, C: 0.01 }), "A", 256);
  const not = assessDeck(results({ A: 0.03, B: 0.9, C: 0.01 }), "A", 256);
  const alert = (patch: Partial<AlertRecord> = {}): AlertRecord => ({
    deckId: "d", ownerId: "o", status: "active", winnerKey: "B", chances: [], swipers: 256, createdAt: "", updatedAt: "", ...patch,
  });
  it("raises once, then refreshes", () => {
    assert.equal(nextAlertAction(null, dec, NOW).kind, "raise");
    assert.equal(nextAlertAction(alert(), dec, NOW).kind, "refresh");
  });
  it("withdraws when the chance drops", () => {
    assert.equal(nextAlertAction(alert(), not, NOW).kind, "withdraw");
    assert.equal(nextAlertAction(alert({ status: "snoozed" }), not, NOW).kind, "withdraw");
    assert.equal(nextAlertAction(null, not, NOW).kind, "none");
  });
  it("snooze holds for 24 h then resurfaces", () => {
    const until = new Date(NOW.getTime() + 24 * 3_600_000).toISOString();
    const s = alert({ status: "snoozed", snoozedUntil: until });
    assert.equal(nextAlertAction(s, dec, NOW).kind, "none");
    assert.equal(nextAlertAction(s, dec, new Date(Date.parse(until) + 1)).kind, "resurface");
  });
  it("a shipped deck is never re-alerted", () => {
    assert.equal(nextAlertAction(alert({ status: "shipped" }), dec, NOW).kind, "none");
  });
  it("a withdrawn alert can be raised again", () => {
    assert.equal(nextAlertAction(alert({ status: "withdrawn" }), dec, NOW).kind, "raise");
  });
});

describe("copy", () => {
  const deck = { productName: "Voice Khata", title: "Headline test", noun: "headline" };
  it("matches the spec wording with code-filled numbers", () => {
    const t = alertTexts(deck, "B", 0.96, 256);
    assert.equal(t.headline, "Voice Khata headline test: B has a 96% chance of being best.");
    assert.equal(t.body, "256 swipers, all checks passed. Nothing changes until you approve.");
    assert.match(emailTexts(deck, "B", 0.96, 256, "https://x/decks/d").text, /Nothing changes until you approve/);
  });
});

describe("mailer", () => {
  it("does not send without RESEND_API_KEY", async () => {
    assert.equal(defaultMailer({}), noopMailer);
    assert.equal(await noopMailer.send({ to: "a@b.c", subject: "s", text: "t" }), false);
  });
  it("posts to Resend with the key when injected", async () => {
    let seen: { url: string; auth: string | null } | null = null;
    const fetchFn = (async (url: string, init: RequestInit) => {
      seen = { url, auth: new Headers(init.headers).get("authorization") };
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    const ok = await createResendMailer({ apiKey: "k", from: "f", fetchFn }).send({ to: "a@b.c", subject: "s", text: "t" });
    assert.equal(ok, true);
    assert.deepEqual(seen, { url: "https://api.resend.com/emails", auth: "Bearer k" });
  });
});

/* ---------- fakes ---------- */

const DECK: WatchedDeck = {
  deckId: "d1",
  ownerId: "o1",
  ownerEmail: "arjun@example.com",
  ownerName: "Arjun Sen",
  productName: "Voice Khata",
  title: "Headline test",
  noun: "headline",
  flagName: "deck_voice-khata-headline",
  experimentId: "exp1",
  controlKey: "A",
  cards: [
    { key: "A", cardId: "card-A", text: "Speak your sales. The ledger writes itself." },
    { key: "B", cardId: "card-B", text: "Stop chasing payments. Get paid on time." },
    { key: "C", cardId: "card-C", text: "Your whole ledger for Rs 10 a day." },
  ],
  waitlist: 26,
};

function harness(initial: ResultsSnapshot) {
  const state = { snap: initial, statuses: [] as string[], sent: [] as MailMessage[] };
  const decks: DeckSource = {
    listWatchable: async () => [DECK],
    getForOwner: async (o, id) => (o === "o1" && id === "d1" ? DECK : null),
    setStatus: async (_o, _d, s) => void state.statuses.push(s),
  };
  const res: ResultsSource = { get: async () => state.snap };
  const mailer: Mailer = { send: async (m) => (state.sent.push(m), true) };
  const store = createMemoryAssistantStore();
  let clock = NOW;
  const now = () => clock;
  return { state, decks, res, mailer, store, now, setClock: (d: Date) => (clock = d) };
}

const DECIDED: ResultsSnapshot = { results: results({ A: 0.03, B: 0.96, C: 0.01 }, 85), swipers: 256 };
const LEADING: ResultsSnapshot = { results: results({ A: 0.03, B: 0.91, C: 0.01 }, 85), swipers: 250 };

describe("watcher", () => {
  const deps = (h: ReturnType<typeof harness>) => ({
    decks: h.decks, results: h.res, store: h.store, mailer: h.mailer, baseUrl: "https://app.test", now: h.now,
  });

  it("raises an alert, emails once, never ships", async () => {
    const h = harness(DECIDED);
    const [o] = await runWatcher(deps(h));
    assert.equal(o.action, "raised");
    assert.equal(h.state.sent.length, 1);
    assert.match(h.state.sent[0].subject, /B has a 96% chance of being best/);
    assert.deepEqual(h.state.statuses, ["decided"]);
    assert.equal((await h.store.getShip("d1")), null);
    const [again] = await runWatcher(deps(h));
    assert.equal(again.action, "refreshed");
    assert.equal(h.state.sent.length, 1);
    assert.equal((await h.store.lastCheck("d1"))?.type, "checked");
  });

  it("withdraws the alert when the chance drops under 95%", async () => {
    const h = harness(DECIDED);
    await runWatcher(deps(h));
    h.state.snap = LEADING;
    const [o] = await runWatcher(deps(h));
    assert.equal(o.action, "withdrawn");
    assert.equal((await h.store.getAlert("d1"))?.status, "withdrawn");
    assert.equal(h.state.statuses.at(-1), "live");
  });

  it("Later snoozes 24 hours; it resurfaces without a second email", async () => {
    const h = harness(DECIDED);
    await runWatcher(deps(h));
    const shipDeps: ShipDeps = { decks: h.decks, results: h.res, store: h.store, flagsmith: null, now: h.now };
    assert.equal((await listAlerts(shipDeps, "o1")).length, 1);
    assert.equal((await snoozeAlert(shipDeps, { ownerId: "o1", deckId: "d1" })).ok, true);
    assert.equal((await listAlerts(shipDeps, "o1")).length, 0);
    assert.equal((await runWatcher(deps(h)))[0].action, "none");
    h.setClock(new Date(NOW.getTime() + 25 * 3_600_000));
    assert.equal((await listAlerts(shipDeps, "o1")).length, 1);
    assert.equal((await runWatcher(deps(h)))[0].action, "resurfaced");
    assert.equal(h.state.sent.length, 1);
  });

  it("a failing deck does not stop the run", async () => {
    const h = harness(DECIDED);
    h.res.get = async () => {
      throw new Error("boom");
    };
    const [o] = await runWatcher(deps(h));
    assert.equal(o.action, "error");
  });
});

describe("ship", () => {
  /** Mirrors the wrapper: a refused complete is tolerated only when the experiment already shows "completed". */
  function fm(opts: { completeStatus?: number; alreadyCompleted?: boolean; completeError?: Error; weightsError?: Error } = {}) {
    const calls: string[] = [];
    const decisions: unknown[] = [];
    const port: FlagsmithPort = {
      snapshotFlag: async () => (calls.push("snapshot"), { featureStateId: 7 }),
      completeExperiment: async (_id, decision) => {
        calls.push("complete");
        decisions.push(decision);
        if (opts.completeError) throw opts.completeError;
        if (opts.alreadyCompleted) return { alreadyCompleted: true, response: { detail: "Unable to transition experiment status." } };
        if (opts.completeStatus) throw Object.assign(new Error("x"), { status: opts.completeStatus, body: { detail: "no" } });
        return { alreadyCompleted: false, response: { status: "completed" } };
      },
      optionIdsForFlag: async () => (calls.push("options"), { B: 101, C: 102 }),
      setFlagWeights: async (_f, c, w, o) => {
        calls.push(`weights:${c}:${JSON.stringify(w)}:${o?.featureStateValue}:enabled=${o?.enabled}`);
        if (opts.weightsError) throw opts.weightsError;
      },
      undoShip: async () => void calls.push("undo"),
    };
    return { calls, port, decisions };
  }
  const build = (snap: ResultsSnapshot, port: FlagsmithPort | null) => {
    const h = harness(snap);
    const deps: ShipDeps = { decks: h.decks, results: h.res, store: h.store, flagsmith: port, now: h.now };
    return { h, deps };
  };
  const req = { ownerId: "o1", deckId: "d1" };

  it("never ships without approve: true", async () => {
    const { calls, port } = fm();
    const { deps } = build(DECIDED, port);
    for (const approve of [undefined, false, "true", 1]) {
      const r = await shipDeck(deps, { ...req, approve });
      assert.equal(r.ok, false);
    }
    assert.deepEqual(calls, []);
  });

  it("refuses another founder's deck", async () => {
    const { calls, port } = fm();
    const { deps } = build(DECIDED, port);
    const r = await shipDeck(deps, { ownerId: "intruder", deckId: "d1", approve: true });
    assert.deepEqual([r.ok, !r.ok && r.status], [false, 404]);
    assert.deepEqual(calls, []);
  });

  it("refuses when Flagsmith no longer says decided, or the winner differs", async () => {
    const a = fm();
    const r = await shipDeck(build(LEADING, a.port).deps, { ...req, approve: true });
    assert.deepEqual([r.ok, !r.ok && r.status], [false, 409]);
    const b = fm();
    const r2 = await shipDeck(build(DECIDED, b.port).deps, { ...req, approve: true, winnerKey: "C" });
    assert.deepEqual([r2.ok, !r2.ok && r2.status], [false, 409]);
    assert.deepEqual([...a.calls, ...b.calls], []);
  });

  it("ships in order: snapshot, complete, snapshot, 100/0 with the winning text", async () => {
    const { calls, port } = fm();
    const { h, deps } = build(DECIDED, port);
    await runWatcher({ decks: h.decks, results: h.res, store: h.store, mailer: h.mailer, baseUrl: "x", now: h.now });
    const r = await shipDeck(deps, { ...req, approve: true, winnerKey: "B" });
    assert.equal(r.ok, true);
    assert.deepEqual(calls, [
      "snapshot",
      "options",
      "complete",
      "snapshot",
      'weights:A:{"A":0,"B":100,"C":0}:Stop chasing payments. Get paid on time.:enabled=true',
    ]);
    if (r.ok) {
      assert.equal(r.value.headline, "Shipped. Headline B is live for everyone.");
      assert.equal(r.value.ticks.length, 4);
      assert.match(r.value.ticks[0].detail, /B 96%, A 3%, C 1%/);
      assert.equal(r.value.ticks[0].ok, true);
    }
    const ship = await h.store.getShip("d1");
    assert.deepEqual(ship?.completeResponse, { status: "completed" });
    assert.equal((await h.store.getAlert("d1"))?.status, "shipped");
    assert.equal(h.state.statuses.at(-1), "shipped");
    // A second approve is refused.
    assert.equal((await shipDeck(deps, { ...req, approve: true })).ok, false);
  });

  it("sends the rollout decision: variant + the stored option id, or control", async () => {
    const a = fm();
    const { h, deps } = build(DECIDED, a.port);
    h.decks.getForOwner = async (o, d) => (o === "o1" && d === "d1" ? { ...DECK, optionIds: { B: 501, C: 502 } } : null);
    assert.equal((await shipDeck(deps, { ...req, approve: true })).ok, true);
    assert.deepEqual(a.decisions, [{ rollout_decision: "variant", rollout_variant: 501 }]);
    assert.ok(!a.calls.includes("options"), "stored option ids are used, no lookup");
    assert.deepEqual((await h.store.getShip("d1"))?.rolloutDecision, { rollout_decision: "variant", rollout_variant: 501 });
  });

  it("tolerates a refused complete only when Flagsmith shows it completed", async () => {
    const { calls, port } = fm({ alreadyCompleted: true });
    const { h, deps } = build(DECIDED, port);
    const r = await shipDeck(deps, { ...req, approve: true });
    assert.equal(r.ok, true);
    assert.ok(calls.some((c) => c.startsWith("weights")));
    const ship = await h.store.getShip("d1");
    assert.equal(ship?.completeConfirmed, true);
    assert.match(ship?.completeError ?? "", /already completed/);
  });

  it("a 400 from complete that is not 'already completed' aborts before the flag is touched", async () => {
    const { calls, port } = fm({ completeStatus: 400 });
    const { h, deps } = build(DECIDED, port);
    const r = await shipDeck(deps, { ...req, approve: true });
    assert.deepEqual([r.ok, !r.ok && r.status], [false, 502]);
    assert.ok(!calls.some((c) => c.startsWith("weights")));
    assert.ok((await h.store.getShip("d1"))?.undoneAt);
  });

  it("a failed text write after complete keeps the ship and shows the error", async () => {
    const { port } = fm({ weightsError: new FlagsmithVersioningError({ detail: "v2" }) });
    const { h, deps } = build(DECIDED, port);
    const r = await shipDeck(deps, { ...req, approve: true });
    assert.equal(r.ok, true);
    const ship = await h.store.getShip("d1");
    assert.equal(ship?.undoneAt, undefined);
    assert.match(ship?.valueWriteError ?? "", /v2 feature versioning/);
    if (r.ok) assert.equal(r.value.ticks[1].ok, false);
  });

  it("a raw Flagsmith or transport error never reaches the shipped screen", async () => {
    const raw = new FlagsmithApiError("PUT", "/api/v1/environments/envKEY/featurestates/123/", 500, { trace: "x" });
    for (const [error, expected] of [
      [raw, "Flagsmith did not accept the new text (HTTP 500)."],
      [new Error("The operation was aborted due to timeout"), "Flagsmith did not accept the new text."],
    ] as const) {
      const { port } = fm({ weightsError: error });
      const { h, deps } = build(DECIDED, port);
      const r = await shipDeck(deps, { ...req, approve: true });
      assert.equal(r.ok, true);
      assert.equal((await h.store.getShip("d1"))?.valueWriteError, expected);
      if (r.ok) {
        assert.equal(r.value.ticks[1].detail, expected);
        assert.doesNotMatch(JSON.stringify(r.value), /featurestates|envKEY|aborted/);
      }
    }
  });

  it("ships with the flag enabled, so a flag left disabled serves the winner", async () => {
    const { calls, port } = fm();
    const { deps } = build(DECIDED, port);
    await shipDeck(deps, { ...req, approve: true });
    assert.ok(calls.some((c) => c.startsWith("weights") && c.endsWith("enabled=true")));
  });

  it("an experiment completed in Flagsmith with another decision is refused, not shipped over", async () => {
    const { calls, port } = fm({ completeError: new FlagsmithCompletedDifferently("disable", null) });
    const { h, deps } = build(DECIDED, port);
    const r = await shipDeck(deps, { ...req, approve: true });
    assert.deepEqual([r.ok, !r.ok && r.status], [false, 409]);
    if (!r.ok) assert.match(r.error, /already completed in Flagsmith with the flag turned off/);
    assert.ok(!calls.some((c) => c.startsWith("weights")));
    assert.ok((await h.store.getShip("d1"))?.undoneAt);
  });

  it("aborts before touching weights when complete fails with a server error", async () => {
    const { calls, port } = fm({ completeStatus: 500 });
    const { h, deps } = build(DECIDED, port);
    const r = await shipDeck(deps, { ...req, approve: true });
    assert.deepEqual([r.ok, !r.ok && r.status], [false, 502]);
    assert.ok(!calls.some((c) => c.startsWith("weights")));
    // Not stuck: can be retried.
    assert.ok((await h.store.getShip("d1"))?.undoneAt);
  });

  it("demo mode simulates without Flagsmith", async () => {
    const { deps } = build(DECIDED, null);
    const r = await shipDeck(deps, { ...req, approve: true });
    assert.equal(r.ok && r.value.simulated, true);
  });

  it("undo restores the snapshot taken before shipping", async () => {
    const { calls, port } = fm();
    const { h, deps } = build(DECIDED, port);
    assert.equal((await undoDeck(deps, req)).ok, false);
    await shipDeck(deps, { ...req, approve: true });
    const u = await undoDeck(deps, req);
    assert.equal(u.ok, true);
    assert.equal(calls.at(-1), "undo");
    assert.equal(h.state.statuses.at(-1), "unshipped");
    assert.equal((await undoDeck(deps, req)).ok, false);
  });

  it("review lists chances per card, winner first", async () => {
    const { deps } = build(DECIDED, null);
    const r = await getReview(deps, "o1", "d1");
    assert.ok(r.ok);
    if (r.ok) {
      assert.equal(r.value.headline, "Headline B has a 96% chance of being best. Ship it?");
      assert.deepEqual(r.value.cards.map((c) => [c.key, c.chancePercent]), [["B", 96], ["A", 3], ["C", 1]]);
      assert.match(r.value.steps[1], /Cards A and C leave the feed\. All 26 waitlist emails stay yours\./);
    }
  });

  it("demo review sheet says why it differs from Results; real mode never shows that note", async () => {
    // The demo deps pass the note in; the numbers in it come from the fixtures: the Results page's 214 swipers and 91%.
    const { deps } = build(DECIDED, null);
    const shown = await getReview({ ...deps, demoNote: demoReviewNote }, "o1", "d1");
    assert.ok(shown.ok);
    if (shown.ok) assert.match(shown.value.demoNote ?? "", /earlier snapshot \(214 swipers, 91% chance best\)/);

    // Real mode never sets demoNote, so the view carries none.
    const { port } = fm();
    const { deps: real } = build(DECIDED, port);
    const hidden = await getReview(real, "o1", "d1");
    assert.ok(hidden.ok);
    if (hidden.ok) assert.equal(hidden.value.demoNote, undefined);

    // Only the headline demo deck gets the note.
    assert.equal(demoReviewNote({ flagName: "deck_voice-khata-price" }), undefined);
  });

  it("demo fixture is the spec decided state", () => {
    const a = assessDeck(demoDecidedResults(), "A", 256);
    assert.equal(a.decided && a.winnerKey, "B");
  });
});
