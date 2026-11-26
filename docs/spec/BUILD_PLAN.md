# Build plan — work packages for parallel agents

Rules of engagement: `README.md`. Each package lists **scope, depends-on, spec, designs, done-when**. Packages with no shared dependency run in parallel. Never build *(Pitch only)* beyond static UI. Status tags (Build / Demo / Proposed / Roadmap) come from `spec/07-…` §10.8: **build only "Build"**; Proposed items are optional extras after everything else.

Paths: `spec/NN` means `docs/spec/NN-….md` (this folder) and `designs/` means `docs/designs/`.

## Contracts (WP0 produces; everyone consumes)
- **Types** in `src/types/` mirror the data model in `spec/06-…` (note new fields: `decks.variable` incl. `language`, `priceMode`, statuses `draft|live|decided|shipped|closed`, `products.targetUsers/audience.who`, `users.role/qualityScore/counting`, `sites`, `assistantEvents`, `responses.commentVoice`). Don't rename.
- **Standard lists** (roles, industries, states) in one module `src/lib/lists.ts` from `spec/03` §5.12 / `spec/08` §13.5. No free text anywhere.
- **Fixtures** `src/fixtures/` from `spec/08-build-reference.md` (exact numbers/labels).
- **Flagsmith wrapper** `src/lib/flagsmith/` — the only module that talks to Flagsmith (admin + client).
- **Results/insight rules** in `src/lib/results/`: Result needs 95% + ≥50 identities + no SRM; segments are Leads; groups <10 → "Other". Shared by UI, export, assistant and chat.
- **Env** in `.env.example`: `MONGODB_URI`, `FLAGSMITH_ADMIN_API_KEY`, org/project/env ids, `NEXT_PUBLIC_FLAGSMITH_ENV_KEY`, `LLM_API_KEY`, `SARVAM_API_KEY` (voice). Never commit secrets.

## WP0 — Foundation (blocks all)
Next.js App Router + TS + Tailwind + shadcn/ui + Framer Motion, Mongoose models, PWA manifest, app shell (bottom tabs phone / sidebar web), tokens from designs, lists, fixtures, types.
**Done when:** shell renders with 4 nav items on both layouts; models compile.

## WP1 — Auth, profile, email verify  (spec 03 §5.12, §5.2; designs S1, S2)
`/signup`, `/verify`; role (one) + interests + state from standard lists; role editable, each swipe stores role at that time.

## WP2 — Quality check & score  (spec 04 §5.9; designs S3, S4)
30-card practice, four plain rules (reading time <2 s, straight-lining, repeat cards, check cards), score 0–100, ≥70 "Swipes counting", <70 "Not counted yet" (keeps swiping, not counted/paid, **20-card re-check any time**). No lockout, no ML. `/practice`, `/practice/result`, `/api/practice`.
Depends: WP1.

## WP3 — Swipe feed & card  (spec 03, 04; designs S5, S6, S6b, S6c)  **critical path**
`/swipe`, `/d/[slug]` (+ Open Graph tags for WhatsApp unfurl), random order, each deck once, 2 s answer-button lock, 300 ms floor, paid/unpaid banner, `source` tag, state from IP, "Made for" roles, counted/not-counted flag on responses, language-variant rendering, `/api/responses`.
Depends: WP0; WP6 (stub until ready).

## WP4 — Claim, answer-saved, voice comment, wallet  (spec 03 §5.14; designs S7, S8, S8b, S9)
Claim sheet/dialog, `/api/claims`, answer-saved sheet (optional comment; **no target question**), voice note ≤30 s: record → Sarvam STT + English translation → review → store text+translation, audio only with consent, delete after 30 d. Demo wallet Rs 0.25/valid counted swipe, withdraw disabled.
Depends: WP3.

## WP5 — Founder: products & decks  (spec 02 §5.1; designs F1, F2, F3, F4*)
My decks (status incl. "Ready to ship"), product settings (target-user roles, who/states/interests, reach), deck plans (static), New deck for **seven** variables, price modes (find best price 2–4 / test framing), language versions (AI-drafted), locked-fields enforcement, drafts, live preview.
Depends: WP0.

## WP6 — Flagsmith experiment engine  (spec 06; spec 02 §5.13/5.15)  **critical path**
Create flag `deck_<id>` + experiment, start; identity `<deckId>:<guid>` with `source` trait; events `reward_claim`, `answer_positive`; results fetch (`POST …/results/refresh/` then `GET …/results/`, ≤ every 5 min) with SRM + 95% rule; **complete** experiment (`POST …/experiments/{id}/complete/` — verify on day 1) and set flag weights to 100/0; undo restores previous weights; archive. Include README script verifying the lifecycle (create → start → read → complete → roll out → undo).
Platform flags: `paid_swiping`, `boost_enabled`, `language_cards`, `assistant_ship`, remote config `check_card_rate`.
Depends: WP0.

## WP7 — Results, who swiped, deck switcher  (spec 02, 05; designs F7, F10, F10b)
Leaderboard + filters (everyone / target / link), waitlist + CSV, four Who-swiped tabs (≥10 rule, Lead tags, said-yes-vs-acted headline "x points said yes but did not act"), deck switcher dropdown on every deck-level page, `/api/results/[deckId]`.
Depends: WP6, WP3.

## WP8 — Assistant: Test decided → approve & ship  (spec 05 §6.6; designs F1b, F9, F9b)
5-minute watcher job; "decided" rule (95%, ≥50 identities each, no SRM, counted swipes only); alert on My decks + in-app notification + email; review sheet; `/api/decks/[id]/ship` (complete experiment, weights 100/0, `assistantEvents` log); shipped confirmation; undo; snooze 24 h; withdraw alert if chance drops. **Never ships without founder approval.**
Depends: WP6, WP7.

## WP9 — Ship to founder's website  (spec 02 §5.15; designs F2b, F9c)
Snippet generator, `sites` collection + ping endpoint, element detection, connection status, before/after view, undo. Demo site `voice-khata.vercel.app` built for the video.
Depends: WP6, WP8.

## WP10 — Price demand curve  (spec 02 §5.13; designs F7b)
Beta posterior join rate with 90% range, revenue/100 swipers, Monte-Carlo (200k draws) chance each price earns most, 95% Result vs Lead, two charts + table. Test with the demo table in `spec/08`.
Depends: WP6, WP7.

## WP11 — Download / export  (spec 02 §5.1 "Download results"; designs F8)
`/api/export`: PDF report, summary table (xlsx/csv), every-swipe CSV (no names/emails/IPs), waitlist CSV; deck or product scope; zip or email; groups <10 → "Other"; timestamp.
Depends: WP7.

## WP12 — AI services  (spec 05 §6)
LLM endpoints: 3 angles, card checker (+ same size/shape/screens checks), language drafts, why-people-swiped themes (typed + translated voice), results explainer, persona pre-test (Simulated + Unproven + track record), product insights. **Rule engine from §6.5: code fills numbers, post-check every number against the source table, Result vs Lead tags, ≤2 Leads/page, source line.**
Depends: WP5 for UI hooks; services can start immediately.

## WP13 — Ask your results (chat with tools + generated UI)  (spec 05 §6.7; designs F12)
Tools 1, 2, 3, 5 (+ `draft_deck` optional), components bar list / comment quotes / Result-or-Lead card (others stretch), suggested questions; JSON component spec rendered by the app with tool numbers. Read and draft only — can't publish/ship.
Depends: WP7, WP12.

## WP14 — Sharing & audience UI  (spec 02; design F6)
Personal link, QR, WhatsApp/LinkedIn text, audience targeting with reach + small-audience warning (free); Boost static (Pitch only).
Depends: WP5.

## WP15 — Product insights page  (spec 05 §6.3; design F11)
Depends: WP7, WP12.

## WP16 — Marketing landing (M1) — independent
## WP17 — Dogfood + demo seed + README + blog  (spec 07) — last
"PitchSwipe tests itself" experiment (`ps_reward_button_copy`, metric `reward_claimed`), seed data from `spec/08`, QR live-swipe demo (two takes), 3-minute video checklist.

## Optional (status Proposed — only after the above)
Confirm-a-lead test via Flagsmith segments · Does PitchSwipe predict real sales · Waitlist→first pilot · Founder's-guess-vs-reality hypothesis (marked *Build* in spec §10.8 round 1 #3, screens not yet designed) · WhatsApp share card (round 1 #7, no screen).

## Parallel waves
1. **WP0**
2. **WP1, WP5, WP6, WP12-services, WP16** in parallel
3. **WP2, WP3, WP14**
4. **WP4, WP7**
5. **WP8, WP10, WP11, WP13, WP15**
6. **WP9, WP17**

## Global acceptance checklist
- [ ] One variable per deck (7 types) enforced server-side; cards immutable after publish.
- [ ] Each swiper sees exactly one card per deck; assignment by Flagsmith.
- [ ] Winner only via Flagsmith (≥95%, ≥50 identities, no SRM), shipped only after founder approval; AI never picks/ships/changes a flag.
- [ ] Invalid (<2 s) and not-counted swipes never reach Flagsmith / are not paid.
- [ ] Every number in AI text comes from code and is verified against source data; segments tagged Lead; groups <10 → "Other".
- [ ] "Simulated/Unproven" AI results never counted; "Demo earnings" labelled; no real money moves.
- [ ] Nothing is free text for roles/industries/states.
- [ ] No lockout: low quality score only stops counting/paying.
- [ ] Phone and web layouts match `../designs/` (`docs/designs/`).
- [ ] Secrets server-side only; Flagsmith client key is the only key in the snippet/browser.
