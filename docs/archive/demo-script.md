# Demo script: QR live swipe and 3-minute video

Status: **plan.** Source: `docs/spec/07-strategy-and-research.md` sections 10.7 and 10.8 (round 1 idea 6). Demo numbers: `docs/spec/08-build-reference.md` section 13.

## Routes used (confirmed in `src/app`)

| Purpose | Route |
|---|---|
| Landing | `/` |
| Sign-up, verify | `/signup`, `/verify` (also `/login`) |
| Swipe feed | `/swipe` |
| A deck's personal link (what the QR encodes) | `/d/[slug]`, e.g. `/d/voice-khata-headline` if the seed is used |
| My decks | `/decks` |
| New deck | `/decks/new` |
| Deck results | `/decks/[id]` |
| Who swiped | `/decks/[id]/who-swiped` |
| Ask your results | `/decks/[id]/ask` |
| Boost, plans (static, Pitch only) | `/decks/[id]/boost`, `/decks/plans` |
| Product | `/products/[id]`, `/products/new` |
| Wallet (demo earnings) | `/wallet` |
| Profile | `/profile` |
| Quality check | `/practice`, `/practice/result` |

## QR live-swipe demo (two takes)

Viewers scan a QR code, swipe the Voice Khata deck, and the results page updates on screen. Results refresh at most every 5 minutes, so the spec says to record in two takes.

Before recording:
- Seed demo data if wanted (`scripts/seed/seed.mjs`, see `docs/ARCHITECTURE.md`); never against a database you care about.
- Make the QR code point at the deck's `/d/[slug]` link on the public app URL (`NEXT_PUBLIC_APP_URL`).
- Keep the demo deck to 2 cards (risk table, spec section 11).
- Say on camera that earnings are "Demo earnings" and no real money moves.

**Take 1: before.** Show `/decks/[id]` with the numbers as they stand. Show the QR code. Viewers scan and swipe (one card each, assigned by Flagsmith).

**Take 2: after.** Wait for the refresh window (at most 5 minutes). Show `/decks/[id]` again with the new swipers and any claims. Only say numbers that are on screen.

## 3-minute video checklist

Seven beats from the spec. Timings are a suggested split of 180 s (not from the spec).

| # | Beat | Time | Screen to show |
|---|---|---|---|
| 1 | The problem | 0:00-0:20 | Slide or `/`. Gut-feel pitches, polite friends, paid panels |
| 2 | Creating a deck | 0:20-0:45 | `/decks/new`: one variable, locked fields, launch reward |
| 3 | Swiping on a phone | 0:45-1:15 | `/d/[slug]` or `/swipe` on a phone: one card, answer, claim |
| 4 | The Flagsmith flag and experiment | 1:15-1:45 | Flagsmith dashboard: flag per deck, experiment, events |
| 5 | The leaderboard, explained | 1:45-2:20 | `/decks/[id]`, `/decks/[id]/who-swiped` (aggregates only) |
| 6 | Declaring the winner | 2:20-2:45 | Assistant "Test decided", then **Approve and ship** (founder taps; AI does not decide) |
| 7 | The key takeaway | 2:45-3:00 | Dogfood result (only if real), call to action |

Checklist before recording:
- [ ] Real swipers, not simulated traffic. Say so explicitly (spec 9.7).
- [ ] The Flagsmith lifecycle shown end to end: flag, experiment, events, results, rollout.
- [ ] Every number on screen comes from real data; no number invented.
- [ ] "Demo earnings" labelled; no real money moves.
- [ ] Phone and web both shown at least once.
- [ ] Submitted by 29 Nov, 8 PM IST.
- [ ] Dogfood slide only if `docs/archive/dogfood.md` results are filled with real data.

Not built (Pitch only, show as slides at most): the business model, deck packs, Boost, UPI payouts.
