# 06 · Experiment design, architecture, Flagsmith API fit

Sections 7, 8 and 9.4 (Flagsmith API details for ship-the-winner).

## 7. Experiment Design

| Item | Value |
|---|---|
| Flag | `deck_<id>`: multivariate, one variant per card |
| Unit | Swiper ID `<deckId>:<guid>` |
| Assignment | Flagsmith assigns each swiper one card; they never see the other versions of that deck |
| Variable under test | Exactly one: headline, description, reward, price, product UI or logo. All other fields identical across variants |
| Primary metric | `reward_claim` (Occurrence, higher is better): email submitted to claim the launch reward |
| Secondary metric | `answer_positive` (Occurrence, higher is better): positive answer to the swipe question on the assigned card |
| Maximum cards | 3 (each needs at least 50 swipers) |
| Winner rule | At least 95% chance to beat control and no SRM warning; otherwise "Too close to call" |
| Excluded | Invalid paid swipes (under 2 seconds, failed checks) are never sent to Flagsmith |
| Source split | Each identity carries a trait `source` (feed or link) so results can be filtered |

### Deck Lifecycle

1. The founder publishes a deck.
2. The backend creates the flag and experiment through the Flagsmith Admin API, then starts it.
3. Swipers are enrolled and events are recorded.
4. The dashboard reads results from Flagsmith.
5. At a 95% chance to win, the app shows **Test decided: ship the winner?** The founder approves, and the backend ends the experiment and sets the flag to serve the winning card to 100% of visitors, through the Flagsmith Admin API. Nothing ships without that approval.
6. The share link shows only the winning card and keeps adding to the waitlist.
7. When the deck closes, the flag is archived.


## 8. Technical Architecture


### 8.1 Stack

| Layer | Choice |
|---|---|
| App | One responsive Next.js app (App Router, TypeScript) on Vercel for phone and web; installable as a PWA (web app manifest and service worker) |
| UI | shadcn/ui and Tailwind; Framer Motion for swipe gestures |
| Database | MongoDB Atlas (free tier) via Mongoose |
| Flags and experiments | `@flagsmith/flagsmith` 12.4.0 or later in a client component (`enableEvents: true`, `useExperiment`, `trackEvent`, `flushEvents` on unload) |
| Flagsmith setup | Admin API called from server actions and route handlers |
| AI | LLM API for drafting, checking and summaries |


### 8.2 Data Model (MongoDB)

| Collection | Fields |
|---|---|
| `users` | `_id`, `name`, `email`, `email` (verified once), `roles` (swiper, founder), `role` (one value from the standard role list, self-declared), `state` (self-declared, checked against IP), `interests` (values from the standard industry list), `qualityScore` (0 to 100), `counting` (true when 70+), `checkReasons[]`, `createdAt` |
| `products` | `_id`, `ownerId`, `name`, `icon`, `category` (line text plus one industry), `showOwnerName`, `targetUsers` (roles; shown as "Made for"), `audience` (who: everyone or targetOnly, states, interests), `deckIds`, `insights` (text, sourceDeckIds, generatedAt) |
| `decks` | `_id`, `ownerId`, `productId`, `slug`, `variable` (headline, description, reward, price, productUI, logo, language), `priceMode` (level, framing; price decks only), `shared` (all locked fields), `question`, `positiveLabel`, `negativeLabel`, `flagName`, `experimentId`, `status` (draft, live, decided, shipped, closed), `decidedAt`, `shippedAt`, `shippedBy`, `winnerCardId`, `listedInFeed`, `boost` (`perSwipe`, `budget`, `spent`) |
| `cards` | `deckId`, `variantKey`, `value` (only the field under test) |
| `responses` | `deckId`, `swiperId`, `source` (feed, link), `cardId` (the one card Flagsmith assigned), `isTargetUser`, `answer` (positive, negative), `dwellMs`, `region` (state estimated from IP; raw IP kept only for fraud checks), `valid`, `comment`, `createdAt` |
| `claims` | `deckId`, `cardId`, `email`, `createdAt` |
| `sites` | `productId`, `domain`, `lastSeenAt`, `elements[]` (`flagName`, `currentValue`) |
| `assistantEvents` | `deckId`, `type` (checked, decided, approved, shipped, undone), `chanceBest` per card, `swipers`, `checksPassed`, `createdAt` |
| `wallets` (demo earnings in the hackathon) | `userId`, `balance`, `entries[]` (`deckId`, `amount`, `swipeCount`, `createdAt`) |
| `credits` (after hackathon) | `ownerId`, `decksLeft`, `purchases[]` |


### 8.3 Routes

| Route | Purpose |
|---|---|
| `/signup`, `/verify` | Profile creation and one-time email verification |
| `/practice`, `/practice/result` | 30 practice cards; quality score result (swipes counting, or not counted yet with a 20-card re-check) |
| `/swipe` | Swipe feed: live decks in random order, each deck once per swiper |
| `/d/[slug]` | Personal share link: opens the swipe feed with this deck first, then the random feed |
| `/wallet` | Demo earnings in the hackathon; withdrawals later |
| `/decks` | My decks, grouped by product, with status filters |
| `/products/new`, `/products/[id]/insights` | Create a product; AI insights across its decks |
| `/decks/new`, `/decks/[id]` | Deck creation inside a product, results, share and boost |
| `/billing` | Deck packs and boost budgets (after hackathon) |
| `/api/decks` | Create and update decks |
| `/api/responses` | Record swipes and comments |
| `/api/claims` | Record reward claims (one tap; sends the verified email) |
| `/api/practice` | Record practice swipes and compute the quality score with the four rules |
| `/api/wallet` | Demo earnings in the hackathon; withdrawal requests later |
| `/api/results/[deckId]` | Cached Flagsmith results, refreshed at most every 5 minutes |
| `/api/decks/[id]/ship` | After the founder approves: ends the Flagsmith experiment and sets the flag to serve the winning card to 100% |
| `/api/export` | Builds the chosen downloads (PDF report, Excel or CSV summary, per-swipe CSV, waitlist CSV) for a deck or a product; returns one file or a .zip |


### 8.4 Security

Secrets (Flagsmith Admin API key, MongoDB URI, LLM key) stay server-side. The swipe page receives only the client-side Flagsmith environment key.


### 9.4 Flagsmith Fit (Verified in Docs)

- The Admin API can create, start and read experiments. The MCP server cannot start them [6].
- A variation shows "Collecting data" until it has at least 50 identities or 5 conversions. Rollout is recommended at a 95% chance to beat control [7].
- The free plan includes 100k users in experiments (added October 2026) [8].
- **Ship-winner flow is buildable with the API (checked 15 Nov 2026):** start with `POST /api/v1/environments/{env}/experiments/{id}/start/` (this locks the flag); read results with `GET .../experiments/{id}/results/` and refresh with `POST .../results/refresh/` at most every 5 minutes [68]. End the run with `POST .../experiments/{id}/complete/`, listed in the API reference as "Complete an experiment" [69]; the docs say ending freezes results and unlocks the flag [67]. Then roll out the winner by updating the flag so everyone gets the winning variation [67], for example by setting the environment default's variant weights to 100 for the winner and 0 for the others; the variants list must include every variant, even at weight 0 [70].
- **Caveats:** the newer flag-update endpoints are marked experimental and do not work while change requests are enabled [70]; the complete endpoint was found in the API reference, not in the how-to docs, so test it on day 1. Experimentation is an Enterprise beta and needs a connected warehouse [6][71].

