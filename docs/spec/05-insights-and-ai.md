# 05 · Founder insights and AI

Sections 5.10 and 6 (all AI features, rules, assistant, chat).

### 5.10 Founder Insights: Location and Audience

Founders want to know not only which version won, but **who** responded and **where**. This section covers location from IP and the other audience insights that research suggests are most useful at the pre-launch stage.

#### Location from IP

- **How:** on each swipe the server looks up the IP address in a geolocation database and stores only the estimated **state** (and city for large metros). The raw IP is used for fraud checks (section 5.9) and is not shown to founders.
- **Accuracy limits:** country is reliable, state is usually right, city often is not. Typical published accuracy is 95% to 99% at country level, 55% to 80% at state or region level and 50% to 75% at city level [51]. A 2026 benchmark against real GPS found city-level hit rates (within 50 km) of about 50% to 75% across ten providers [52]. Mobile data is worse: traffic exits through the carrier's gateway, so the IP can point to a city hundreds of kilometres away [53], and a measurement study found 53% to 61% of mobile measurements in Asia missed by more than 100 km [54]. So PitchSwipe shows **state**, labels it "approximate", and drops VPN and data-centre IPs.
- **Privacy and law:** under India's DPDP Act, IP address and location data count as personal data [55]. Processing needs a clear notice and consent, and the notice must say what is collected and why [56]. PitchSwipe states this at sign-up and on the claim screen.
- **Small groups are hidden:** a group is shown only if it has at least 10 swipers (k-anonymity style suppression). Privacy guides use minimum cell sizes for both re-identification risk and because small groups give unreliable numbers [57].

#### What else helps founders (research-backed)

| Insight | Why it matters | How PitchSwipe shows it |
|---|---|---|
| **Said yes vs acted** | Stated intent overstates real behaviour; behaviour (like leaving an email) is the stronger signal [58][59] | Side by side: share who answered positive vs share who claimed the reward |
| **Where demand is** | Tells the founder which state to start pilots in | Swipers and claim rate by state, with the top state flagged as "a lead" |
| **Target users vs everyone** | Ellis's rule of thumb is judged among "the right users", not all users [60] | Filter: only swipers whose profile role is in the product's target user list |
| **Link vs feed** | The founder's own audience can be biased | Filter by source; warning if they disagree |
| **Why people swiped** | Numbers say what, comments say why | AI themes from one-line comments, per card |
| **Price range** (Stretch) | The Van Westendorp method asks four price questions (too cheap, cheap, expensive, too expensive) to find an acceptable range [61] | Optional four questions on price decks |
| **After launch: pilot check-in** (Stretch) | A common product-market-fit benchmark is 40% or more of users saying they would be "very disappointed" without the product [60] | One-tap survey to pilot customers a few weeks after launch |

#### Audience targeting

- **Free:** targeting is included with every deck in the feed at no extra cost. Boost is separate and optional.
- **Where:** on the product settings page; every deck of the product uses it.
- **What founders pick:** target user roles (for example Shop owner, Wholesaler), who sees the decks (everyone, or target users only), states (for example Gujarat, Maharashtra) and interests (for example Retail, Finance), on the product settings page. Leaving states and interests empty means all of India and all interests.
- **How states are known:** each swiper sets their state once in their profile; the IP estimate is used only as a check. If the two disagree often, the swiper's state is marked unverified and they are not counted for state-targeted decks. This avoids relying on IP alone, which is often wrong on mobile data (see above).
- **Fair test inside the audience:** targeting only decides who is eligible. Within that audience, Flagsmith still assigns one card at random to each swiper, so the comparison between cards stays fair.
- **Reach warning:** if the audience is small, the page shows the estimated reach and a warning that reaching the minimum sample (about 50 swipers per card) may take longer.
- **Results:** targeted decks show results for the chosen audience only; personal-link swipes from outside the audience are shown separately.

#### Rules so insights do not mislead

- **Segments are leads, not results.** Slicing results by many segments makes false "wins" likely: at a 5% significance level, about one in every 20 segments checked will look significant by chance [62]. Segment views are labelled exploratory, and only the pre-set segments (target user, source, state) are shown [63].
- **Each segment needs its own sample.** A segment under the minimum is hidden or shown as "too few to tell".
- **The winner is decided only on the full experiment.** Location never changes the declared winner.

**Hackathon scope:** state from IP (with a free database), the Who swiped screen, the said-yes-vs-acted comparison and the 10-swiper minimum. Price range and pilot check-in are Pitch only.


## 6. AI Features

**Principle:** AI writes and explains. Only real behaviour, measured by Flagsmith, decides the winner.


### 6.1 Must-Have

1. **3 angles.** Turns a rough idea into three cards that differ in substance: problem-led, outcome-led and price-led. The founder edits them before publishing.
2. **Card checker.** Flags vague words, jargon, overly long pitches and near-duplicate cards.
3. **Why people swiped.** Groups one-line comments into themes for each card.
4. **Results explainer.** Turns Flagsmith results into plain words, for example "Card B leads, 91% likely best, about 40 more swipers needed". It never invents numbers.


### 6.2 Stand-Out: AI vs Humans

5. **AI pre-test ("Test with AI personas").** Before publishing, 20 simulated target-user personas per card (60 for a 3-card deck), each seeing only one card like real swipers, predict the winner and give a few one-line reactions. It is only an idea before launch: it is labelled "Simulated" and never counted with real swipes. The dashboard later shows the prediction next to the real result, for example "AI predicted B; real people chose A". Predictions are always labelled as simulated and never affect the winner.


### 6.3 Product Insights: Learning Across Decks

8. **Product insights.** A founder usually runs several decks for the same product: headline first, then price, reward, product UI. The insights page puts all of them together:
   - **Winners so far:** one line per deck with the winning version and its status (won, or still leading).
   - **What you have learned:** two or three plain-language insights that connect results across decks, for example "People buy 'get paid', not 'voice'": the winning headline and the winning product UI both talk about collecting dues.
   - **Suggested next test:** the variable not yet tested, or the open question the results raise, with a one-tap "Create" that pre-fills a new deck.
   - **Pilot customers:** the waitlist total across all decks of the product.
   - **Grounding:** each claim shows its swiper count, uses only groups of 10 or more swipers, and repeats Flagsmith's chance to win rather than computing its own.
   - **Rules:** every insight names the decks and comments it comes from. Only finished decks count as facts; running decks are shown as "leading, not decided". AI persona tests are never used. The AI does not combine winners into a claim that the combination was tested: winners from separate decks are not tested together.


### 6.4 Where AI Is Used, and Why

From running the AI Opportunity Brief and "Faster vs. New" Capability Auditor skills on PitchSwipe (15 Nov 2026).

| AI feature | Verdict | What we do |
|---|---|---|
| Cross-deck insights | AI-shaped (5 of 5 tests) | Build for the hackathon: a one-page insight plus the "Test decided: ship the winner?" prompt, both fed by Flagsmith's win probability |
| Quality score (was trust score) | Partly (failed the tolerance test while it locked people out for 24 hours) | Now four plain rules; low scores stop counting and paying instead of locking out; instant 20-card re-check; model later, run silently first |
| AI persona preview | Passes 4 of 5, but rests on an unproven claim that AI reactions match real Indian buyers | Design only; compare AI guesses with real results on the first 10 real decks before promoting it |

- **The unlock (roadmap):** a "next test" assistant that watches running experiments, says when one is decided, and drafts the next one-variable deck for the founder to approve. Later, anonymised benchmarks across founders in the same industry, once there are hundreds of decks.
- **Guardrail:** the AI never ships, stops or changes a test on its own; the founder approves every change to a flag.


### 6.5 Rules for AI Insights

Two risks drive these rules. LLMs summarising tables can hallucinate numbers, misattribute rows and invent rankings [64][65]. And every extra segment checked raises the chance of a false win: at 95% confidence, 20 segments give about one fake result by chance [63][66].

| # | Rule | Why |
|---|---|---|
| 1 | Code fills every number from Flagsmith results and our counts; the AI writes only the words around them | Numbers never come from the model [64] |
| 2 | After writing, each number in the text is checked against the source table; any mismatch hides the insight | Catches hallucinated or rounded figures [65] |
| 3 | A **Result** needs Flagsmith's 95% chance to be best, the 50-identity minimum met and no sample-ratio warning | Same bar Flagsmith uses for its rollout banner [7][67] |
| 4 | Anything from a segment (state, source, interest, target users) is a **Lead**, tagged "confirm with a test", from groups of 10 or more only | Segment splits are exploratory; confirm with a follow-up test [63][66] |
| 5 | At most two Leads per page, ranked by group size | Fewer comparisons, fewer false wins [66] |
| 6 | Each insight shows its source line: decks, swiper count, Flagsmith chance, comment count | The founder can check every claim |
| 7 | AI persona results never feed insights; the persona preview shows its track record ("right in 1 of 3 finished decks") and an Unproven tag | No evidence yet that AI reactions match real Indian buyers |


### 6.6 The Assistant: "Test Decided, Ship the Winner"

The one AI feature to build for the hackathon (section 6.4). It watches every running test, tells the founder unprompted when one is decided, and ships the winner through the same Flagsmith flag only after the founder approves.

| # | Step | What happens | Screen |
|---|---|---|---|
| 1 | Watching | Every 5 minutes (Flagsmith's refresh limit) a job calls `POST .../results/refresh/` then `GET .../results/` for each live deck. Results page shows "Assistant is watching · last check 2 min ago: 91%" | Results (phone, web) |
| 2 | Decided | Fires only when all are true: one card has a 95%+ chance to be best; every card has 50+ identities (Flagsmith's minimum); no sample-ratio warning; swipes counted only from swipers whose swipes count (section 5.9) | none |
| 3 | Alert | Unprompted: a dark "Test decided" card at the top of My decks, an in-app notification and an email: "Voice Khata headline test: B has a 96% chance of being best. 256 swipers, all checks passed. Nothing changes until you approve." Buttons: Review and ship, Later. The deck row shows "Ready to ship" | My decks with alert (phone, web) |
| 4 | Review | Sheet: chance per card (B 96%, A 3%, C 1%), experiment name, what approval does, one AI insight. Buttons: Keep testing, Approve and ship B | Test decided (phone, web) |
| 5 | Ship | On approve: `POST .../experiments/{id}/complete/`, then set the flag's variant weights to 100 for the winner and 0 for the others; log an `assistantEvents` row | none |
| 6 | Shipped | Confirmation with four ticks: experiment completed 18:42 (results frozen: B 96%, A 3%, C 1%); flag `deck_voice-khata-headline` serves B to 100%; cards A and C left the feed (the share link opens B); all 26 waitlist emails kept. "Assistant suggests next: test price with target users, now with headline B on every card" (Draft it). Buttons: Undo: switch back, Done | Shipped (phone, web) |
| 7 | Undo | Restores the previous variant weights; the experiment stays completed; logged | none |

**Rules:** the assistant never ships, stops or changes a test on its own. "Later" snoozes the alert for 24 hours. If the chance drops back under 95% before approval, the alert is withdrawn.


### 6.7 Ask Your Results: Chat with Tools and Generated UI

One chat for every question about a product's results, so AI insights are not scattered. Entry points: "Ask about results" on the product insights page (web), and an Ask screen on the phone. Suggested questions sit above the input: "What should I test next?", "Why did C lose?", "Do target users disagree with everyone else?", "Which price earns most?".

**How an answer is built**

1. The model reads the question and calls tools; each call is shown in the chat as a small line ("Looked up results by state" with `get_segments(deck=1, by="state")`).
2. Tools return numbers from MongoDB and Flagsmith; the model never computes or types a number itself.
3. The model replies with short text plus UI components that point at tool results; code fills every number (section 6.5 rules apply: Result needs 95%, segments are Leads, groups of 10+ only).
4. Each answer ends with a source line (deck, swiper count, Flagsmith chance, comment count).

**Tools (read and draft only)**

| # | Tool | Returns |
|---|---|---|
| 1 | `get_results(deck)` | Swipers, said yes, joined per card, with totals |
| 2 | `get_segments(deck, by)` | The same split by state, source, interest or target users; groups under 10 come back as "Other" |
| 3 | `get_experiment(deck)` | Flagsmith chance to be best, exposures, sample-ratio warning, last refresh time |
| 4 | `get_price_curve(deck)` | Join rate and revenue per price with ranges, chance each earns most |
| 5 | `get_comments(deck, card?, language?)` | Typed and voice comments, English translation, state and role |
| 6 | `draft_deck(product, variable, versions, audience)` | A draft deck the founder reviews; never publishes |

The chat cannot publish, ship, stop a test or change a flag. A "Review and ship" card only opens the approval sheet (section 6.6).

**Generated UI components (fixed set)**

| # | Component | Used for |
|---|---|---|
| 1 | Stat row | Totals in the order Swipers → Said yes → Joined |
| 2 | Bar list with counts | Comparisons, each row with "9 of 41" style counts |
| 3 | Demand curve | Price questions (section 5.13) |
| 4 | Comment quotes | Why people chose or rejected a card; voice notes marked and translated |
| 5 | Result or Lead card | The answer itself, with its tag and source line |
| 6 | Deck draft card | "Test this next", with Edit and Review and publish |
| 7 | Review-and-ship card | Opens the approval sheet; never ships on its own |

The model returns JSON like `{"component": "barList", "source": "get_segments#1", "highlight": "Gujarat"}`; the app renders it with the tool's numbers.

**Demo conversation (screens AppAsk, WebAsk)**

- Q: "Which state should I test price in next?" → tools `get_segments`, `get_experiment` → bar list (Gujarat 22%, 9 of 41; Maharashtra 13%, 8 of 62; West Bengal 11%, 3 of 27; Delhi 7%, 2 of 27; Uttar Pradesh 6%, 2 of 33) → Lead card ("Gujarat joins most: 22%, vs 13% next best. Only 41 swipers, so test price there before you rely on it.") → deck draft card "Price test · Gujarat · target users" with Rs 99, 199, 299, 399, Shop owner, Wholesaler, Headline B on every card.
- Q: "Why did C lose?" → tools `get_comments`, `get_results` → bar list (B 18.3%, A 11.1%, C 7.0%) → three comment quotes (one a translated Hindi voice note) → Lead card ("C lost (Flagsmith: 1% chance best); comments point to clarity, not price.").

**Hackathon scope:** build the suggested questions plus tools 1, 2, 3 and 5 and components 2, 4 and 5; free-form follow-ups are a stretch goal.


### 6.8 Stretch

6. **Next round.** Drafts a challenger card from the winner and the comments, so the founder can launch round 2 in one click.
7. **Waitlist copy.** Expands the winning card into a headline, three benefits and an FAQ.


### 6.9 Not Allowed

- Picking or overriding the winner
- Generating fake swipers or filling in missing data
- Presenting a combination of winners from separate decks as tested
- Editing cards after the experiment has started

