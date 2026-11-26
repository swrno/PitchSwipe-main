# 07 · Market, hackathon strategy, ideas status, risks, open questions (context)

Sections 9 (except 9.4), 10, 11, 12.

## 9. Market Research and Past Hackathons


### 9.1 Market Need

- Message and concept testing is an established paid category, including Lyssna, PickFu, Wynter and Attest. PickFu's subscription starts at $99 per month [1].
- **Opportunity:** cheap, fast pitch testing on a founder's own audience, for student and early-stage founders who will not pay research-tool prices.


### 9.1a Market Size Estimate (15 Nov 2026)

Bottom-up, from our own pricing; assumptions are ours, not measured demand.

- **Founders:** India had 2,50,046 DPIIT-recognised startups by late October 2026 [72], with a record 55,200+ recognised in FY26 alone [73]. Globally, Product Hunt saw 192,214 launches in 2026 so far, up from 82,669 in 2025 [74].
- **Value of one active paying founder per year (assumption):** about 12 decks (2 products × 6 tests) at Rs 16 to 20 per deck = about Rs 240; about half boosted with 200 swipes each at Rs 1.75 net per swipe (Rs 2 minus Rs 0.25 to the swiper) = about Rs 2,100. **Total about Rs 2,300 (about $27).**

| # | Level | Assumption | Size per year |
|---|---|---|---|
| 1 | Total market, India founders | All 2.5 lakh recognised startups × Rs 2,300 | about Rs 58 crore (about $7M) |
| 2 | Reachable, India | About half of the 55,200 new startups a year (early-stage, launching) | about Rs 6.3 crore (about $0.75M) |
| 3 | Realistic, year 2 | 2% of new startups pay: about 1,100 founders | about Rs 25 lakh (about $30k) |

- **Bigger pools:** India's research and insights industry was Rs 29,008 crore in FY2025 [75]; brands and agencies doing concept tests pay far more per test. Wynter charges $599+ per test for a B2B panel [76]. Global survey-software estimates range widely, from $4.31B (2024) [77] to $15.7B (2025) [78]; use only as a ceiling.
- **Pitch line:** start with Indian founders (access and data), expand to brands and global founders; Boost is the main revenue, deck plans a small extra.


### 9.2 Competitors

| Product | What it does | Published scale |
|---|---|---|
| PickFu | Paid consumer polls; own-audience polls free up to 50 responses | 15M+ panel respondents; from $99/month [1][10] |
| Lyssna | Preference and five-second tests | 320,000+ users (own claim) [11] |
| Wynter | B2B message testing | 86,000+ verified B2B panel; customers include HubSpot, Notion, Atlassian [12] |
| ValidateSwipe | Swipe on pitches; validators earn credits | 3 Product Hunt followers [2] |
| NextUnicorn | Swipe on AI-generated SaaS ideas | 4 Product Hunt followers [3] |
| StartupSwipe / Swipy | Swipe on startups | 11 / 23 Product Hunt followers [3] |
| GoDaddy Flare (2016) | Swipe feedback on ideas | Not continued [4] |

**Takeaway:** paid research tools have real scale, while swipe apps have almost none. Swiping alone is not valuable, so PitchSwipe is positioned as pitch testing that ends with a winning pitch and a real waitlist. The gap: panel tools are paid and use strangers, and free own-audience polls are capped and are not randomized A/B tests.


### 9.3 Why Email Sign-ups Decide the Winner

- What people say they like often differs from what they do. One vendor estimates that stated-preference research predicts real purchases with about 34% accuracy (vendor figure) [5].
- A swipe is a stated preference. An email sign-up costs the user something, so it is a stronger signal.


### 9.5 Past Hackathons by Flagsmith and Similar Companies

| Hackathon | Host | Format | Winning projects | Source |
|---|---|---|---|---|
| Hack the Flag (Jan to Mar 2025) | Flagsmith, on HackQuest | Online, 241+ participants, $1,000 for top 3. Judged on innovation 25%, functionality 25%, technical excellence 20%, UX 15%, theme relevance 10%, presentation 5% | Winners not published | [15] |
| Lisbon offsite hackathon (2026) | Flagsmith (internal) | Teams of 4; themes: enterprise, developer pains, quick iteration and experimentation | Three features; details not published. Values stated: ship behind flags and validate with real data | [16] |
| DevCycle Feature Flag Challenge (Dec 2024) | DevCycle on DEV, $1,000 | Online | 1. Cycle Doodle: shared doodling game using a wide range of DevCycle features. 2. DevCycle Commerce: live sale app; judges praised its dashboard and simulation pane. 3. Zero-downtime PostgreSQL migration using flags: a real problem | [17] |
| Moonshots (internal, recurring) | LaunchDarkly | Internal hack days | Flags controlling Arduino LED lights, flag cloning, SDK test dashboard; in 2025, agent workflows that clean up stale flags and scaffold SDK code | [18][19] |
| The Hangover Part AI (Jun to Jul 2026) | Cognee via WeMakeDevs | 8,500 participants, 1,200+ projects | Lethe (solo, one week): product built around a benchmarked finding, with blind-judged evidence. Classroom Memory: real Cloud API calls plus a script that verifies the live lifecycle. Best blog: RealtyRecall | [13][20] |


### 9.6 Patterns in Winning Projects

1. **Deep use of the sponsor's product.** Cycle Doodle won for using many DevCycle features, not one.
2. **A real, concrete problem.** The zero-downtime migration won as a creative solution to a real-world problem.
3. **A visible dashboard.** DevCycle Commerce's dashboard and simulation pane stood out to judges.
4. **A measured finding at the centre.** Lethe built its product around a benchmark result and backed claims with evidence.
5. **Proof it works.** Classroom Memory included a script that verifies the live API lifecycle.
6. **Flagsmith's own values:** ship behind flags and validate with real data.

**Applied to PitchSwipe:**

- Use flags, identities, events, metrics, experiments, the Admin API and the winner rollout, end to end.
- Make the live leaderboard and event feed the visual centre of the demo.
- Lead the pitch with the dogfood result and the "AI vs Humans" finding.
- Ship a README with a script that verifies the Flagsmith lifecycle (create, start, read results, roll out).
- Publish a short blog post about the build for extra visibility.


### 9.7 A Known Competing Entry

A public GitHub repo, RouteSmith, already labels itself a "Flagsmith Hackathon Winner Candidate" for Track 01 [21].

- **What it is:** an AI docs assistant that A/B tests three RAG pipelines behind one multivariate flag, with one-click rollout via the Admin API.
- **How it gets data:** a synthetic swarm of about 1,500 simulated developer identities, run to avoid "sample starvation".
- **What it means for PitchSwipe:**
  - The AI docs-assistant idea is already taken, which confirms the pivot away from AskFlag.
  - Expect several entries to use simulated traffic. Track 01 asks for a metric from real events, so **real swipers are PitchSwipe's clearest advantage**. Say this explicitly in the video.


## 10. Hackathon Strategy


### 10.1 Judging Criteria

General scorecard: Use of Flagsmith, Impact, Creativity, Demo video. Track 01 checklist: a clear question, versions behind a flag, a metric from real events, and results you can explain [9].


### 10.2 Self-Assessed Scorecard

| Criterion | Score | Note |
|---|---|---|
| Use of Flagsmith | 8/10 | Flag, experiment and rollout per deck via API |
| Impact | 6/10 | Real need; depends on founders having an audience |
| Creativity | 5 to 7/10 | "Tinder for X" is a cliché; one-card randomization and the target-user split lift it |
| Track 01 checklist | 7/10 | Strong only with about 150+ real swipers |
| Demo | 9/10 | Swiping on a phone shows well on video |


### 10.3 Chances of Winning (Estimate)

- Past WeMakeDevs hackathons: Cognee had 8,500 participants and 1,200+ projects; Hack All February had 20,000+ participants and 1,500+ submissions across four events [13][14].
- Assuming a few thousand registrants and roughly 150 to 500 submissions across three tracks, about 50 to 200 entries compete for the single Track 01 prize.
- Base rate for a random entry: about 0.5% to 2%.
- Most entries will not run a real experiment with real users.
- **If executed well:** about 10% to 20% chance to win Track 01, and 30% to 50% to finish in the top 10. Without real traffic, the chance falls to near the base rate.
- **Biggest levers:** real users from day 1, Flagsmith used end to end, and a clear three-minute video.


### 10.4 Scope

- **Build:** one app with sign-in, swipe feed, deck creator with one-variable rule and reward, share link, results with CSV download, declare-winner flow, demo earnings wallet, AI features 1 to 4.
- **Pitch only (designs and slides, not built):** the business model, deck packs, Boost and UPI payouts.
- **Skip:** image moderation beyond size limits.


### 10.5 Traffic Plan

1. **Dogfood deck:** three ways to pitch PitchSwipe itself, shared with hackathon participants on day 1. Target: 150+ swipers.
2. **Other teams as founders:** participants create decks for their own projects and bring their own swipers.
3. **Growth loop:** every thank-you screen invites the swiper to make their own deck.


### 10.6 Timeline

| Date | Deliverable |
|---|---|
| 26 Nov | Swipe page and dogfood experiment live |
| 27 Nov | Deck creator, dashboard, AI features 1 to 4 |
| 28 Nov | Results, winner flow, AI vs Humans (if time), push traffic |
| 29 Nov | Roll out winner, record video, submit by 8 PM IST |


### 10.7 Demo Video (3 Minutes)

1. The problem
2. Creating a deck
3. Swiping on a phone
4. The Flagsmith flag and experiment
5. The leaderboard, explained
6. Declaring the winner
7. The key takeaway


### 10.8 Innovation Ideas and Status (15 Nov 2026)

Status: **Build** = in the hackathon build · **Demo** = used in the video or presentation, not a product feature · **Proposed** = suggested, not yet decided · **Roadmap** = pitch slide only. "Screens" says whether designs exist yet.

#### Round 1 ideas (decided)

| # | Idea | Status | What to build or do | Screens |
|---|---|---|---|---|
| 1 | **PitchSwipe tests itself** | Demo | Run one real Flagsmith experiment on PitchSwipe's own swipe screen during the event, for example two reward-button wordings ("Claim 3 months free" vs "Get early access"). Flag `ps_reward_button_copy`, metric `reward_claimed`. Show its live result while presenting as the validation example | Not needed |
| 2 | **Language as a test type** | Build | Seventh test type "Language": the same card in English, Hindi and Bengali (for example B: "Stop chasing payments. Get paid on time." / "पेमेंट के पीछे भागना बंद करें। समय पर पैसा पाएं।" / "টাকার পেছনে ছোটা বন্ধ করুন। সময়মতো টাকা পান।"). One flag, three variants; everything else locked. Translations drafted by AI, edited by the founder. The whole card is translated (headline, description, reward, question, answers); price and product UI stay the same. Tip shown: target states where people read these languages | Done: FounderLanguage, WebCreateLanguage, MainHindi |
| 3 | **Founder's guess vs reality** | Build | Before publishing, the founder picks the version they expect to win and writes one line why. Saved as the Flagsmith experiment's hypothesis (`PATCH .../experiments/{id}/` edits name or hypothesis). Results show "You guessed A · AI predicted A · People prefer B" | Not yet |
| 4 | **Say vs do gap as a headline metric** | Build | On results: "46% said yes, 12% left an email: 34 points said yes but did not act." Uses existing numbers (214 swipers, 98 said yes, 26 joined) | Not yet |
| 5 | **Flags doing real work beyond the test** | Build | Platform flags: `paid_swiping` (kill switch: turn off all payouts if fake swipes spike), `boost_enabled`, `language_cards`, `assistant_ship` (gradual rollout to founders), remote-config value `check_card_rate` (1 in 20). Shown in the presentation as "flags that run PitchSwipe" | Not yet |
| 6 | **Live swiping in the demo video** | Demo | During recording, viewers scan a QR code, swipe the Voice Khata deck, and the results page updates on screen (refresh at most every 5 minutes, so record in two takes) | Not needed |
| 7 | **WhatsApp share card** | Build | The personal link unfurls as a preview card: title "Would you pay Rs 299 a month? · Voice Khata", text "Swipe yes or no in 10 seconds. Arjun wants your honest take.", image of card B. Open Graph tags on `/d/[slug]` plus a "Share on WhatsApp" button | Not yet |

#### Round 2 ideas (higher impact, not yet decided)

| # | Idea | Status | Why it matters | Effort |
|---|---|---|---|---|
| 1 | **Ship the winner to the founder's real website** | Build (decided 15 Nov 2026); screens done: WebConnectSite, WebSiteShipped, ship and shipped sheets; see section 5.15 | Each deck's flag holds the actual headline, price or logo; the founder pastes a Flagsmith snippet into their landing page, so "Approve and ship" changes their live site. Deepest Flagsmith use; strongest demo moment | Medium |
| 2 | **Confirm-a-lead test** | Proposed (recommended) | Every Lead insight gets "Confirm with a test": a new deck shown only to that group via a Flagsmith segment (state, role, interest traits). Fixes false wins from segment splits | Low to medium |
| 3 | **Does PitchSwipe predict real sales?** | Proposed | After shipping, the same flag A/B tests the founder's real site; PitchSwipe shows whether the swipe winner also won there, building its own accuracy record | Medium, needs #1 |
| 4 | **Willingness-to-pay curve** | Build (decided 15 Nov 2026); screens done: AppPriceResults, WebPriceResults; price form updated | Price decks with 3 to 4 prices show joins at each price and the revenue-maximising price; see section 5.13 | Low |
| 5 | **Answer by voice note** | Build (decided 15 Nov 2026); screens done: AppDone, AppVoiceNote, WebDone, WebResults comments; see section 5.14 | Short voice comments in any Indian language, transcribed into the comments insights read | Medium |
| 6 | **Waitlist to first pilot** | Proposed | One tap sends the winning pitch to the waitlist by WhatsApp or email; replies and booked calls tracked as the strongest proof of demand | Low to medium |
| 7 | **Public library of what wins** | Roadmap | Anonymised, opt-in gallery of finished tests; builds cross-founder benchmarks | Design only |

#### Round 3 ideas

| # | Idea | Status | Notes |
|---|---|---|---|
| 1 | **Ask your results: chat with tools and generated UI** | Build (decided 15 Nov 2026); screens done: AppAsk, WebAsk | Replaces scattered insight text with one chat that uses fixed tools and components; see section 6.7 |

#### Earlier decisions from the AI skills (for reference)

| # | Item | Status |
|---|---|---|
| 1 | Assistant: "Test decided, ship the winner" (section 6.6) | Build; screens done |
| 2 | Quality score with four rules, no lockout (section 5.9) | Build; screens done |
| 3 | AI insights labelled Result or Lead, numbers filled by code (section 6.5) | Build; screens done |
| 4 | Persona preview marked Unproven (section 6.4) | Design only; screens done |


## 11. Risks

| Risk | Mitigation |
|---|---|
| Too few swipers | Share the dogfood deck early; keep the demo deck to 2 cards; ask other teams to swap swipes |
| Paid swipers swipe carelessly | See section 5.8: dwell time, check cards, repeat cards, trust score, source comparison |
| Payouts need KYC, a payment provider and tax handling | Not built in the hackathon; shown as the business model in the presentation |
| Reward promises not honoured by founders | Founder accepts terms; reward text shown with founder name; reports and removal |
| Judges question paid data | No real money moves in the hackathon; earnings are demo only and labelled so. Say this in the video |
| Experiment API unavailable on the free or beta plan | Confirm in the Flagsmith Discord; fallback: create experiments manually |
| "Tinder for X" cliché (ValidateSwipe, NextUnicorn) | Position as pitch testing, not idea swiping |


## 12. Open Questions

- **Practice set length (decided 15 Nov 2026).** Cut to 30 cards (about 3 minutes) plus check cards inside the real feed; see section 5.9.
- **Personal-link visitors.** If link visitors must first do the 30-card practice, a founder's own audience (and the hackathon demo traffic) will mostly never reach the deck. Option: let link visitors answer the founder's deck without the test, but count them separately as "Your link (not verified)" and never pay them.

- Are the placeholder prices (Rs 200 for 10 decks, Rs 1,600 for 100 decks, Rs 2 per boosted swipe with Rs 0.25 to the swiper) right for Indian student and early founders?
- Should swipers earn cash, or app credit first to avoid payout compliance at launch?

- Is coding allowed before 26 November?
- Can one project enter more than one track?

