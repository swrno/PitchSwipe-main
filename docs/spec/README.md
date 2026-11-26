# PitchSwipe — Product spec and build plan

**One-liner:** A/B test your pitch before you build your landing page. Founders test 2–3 versions of one idea (one variable changed); swipers see exactly one card each (assigned by Flagsmith); the version that earns the most reward-claim emails wins; claimants become the founder's waitlist.

This folder and `docs/designs/` are the single source of truth for what we are building. Start here. (They were the `goal/` folder until the repo was tidied: `goal/spec` and `goal/designs` became `docs/spec` and `docs/designs`, and `goal/README.md` and `goal/BUILD_PLAN.md` moved into `docs/spec/`.)

## Layout
```
docs/
├── spec/                         ← product spec (v2, 15 Nov 2026), split so you load only what you need
│   ├── README.md                 ← you are here (entry point + working agreement)
│   ├── BUILD_PLAN.md             ← work packages, dependencies, acceptance checklist
│   ├── pitchswipe-product-spec.md   full spec, single file (source of truth)
│   ├── 01-product.md             overview, flow, business model, one app two roles, payouts
│   ├── 02-founder-features.md    §5.1 founder features, ship winner, download, logo test, price demand curve, ship to website
│   ├── 03-swiper-features.md     §5.2 swiper features, §5.12 standard lists, §5.14 voice comments
│   ├── 04-quality-and-trust.md   §5.4 safety, §5.8 swipe quality, §5.9 quality score (30 cards, no lockout)
│   ├── 05-insights-and-ai.md     §5.10 location/audience, §6 AI: rules, assistant, ask-your-results chat
│   ├── 06-experiment-and-architecture.md   §7 experiment, §8 stack/data model/routes, §9.4 Flagsmith API
│   ├── 07-strategy-and-research.md         market, strategy, ideas status (§10.8), risks, open questions
│   ├── 08-build-reference.md     §13 every demo number, label, list and screen name — use for fixtures
│   └── 09-sources.md
└── designs/
    ├── README.md                 ← screen index: screen → route → phone image → web image (+ canvas names)
    ├── phone/  (41 JPGs, 780×1688)
    └── web/    (36 JPGs, 2880 wide)
```

Below, `spec/NN` means `docs/spec/NN-….md`.

## How to pick up work
1. Read this file, then your package in `BUILD_PLAN.md`.
2. Read only the spec files that package lists, then open the matching images via `../designs/README.md` (look at the actual images — they carry copy, spacing and states not in the text).
3. Build against the contracts in `BUILD_PLAN.md` (types, fixtures, Flagsmith wrapper). Don't invent new field names or routes; if you must, update the spec file in the same change.
4. Tick the package's "done when" before moving on; keep commits scoped to one package.

## Non-negotiables (from the spec)
- **Hackathon scope:** MVP only. *(Pitch only)* items — deck packs, Boost, UPI payouts, billing — are static UI at most. No real money moves; earnings are **"Demo earnings"**, Rs 0.25 per valid swipe.
- **One variable per deck**; everything else locked and identical; no editing cards after the experiment starts.
- **Flagsmith decides the winner** on `reward_claim` (≥95% chance to beat control, ≥50 identities per card, no SRM warning, else "Too close to call"). The winner ships only after the founder taps **Approve and ship**. **AI writes and explains, never decides, ships or changes a flag**, and every number in its text is filled by code from real data.
- **Valid swipe** = card on screen ≥2 s (and ≥300 ms interaction floor); invalid swipes are never sent to Flagsmith. Swipers with quality score <70 are not blocked — their swipes just aren't counted or paid.
- **Privacy:** founders see aggregates only; emails shared only on explicit claim tap; groups <10 hidden; raw IP never shown; secrets server-side.
- **One responsive Next.js app** (phone bottom tabs / web sidebar), PWA-installable.

## What changed in v2 of the spec/designs (15 Nov 2026)
- **No lockout**: 200-deck practice + 24 h wait replaced by a 30-card quality check and a four-rule quality score; below 70 swipes just aren't counted or paid (20-card re-check any time).
- **No target question**: target users = swipers whose profile **role** is in the product's target-role list. Fixed lists for roles, industries, states (`spec/03` §5.12). The Answer-saved sheet has only an optional comment (typed or **voice, any language**).
- **New test types/features**: Language test (7th variable), price **demand curve** (find best price vs test framing), **Test decided → Approve and ship** assistant, ship to the founder's real website via Flagsmith snippet, **Download results**, **deck switcher**, **Ask your results** chat, AI insights as **Result vs Lead** with code-filled numbers, persona preview marked **Unproven**.
- Spec §13 is a build reference with every demo number and label.

## Known spec inconsistencies (resolved here)
- Demo earnings: spec §5 intro still says "Rs 1 per valid swipe"; the feature tables and all designs say **Rs 0.25** → use Rs 0.25.
- §10.4 scope line mentions "declare-winner flow"; v2 replaces it with the **approve-and-ship** flow (§5.1, §6.6) → build approve-and-ship.
- §8.2 `users` lists `email` twice (account email + verified flag) → model as `email` + `emailVerified`.
- §8.2 `responses` still has `isTargetUser`; compute it from the swiper's role at swipe time (`spec/03` §5.12).
- Spec §13.6 names an `AppNotify` screen that is not in the design export.
- Open question still open: link visitors vs the quality check. Default: link visitors answer without the check, tagged "Your link (not verified)", never paid.

## Demo data used across designs
Founder **Arjun Sen** · product **Voice Khata** (voice ledger, Retail; decks: Headline, Product UI, Price, Launch reward; 118 on waitlist) · **QueueLess** (clinic bookings) · **LoadMate** (return loads) · swiper **Priya Nair** (Gujarat, 25–34, shop owner) · wallet Rs 46.75. Full numbers: `spec/08-build-reference.md`.
