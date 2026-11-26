# PitchSwipe: Product Specification

> A/B test your pitch before you build your landing page.

| | |
|---|---|
| **Hackathon** | Toggle Wars: The Flagsmith Experimentation Hackathon (WeMakeDevs) |
| **Track** | Track 01: Test Something Real ($2,000) |
| **Dates** | 26 Nov 2026, 8 AM IST to 29 Nov 2026, 8 PM IST (online) |
| **Stack** | Next.js, shadcn/ui, MongoDB, Flagsmith |

## Table of Contents

1. [Overview](#1-overview)
2. [Problem](#2-problem)
3. [How It Works](#3-how-it-works)
4. [What Makes It Different](#4-what-makes-it-different)
5. [Product Features](#5-product-features)
6. [AI Features](#6-ai-features)
7. [Experiment Design](#7-experiment-design)
8. [Technical Architecture](#8-technical-architecture)
9. [Market Research and Past Hackathons](#9-market-research-and-past-hackathons)
10. [Hackathon Strategy](#10-hackathon-strategy)
11. [Risks](#11-risks)
12. [Open Questions](#12-open-questions)
13. [Build Reference for Vibe Coding](#13-build-reference-for-vibe-coding)
14. [Sources](#14-sources)

---

## 1. Overview

PitchSwipe is one app with two sides. **Founders** test two or three versions of a pitch for one idea, changing exactly one thing between them. **Swipers** swipe through pitch cards in a feed and earn money for each valid swipe. Flagsmith runs a randomized experiment behind every deck, and the founder gets a leaderboard showing which version makes people claim the founder's launch reward. The people who claim the reward form a waitlist: the founder's first pilot customers. The winning version then becomes a live waitlist page.

## 2. Problem

- Founders choose their headline, positioning and price by gut feel, then build a landing page around that guess.
- Asking friends "which sounds better?" produces polite, biased answers.
- Paid research tools such as PickFu and Wynter use strangers from a panel and charge per test.
- Simple polls are biased by order: the first option shown gets fresher, more generous reactions.

## 3. How It Works

1. The founder creates a deck: they pick the **one thing to test** (headline, description, reward, price, product UI or logo) and write 2 to 3 versions of it. Everything else is locked and identical on every card.
2. The founder sets a **launch reward**, such as "Get 3 months free at launch", which replaces the generic "Notify me" button.
3. The deck reaches swipers two ways: the founder's personal share link, and the in-app swipe feed. The link opens the feed with that deck first (Flagsmith still picks which card the person sees); after that one swipe, the feed continues in random order. **Boosted** decks get a higher chance of being picked in the random feed, and pay swipers per swipe. The order stays random, so no deck jumps the queue.
4. Each swiper goes straight to the card: there is no intro screen. They see **one card**, chosen by Flagsmith, and answer the founder's **swipe question**, such as "Would you pay Rs 299 a month for this?", by picking the founder's positive or negative answer. A positive answer offers the reward in exchange for an email.
5. The founder sees a leaderboard. Every reward claim joins the deck's **waitlist**: one email list across all cards. When a winner is declared, the share link shows only the winning card and keeps adding to the same waitlist.

## 4. What Makes It Different

- **A fair test, not a poll.** Flagsmith randomly assigns each swiper one card, and that is the only version of the deck they ever see. Every reaction is clean: no comparing, no order bias.
- **Real behaviour, not likes.** The winner is decided by email sign-ups. Swipes are a secondary signal.
- **The right audience.** Results are split into target users and everyone else.
- **One variable per test.** Only the element the founder chose to test differs between cards, so the result says exactly what made the difference.
- **Built-in audience.** Founders without an audience can boost a deck into the feed, where swipers are paid for valid swipes.
- **A useful end result.** The reward claims are the waitlist. The founder leaves with the winning pitch and their first pilot customers: real people who asked for the reward.

## 5. Product Features

All features are in the hackathon MVP unless marked **(Stretch)** or **(Pitch only)**. **Pitch only** means the feature is designed and costed, and is shown in the presentation and designs as the business model, but is not built during the hackathon. Everything involving real money is Pitch only: deck packs, Boost and payouts. During the hackathon no real money moves, but the app shows **demo earnings**: each valid swipe adds Rs 1 to a demo wallet, labelled "Demo earnings", so judges can see the swiper side working.

### 5.1 For Founders

| Feature | Description |
|---|---|
| Deck creation | 2 to 3 cards per deck: icon, name, category, headline, description, target user, price, product UI (images of the product's screens, uploaded by the founder), reward |
| One variable per test | Founder picks the single element to test: headline, description, reward, price, product UI or logo. All other fields are locked and shared across cards |
| Swipe question | Founder writes the question shown under every card and its two answers, one positive and one negative (for example "Would you pay Rs 299 a month for this?": "Yes, I would pay" / "No, I would not"). Swipe right picks the positive answer, swipe left the negative. Same on all cards |
| Founder name | Founder chooses to show their name or post anonymously. Anonymous decks show "the founder of <product>" on cards and on the reward screen. PitchSwipe still knows the founder's verified account, so the reward stays their promise. Same on all cards |
| Launch reward | Founder writes the reward shown on the card button, for example "Get 3 months free at launch" or "Get Rs 500 credit at launch". Same on all cards unless the reward is what is being tested |
| Deck packs **(Pitch only)** | Free: 1 live deck, shared by link only. Deck pack: Rs 200 for 10 decks; Big pack: Rs 1,600 for 100 decks; both listed in the swipe feed |
| Boost **(Pitch only)** | Pay per swipe to raise the chance a deck is shown in the random feed (weighted random, not first place). The swipe payment funds swiper earnings |
| AI drafting | "3 angles" generator and a card checker before publishing |
| Before launch | Three actions on the New deck screen: **Save draft** (keep editing later, nothing goes live), **Test with AI personas** (20 simulated target users per card, so 60 for a 3-card deck; each persona sees only one card, like real swipers; they react and give a rough preview with a few quotes; shown as "Simulated", never sent to Flagsmith and never counted toward the winner), and **Publish deck** (goes live, uses one deck from the pack) |
| Target-user question | Founder sets the "Is this you?" question |
| Sharing | One personal share link, QR code and ready-to-post WhatsApp and LinkedIn text. The link opens the swipe feed with that deck first; Flagsmith still assigns the card. After the swipe, the person continues in the normal random feed, so the founder's audience also discovers other decks. Swipes from the link are tagged `source: link` |
| Account | Same app account as swiping; founder tools live under "My decks" |
| Leaderboard | Reward claim rate, first-swipe rate, chance to be best; filter by everyone, target users, or own link only |
| Who swiped | Four tabs, each a labelled bar chart of reward claim rate with the overall rate as a dashed line: **Location** (state from IP, approximate, groups under 10 hidden), **Target users** (target vs everyone else, from each swiper's profile role matched against the product's target user list, with the leading card in each group), **Source** (swipe feed vs personal link, with a warning if they disagree) and **Interests** (from swipers' "Show me ideas for" choices; a swiper can have several). Each tab has one AI insight. Also: said yes vs acted. Segment views are leads, not results (section 5.10) |
| Audience targeting (free) | Set once on the product, not per deck. Founders choose who sees the product's decks in the feed: who sees it (everyone, or target users only), one or more states and one or more interests, all from the standard lists in section 5.12. The page shows an estimated reach. Targeting is free and included with every deck listed in the feed; it does not need Boost. Swiping is then restricted to that audience. Boost is optional on top and only raises how often the deck is shown to that audience. The personal link is not restricted, but its swipes are still tagged with state and source |
| Status | Collecting data, Leading, Winner found, or Too close to call |
| Insights | Plain-language results explainer and "why people swiped" themes |
| Deck switcher | Every deck-level page (results, test decided, download, and all four Who swiped tabs, on phone and web) has a dropdown at the top showing which deck is on screen, for example "Voice Khata · Headline test". It lists every deck of the product with its status (leading or won, and Flagsmith's chance), keeps the same page and tab when switching, and ends with a link to the product insights page |
| Test decided, ship the winner | When Flagsmith reports a 95% chance that one version is best, the founder gets a "Test decided" prompt on the results page (and a notification): each version's chance, what approval does, and one AI insight. **Nothing changes until the founder taps "Approve and ship".** Then Flagsmith ends the experiment and serves the winner to everyone with the same flag; losing cards leave the feed; all waitlist emails stay; the founder can switch back from deck settings. "Keep testing" leaves the experiment running. The share link keeps collecting sign-ups to the same waitlist |
| Waitlist (reward claims) | The reward claims are the waitlist: one email list per deck, covering every card, in a single place on the results page. Each email shows which card it came from and when. Export as CSV. The founder contacts these people at launch or separately; PitchSwipe does not send the reward |
| Download results | A Download button on the results, Who swiped and product insights pages (phone and web). The founder picks the scope (this deck or the whole product) and the files: a **results report** (PDF: winner, chance each version is best, Swipers → Said yes → Joined waitlist per version, who swiped, AI insights); a **summary table** (Excel or CSV: one row per version, split by state, source, interest and target user, with totals); **every swipe** (CSV: time, version, yes or no, comment, state, source, interest; no names, emails or IPs); and the **waitlist emails** (CSV). Several files download as one .zip, or can be emailed. Groups under 10 swipers are grouped as "Other", the same rule as on screen. Files show the time the numbers were taken |
| AI vs Humans **(Stretch)** | AI-predicted winner shown next to the real result |
| Organise by product | Decks are grouped under products (apps). A founder deciding price and description for the same app keeps both decks under one product. My decks shows each product with its decks and their status (won, leading, live, draft), a combined waitlist count, an Insights link and "Add a deck to <product>". Filters: All, Live, Drafts, Finished, Archived. A new deck is created inside a product ("in Voice Khata · Change"), and a deck can be moved to another product or archived |
| Product settings | Set once per product and shared by all its decks: name and icon, category line with one industry, founder name (or anonymous), target user (one or more roles, shown on the card as "Made for"), and the audience (who sees it, states, interests). New decks inherit them; the New deck screen only asks for what a deck needs (the variable under test, launch reward, price, swipe question, description, product UI or logo versions). Changes apply to new decks only, so running tests stay fair |
| Product insights | Decks are grouped by product. An insights page shows each deck's winner, AI insights that connect results across decks, the suggested next test and the total pilot customers |
| Next round **(Stretch)** | AI drafts a challenger card; one-click round 2 |
| Waitlist copy **(Stretch)** | AI writes the waitlist page from the winning card |

### 5.2 For Swipers

| Feature | Description |
|---|---|
| No sign-up | Opens straight from a link, built for mobile |
| Target check | No extra question. With one login, every swiper's profile already has a role, so the founder's results split into target users vs everyone else automatically. The "Answer saved" pop-up only asks for an optional one-line comment. Interests chosen in the profile or on the home screen decide which decks they get |
| Swiping | Swipe gestures or left and right buttons, with card animation |
| Answer | Pick the positive or negative answer by tapping it or swiping right or left |
| Claim reward | Swipers set and verify their email once (one-time code) in their profile. After a positive answer, they tap the reward button; a sheet shows the verified email that will be shared with this founder, and one more tap claims it. No typing each time, but every claim is an explicit tap, so the email is only shared with founders the swiper chooses. The screen says the founder will contact them at launch or before. Optional; "Skip" continues swiping |
| Swipe feed | Founders can run many decks at once. The feed shows live decks in a random order, so every deck gets a fair share of swipers and no swiper picks what they see. Each swiper sees a deck only once, and Flagsmith picks which card of that deck they get. Later, Boost raises a deck's chance of being picked; the order stays random **(Pitch only)** |
| Earnings | Hackathon: demo earnings, Rs 0.25 per valid swipe on paid cards, in a wallet with history, labelled "Demo earnings"; withdraw button disabled. Later: real pay on boosted decks and UPI withdrawal from Rs 100 **(Pitch only)** |
| Feedback | Optional one-line "why?" |
| Growth loop | Thank-you screen with "Next deck" and "Test your own idea" |

### 5.3 Experiment Engine (Flagsmith)

- Creates a flag and an experiment for each deck through the Admin API.
- Assigns each swiper one card at random and records exposures and events.
- Pulls results from Flagsmith, cached and refreshed at most every 5 minutes, and respects the sample ratio mismatch (SRM) warning.
- Rolls out the winner through the same flag and archives the flag when the deck closes.

### 5.4 Trust and Safety

- One vote per swiper per deck; swipes faster than 300 ms are ignored; requests are rate-limited.
- **Paid swipes must be valid:** the card was on screen for at least 2 seconds, and a daily earning cap applies. Invalid swipes are not paid and are excluded from results.
- Results can be filtered to "own link only", so founders can compare paid feed swipers with their own audience.
- Founders cannot see who swiped what, and cannot pay for specific answers: payment is per valid swipe, positive or negative.
- Founders see only aggregate results. Emails are collected only with consent.
- Founders can stay anonymous to swipers, but never to PitchSwipe: an anonymous founder who does not honour the reward can still be reported and removed.
- The dashboard shows "Too close to call" rather than naming a weak winner.

### 5.5 Business Model (Pitch only)

Shown in the presentation to prove the product can make money. Not built during the hackathon.

| Item | Price | Notes |
|---|---|---|
| Free | Rs 0 | 1 live deck, own share link only, not listed in the feed |
| Deck pack | Rs 200 for 10 decks | Rs 20 per deck; decks are listed in the swipe feed |
| Big pack | Rs 1,600 for 100 decks | Rs 16 per deck (20% less than the 10-deck pack), for founders testing many ideas or products |
| Boost (priority deck) | Rs 2 per valid swipe (placeholder) | Higher chance of being shown in the random feed; the swiper gets Rs 0.25, PitchSwipe keeps Rs 1.75 |

All prices are placeholders to validate with founders. A deck pack alone cannot fund swiper payments (Rs 20 per deck against about 450 swipes needed for a result), so **swiper earnings come only from Boost budgets**. Unboosted decks in the feed earn swipers nothing.

**Two pages.** Deck plans (Free, 10 decks, 100 decks) have their own page, reached from My decks. Each deck has an "Audience and Boost" page with free audience targeting, Boost and the personal link.

**Naming.** "Campaign" is replaced with **deck** (one idea, 2 to 3 cards), which matches the swipe metaphor. "Priority campaign" becomes **Boost**.

### 5.6 One App, Two Roles, Phone and Web

Swipers and founders use the same app, with one account, like Instagram: the same features and data on a phone and in a browser. Anyone can swipe; anyone can create a deck.

- **One codebase.** A single responsive Next.js app, installable on the phone home screen as a PWA. No separate native app in the hackathon.
- **Phone layout:** bottom tabs: **Swipe** (feed), **Wallet** (earnings), **My decks** (create, share, results, boost), **Profile**.
- **Web layout:** the same four sections in a left sidebar, with the pitch card in the centre. Deck creation and results use the wider screen.
- **Same account everywhere.** A deck created on the web shows up on the phone, and earnings are the same on both.
- **Every flow on both.** Founder screens (products, deck plans, new deck for all six test types, AI preview, audience and boost, results, test decided and ship winner, who swiped, product insights) and swiper screens (profile, email verification, practice decks, practice result, swipe, one-tap reward claim, answer saved, wallet) exist on both phone and web. On the web, onboarding is a focused page without the sidebar; the claim and answer-saved steps are dialogs over the swipe page.

### 5.7 Payouts (Pitch only)

- Earnings accrue per valid swipe on boosted decks and show in the wallet.
- **Paid cards are labelled on the card itself:** "Paid card: Rs 0.25 per valid swipe. Yes or no pays the same." (The 2-second rule is explained on the swipe home screen.) "Valid" means read for at least 2 seconds and passing the quality checks; it never means answering yes. Cards from decks without Boost say "Unpaid card. Just your honest take."
- Withdrawal to UPI from Rs 100.
- **Hackathon scope:** the wallet is built with demo earnings (Rs 0.25 per valid swipe on paid cards, stored in the database, clearly labelled "Demo earnings"). Withdrawal is shown but disabled. Real payouts need a payment provider, KYC and tax handling, so they come later.

### 5.8 Swipe Quality: Research-Based Strategies

Paying people per swipe invites low-effort answers. Survey and crowdsourcing research has studied this problem for decades; this section turns its findings into rules for PitchSwipe.

#### What the research says

| Finding | Source | What it means for PitchSwipe |
|---|---|---|
| Careless responding is common: about 10% to 12% of respondents in Meade and Craig's study; a median of about 10% across studies, ranging from low single digits to 30% to 40% | [22][23] | Expect roughly 1 in 10 swipes to be noise even with good design. Build detection in from day one |
| Answering faster than about 2 seconds per item is a validated signal of insufficient effort, and the rule held for items of different word lengths | [24][25] | A swipe counts as valid only if the card was on screen for at least 2 seconds |
| Instructed items (an item that tells the respondent which answer to pick) catch people not reading; about 7% failed in the original study | [26] | Occasionally show a check card that says "Pick the negative answer on this one" |
| Gold questions with known answers are the most common crowdsourcing quality control, but they must not repeat and should look like normal tasks | [27][28] | Rotate many check cards and make them look like real pitch cards |
| Consistency indices and long-string (straight-lining) indices detect careless patterns | [22][29] | Flag swipers who give the same answer many times in a row, or answer a repeated card differently |
| High-reputation workers rarely failed attention checks; checks mainly helped with low-reputation workers. Excluding people after the fact can cause selection bias | [30] | Keep a trust score per swiper. New and low-trust swipers get more checks; trusted swipers get fewer |
| Data quality on open paid platforms dropped from 2018, linked to bots and server farms | [31][32] | Block data-centre IPs and VPNs for paid swipes; one wallet per verified phone and UPI ID |
| Platforms differ a lot in the share of high-quality respondents and in cost per high-quality participant | [33] | Track "cost per valid swipe" and the valid-swipe rate as core quality metrics |
| People tend to say yes regardless of content (acquiescence bias), especially with yes/no or agree/disagree answers; it inflated some survey estimates by up to 40 to 50 percentage points | [34][35] | Guide founders to write specific answers ("Yes, I would pay" / "No, I would not") instead of "Agree / Disagree" |
| Warning statements have mixed evidence: some studies found they reduce careless responding, a 2024 study with 812 MTurk participants found no effect | [36] | Show one short honesty note, but never rely on it |
| Truth-telling incentives exist: the Bayesian truth serum rewards answers that are more common than people predicted | [37] | Stretch idea: ask "What share of people will say yes?" and give a bonus for surprisingly common answers |

#### How PitchSwipe applies it

**1. Prevent (before the swipe)**
- Pay the same for positive and negative answers, so there is no reason to fake enthusiasm.
- Show one card at a time, and disable the answer buttons for the first 2 seconds.
- Cap paid swipes per session (30) and per day (150), since carelessness grows as a session gets longer.
- Require phone verification before the first withdrawal; one wallet per phone number and UPI ID.

**2. Detect (during and after the swipe)**

| Check | Rule | Effect |
|---|---|---|
| Dwell time | Card visible under 2 seconds | Swipe not paid; never sent to Flagsmith |
| Check cards | About 1 in 20 cards says which answer to pick | Fail: lower trust score; two fails in a day pause paid swiping |
| Repeat cards | A card already answered appears again days later | A different answer counts as an inconsistency |
| Straight-lining | 20 or more identical answers in a row across decks | Flag for review; pause payouts until reviewed |
| Network and device | Data-centre IP, VPN, emulator, or many accounts per device | Swipes not paid; accounts linked and reviewed |

**3. Weight (when computing results)**
- Each swiper has a trust score from check cards, repeat-card consistency and account age.
- The Flagsmith experiment includes only valid swipes from swipers above a minimum trust score, so the statistics stay simple.
- The dashboard also shows a trust-weighted view as a secondary check.

**4. Validate (is the result real?)**
- **Compare sources.** Results can be filtered to "your link only" and compared with paid feed swipers. If they disagree, the founder sees a warning.
- **Behaviour beats opinion.** The winner is decided by reward claims (an email), not by the positive answer alone.
- **Shared bias cancels out.** All versions in a deck use the same question and answers, so a general lean towards "yes" raises every version equally. The difference between versions, which is what the test measures, stays fair. Absolute "yes" rates are shown with a caution note.

**Hackathon scope:** swipes are unpaid during the hackathon, so only the 2-second dwell rule and the source filter are built; invalid swipes are never sent to Flagsmith. The rest of this section is shown in the presentation as how quality is protected once swipers are paid.

### 5.9 Swiper Quality Score: Research-Based Trust System

Section 5.8 asks "is this swipe good?". This section asks "is this swiper a real, careful person, and how much should we trust them?". Research on crowdsourcing, survey fraud and fake accounts points to the same answer: no single check works, so trust should be built from several signals and earned over time.

#### What the research says

| Finding | Source | What it means for PitchSwipe |
|---|---|---|
| Bad actors come in types. In a 1,000-worker study, 43% failed at least one of two attention checks. "Fast deceivers" (copy-paste, gibberish, shortest times) were nearly 60% of untrustworthy workers; "smart deceivers" (about 13%) pass format checks but give irrelevant answers | [38] | Speed rules catch fast deceivers. Smart deceivers need a different check: repeat cards and the one-line "why" comment |
| Faster completion went with more malicious answers (correlation 0.51 among untrustworthy workers). Most workers who gave a bad answer early kept giving bad answers | [38] | Watch the first few swipes closely. An early bad pattern is a strong reason to stop paying, not just to flag |
| How people work (behavioural traces such as timing, scrolling and clicks) predicts quality and cheating, even with no history | [39][40] | Log dwell time, product UI scrolling and tap timing per swipe. Use them to score new swipers on day one |
| Some people lean one way on everything. Separating this bias from real errors gives a fairer quality score | [41] | A swiper who says "yes" to everything is biased, not necessarily dishonest. Weight their answers down instead of banning them |
| Fake accounts can be ranked by how they connect to known real users ("trust seeds") | [42] | Seed trust from founders' share links and verified users. Accounts that only connect to other new accounts get less weight |
| Fake accounts click differently from real people, and clustering clickstreams detected them with high accuracy on 16,000 real and fake users | [43] | Cluster session patterns. A group of accounts with near-identical swipe rhythms is likely one person or a script |
| CAPTCHAs alone miss most bots: in one study, hand-coded answers flagged 18.9% as likely bots while reCAPTCHA v3 flagged 1.7% | [44] | Use reCAPTCHA only as one signal, never the gate |
| Combining tools works better; one study tested task-, question- and data-based screens across $0, $1 and $5 incentives, and removed a respondent only after failing at least three screens | [45] | Remove a swiper only when several independent signals agree |
| Advertising the payment publicly attracted bots; bot responses dropped only after the payment was removed from recruitment posts | [46][47] | Do not lead public marketing with "earn money". Lead with "see new ideas first" |
| Platforms with stronger vetting gave better attention, comprehension and honesty; reputation filters raised quality | [30][48] | A visible trust tier is worth building: it is what separates good panels from bad ones |
| Reputation works by giving people a "shadow of the future": what they do now affects what they can do later | [49] | Trust tiers unlock higher caps and better decks, so careful swiping pays off over time |
| Paying for agreement with peers, or using truth-serum style scoring, improved accuracy; motivational messages alone did not | [50][37] | Later: a small bonus when a swiper predicts the crowd well. Do not rely on "please be honest" text |

#### Getting counted: the quality check

Nobody is locked out. A swiper's **quality score** decides whether their swipes count in founders' results and get paid; it never blocks swiping. This replaces the earlier 200-deck practice set and 24-hour lockout, which failed the "tolerance for mistakes" test in the AI Opportunity Brief (section 6.4).

1. **Create profile:** name, email, state, age group, role (one, from the standard role list) and interests (from the standard industry list); see section 5.12.
2. **Verify email:** a 6-digit code, once. After that, claiming a reward shares the verified email with one tap.
3. **Practice set:** 30 practice cards (about 3 minutes), drawn at random from a library of 1,000 past tests with known results. Not paid; never reach founders.
4. **Quality score (0 to 100), plain rules, no model:**

| # | Check | Rule | Effect |
|---|---|---|---|
| 1 | Reading time | Answer under 2 seconds | That swipe is not valid; share of fast swipes lowers the score |
| 2 | Straight-lining | Same answer on (almost) every card | Lowers the score; shown as "always the same answer" |
| 3 | Repeat cards | Same card shown twice gets a different answer | Lowers the score |
| 4 | Check cards | A card with a known answer (about 1 in 20 in the real feed, 3 in practice) is missed | Lowers the score; two misses in a day pause paid swiping |

   The swiper sees the reasons, for example "Too fast: under 2 seconds, 9 of 30 cards". Yes and no count the same; the score never rewards agreeing with the majority.
5. **Score 70 or more: "Swipes counting".** Swipes count in results and paid cards pay Rs 0.25 per valid swipe. Check cards in the feed keep the score updated.
6. **Score below 70: "Not counted yet".** The swiper goes to the real feed anyway and can keep swiping, but those swipes are not counted or paid. Two options on screen: **Re-check now: 20 cards** (any time, no wait) and **Keep swiping (not counted)**. Only after a re-check can they ask a person to review.
7. **Later, a model:** once there is real data (swipers whose answers matched known results, and whose claimed emails turned out real), train a simple model and run it silently beside the rules; switch only if it beats them.

Demo numbers on the screens: pass = score 82 (30/30 practice, 96% read 2+ s, 91% same answer on repeats, 3/3 check cards); not counted = score 54 (9 of 30 too fast, 2 of 3 repeats differ, 1 of 3 check cards missed; web shows 71%, 64%, 2/3).

#### After the check

| Status | What changes |
|---|---|
| Swipes counting (score 70+) | Swipes count and pay; normal daily cap; about 1 in 20 feed cards is a check card |
| High score (300+ valid real swipes, consistent) | Higher cap, fewer check cards, first access to new Boosted decks |
| Not counted yet (below 70) | Keeps swiping; swipes not counted or paid; re-check any time |
| Paused | Several independent signals fail (for example check cards plus a bot-like rhythm plus a shared device): paid swiping stops and held earnings are reviewed; a 20-card re-check is offered |

#### Trust score inputs

1. **Identity:** one account per phone number and UPI ID; device and network checks; reCAPTCHA as a weak signal only.
2. **Behaviour:** dwell time, scrolling of product UI images, tap rhythm, session length. Compared with real human patterns.
3. **Answers:** check cards, repeat-card consistency, straight-lining, one-line comment quality (no copy-paste or gibberish).
4. **Connections:** came from a founder's link or a trusted user's invite, versus clusters of new accounts.
5. **Track record:** account age and valid-swipe count.

**Rules:** a single failed signal lowers the score; only several agreeing signals pause an account. New swipers are not punished for being new, but their answers count less until they earn trust.

**Hackathon scope:** build the four rules and the counted/not-counted logic (items 1 and 2 of the plan); design the 30-card practice and the 20-card re-check. No ML model. Personal-link visitors: see Open Questions.

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

### 5.11 Logo Test

A deck can test the logo. The founder uploads 2 to 3 square marks (PNG or SVG, at least 256 px), each with a short name. Each card shows its own logo in the icon slot; everything else stays locked, and the card checker confirms the versions are the same size and shape so only the mark differs. The product icon is the default for every other deck; a logo test overrides it for that deck only. Results read the same way: Swipers → Said yes → Joined waitlist.

### 5.12 One Login, One Set of Lists

Swipers and founders share one account and one profile, so every audience field uses the same fixed lists. Nothing is free text, so a founder's choice always matches what swipers picked.

| List | Values | Used in |
|---|---|---|
| Role | Shop owner, Wholesaler, Business owner, Salaried, Freelancer, Student, Doctor, Driver, Homemaker, Farmer, Other | Profile "What do you do?" (one value); product "Target user" (one or more); "Made for" on the card; Target users split in results |
| Industry | Retail, Finance, Food, Healthcare, Logistics, Travel, Education, Fashion, Real estate, Agriculture, SaaS, Gaming, Fitness, Beauty, Pets, Kids | Profile and home "Show me ideas for"; product industry in the category line; audience "Interests"; Interests split in results |
| State | Indian states and union territories | Profile state (checked against IP); audience "States"; Location split in results |

- **Target users without a question.** A swiper is a target user when their profile role is in the product's target user list. The old per-product target question is removed, and so is the yes/no in the "Answer saved" pop-up.
- **Every swiper is counted.** Role is required in the profile, so the Target users split always adds up to the total (demo: 71 target users + 143 everyone else = 214).
- **Changing a role.** A swiper can edit their role; each swipe keeps the role the swiper had at that time.
- **New values.** Lists change only through a product update, never by a founder typing a new value.

### 5.13 Price Test: Demand Curve

A price deck can test 2 to 4 prices. The founder first picks the kind of price test:

| # | Kind | Versions | Result |
|---|---|---|---|
| 1 | **Find the best price** | 2 to 4 prices in the same unit (for example Rs 99, 199, 299, 399 per month) | Demand curve and the price that earns the most |
| 2 | **Test framing** | Same price, different wording (for example "Rs 10 a day" vs "Rs 299 a month") | Normal results: which framing gets more sign-ups |

**How the curve is computed**

- Each price is one Flagsmith variant; every swiper sees one price. Flagsmith's metric stays "joined the waitlist" (reward claim).
- **Join rate** per price = joined ÷ swipers, with a 90% likely range (Beta posterior, uniform prior, same Bayesian approach as Flagsmith).
- **Revenue per 100 swipers per month** = price × join rate × 100, assuming every sign-up pays (shown on screen).
- **Chance each price earns the most:** PitchSwipe draws from each price's posterior and counts how often each price has the highest revenue (Monte Carlo, 200,000 draws). Flagsmith's own chance-to-win is on join rate, not revenue; the screen says so.
- The best price becomes a **Result** at 95%; below that it is a **Lead** with "about N more swipers per price".
- No dual-axis chart: two charts side by side (join rate as a line with range bars; revenue as bars with the best price highlighted), plus a table with every number.

**Demo data (Voice Khata price test, 120 swipers per price)**

| # | Price | Swipers | Said yes | Joined | Joined % (90% range) | Revenue per 100 swipers (90% range) | Chance it earns most |
|---|---|---|---|---|---|---|---|
| 1 | Rs 99 / mo | 120 | 71 | 29 | 24% (18–31%) | Rs 2,392 (1,826–3,088) | 0% |
| 2 | Rs 199 / mo | 120 | 64 | 29 | 24% (18–31%) | Rs 4,809 (3,666–6,210) | 88% |
| 3 | Rs 299 / mo | 120 | 43 | 13 | 11% (7–17%) | Rs 3,239 (2,131–4,942) | 11% |
| 4 | Rs 399 / mo | 120 | 25 | 5 | 4% (2–9%) | Rs 1,662 (876–3,390) | 1% |
| 5 | Total | 480 | 203 (42%) | 76 (16%) | | | |

Headline on screen: "Rs 199 earns the most." with "88% chance · not decided yet". Lead: "Rs 99 gets no more sign-ups than Rs 199. Both 24%, so Rs 199 earns about twice as much. Above Rs 199, sign-ups halve. About 40 more swipers per price to reach 95%."

### 5.14 Voice Comments in Any Language

On the "Answer saved" pop-up, under the optional comment box: **"Or say it in any language · up to 30 s"**.

| # | Step | Detail |
|---|---|---|
| 1 | Record | Up to 30 seconds; waveform, timer and "18 s left"; the language is detected automatically |
| 2 | Transcribe | Speech-to-text in the spoken language, then translation to English. Sarvam AI's REST speech-to-text handles clips under 30 seconds [79]; Saaras v3 covers 22 Indian languages plus English and can translate speech to English directly [80]. Its models handle code-mixed speech such as Hindi with English words [81] |
| 3 | Review | The swiper sees the original transcript and the English line before keeping it; Delete or Stop and keep |
| 4 | Privacy | The founder sees text and translation only. Playing the audio needs the swiper's tick: "Let Arjun play my voice note" (off by default). Audio is deleted after 30 days |
| 5 | Into insights | The English text joins the typed comments that AI insights read; each voice comment is tagged with language, length and the swiper's state and role |

Founder view ("Why people swiped"): "22 comments · 6 by voice, translated"; example row: Bengali voice note · 0:12 · West Bengal shop owner: "Keeping the credit record is not the problem, collecting the money is. Reminders on WhatsApp would be good." with the Bengali original under it ("ধারের হিসাব রাখা নয়, টাকা আদায়টাই আসল সমস্যা। WhatsApp-এ মনে করিয়ে দিলে ভালো হয়।").

Data model: `responses.comment` gains `commentVoice` (`audioUrl`, `durationSec`, `language`, `transcript`, `english`, `founderCanPlay`).

### 5.15 Ship the Winner to the Founder's Website

Each deck's Flagsmith flag holds the real text (headline, price, reward). The founder connects their landing page once; "Approve and ship" then changes the live site too, with no deploy.

| # | Step | Detail |
|---|---|---|
| 1 | Snippet | Founder pastes Flagsmith's JavaScript SDK with the public client-side key: `flagsmith.init({ environmentID, onChange })`; on change, every element with `data-pitchswipe="<flag>"` gets `flagsmith.getValue(<flag>)` as its text |
| 2 | Mark elements | `<h1 data-pitchswipe="deck_voice-khata-headline">Speak your sales. The ledger writes itself.</h1>`; the current text stays as the fallback |
| 3 | Check | The snippet pings PitchSwipe; settings show "Connected: voice-khata.vercel.app · snippet seen 2 min ago · 3 elements found" and what each element shows now |
| 4 | During the test | Website visitors are anonymous (not identified), so they see the flag's normal value, the current text; only identified PitchSwipe swipers are split into A, B and C |
| 5 | Ship | After approval: complete the experiment, then set the flag's value to the winning text and the variant weights to 100 for the winner, so both anonymous site visitors and identified users get it. Test on day 1 that anonymous visitors see the new value |
| 6 | Proof | The snippet reports the value it received; the Shipped screen shows "Your website shows Headline B · voice-khata.vercel.app updated, no deploy", and a before/after view shows the site |
| 7 | Undo | Restores the previous value and weights; the site switches back the same way |

Security: only the public client-side key goes in the snippet; the Admin API key stays on the server. Demo site: `voice-khata.vercel.app` (a demo landing page we build for the video).

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

### 9.4 Flagsmith Fit (Verified in Docs)

- The Admin API can create, start and read experiments. The MCP server cannot start them [6].
- A variation shows "Collecting data" until it has at least 50 identities or 5 conversions. Rollout is recommended at a 95% chance to beat control [7].
- The free plan includes 100k users in experiments (added October 2026) [8].
- **Ship-winner flow is buildable with the API (checked 15 Nov 2026):** start with `POST /api/v1/environments/{env}/experiments/{id}/start/` (this locks the flag); read results with `GET .../experiments/{id}/results/` and refresh with `POST .../results/refresh/` at most every 5 minutes [68]. End the run with `POST .../experiments/{id}/complete/`, listed in the API reference as "Complete an experiment" [69]; the docs say ending freezes results and unlocks the flag [67]. Then roll out the winner by updating the flag so everyone gets the winning variation [67], for example by setting the environment default's variant weights to 100 for the winner and 0 for the others; the variants list must include every variant, even at weight 0 [70].
- **Caveats:** the newer flag-update endpoints are marked experimental and do not work while change requests are enabled [70]; the complete endpoint was found in the API reference, not in the how-to docs, so test it on day 1. Experimentation is an Enterprise beta and needs a connected warehouse [6][71].

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

## 13. Build Reference for Vibe Coding

One place for every demo number and label used in the designs, so the build matches them exactly. All numbers are demo data.

### 13.1 Product and decks (Voice Khata, founder Arjun Sen)

| # | Deck | Variable | Status shown | Chance |
|---|---|---|---|---|
| 1 | Headline test | headline (A, B, C) | Leading on results; decided in the assistant flow | 91% (results), 96% (decided) |
| 2 | Product UI test | productUI | Won | 95% |
| 3 | Price test | price | Leading | 88% (Rs 199 leads with target users) |
| 4 | Launch reward test | reward | Won | 97% |

- Headlines: A "Speak your sales. The ledger writes itself." · B "Stop chasing payments. Get paid on time." · C "Your whole ledger for Rs 10 a day."
- Card: category "Voice ledger · Retail"; price Rs 299 / mo; reward "Get 3 months free at launch"; question "Would you pay Rs 299 a month?"; answers "Yes, I would pay" / "No, I would not"; Made for: Shop owner, Wholesaler.
- Flag name: `deck_voice-khata-headline`. Product totals: 612 real swipers across 4 decks; 118 pilot customers on the waitlist; 3 of 4 decks with a clear winner.
- Other products in My decks: QueueLess (2 decks, 12 on waitlist), Ledger for chemists (1 deck, draft).

### 13.2 Headline test results (order always Swipers → Said yes → Joined waitlist)

| # | Group | Swipers | Said yes | Joined | Join rate |
|---|---|---|---|---|---|
| 1 | Total | 214 | 98 (46%) | 26 | 12% |
| 2 | Headline B | 71 | 38 | 13 | 18.3% |
| 3 | Headline A | 72 | 34 | 8 | 11.1% |
| 4 | Headline C | 71 | 26 | 5 | 7.0% |
| 5 | Feed | 160 | 70 | 14 | |
| 6 | Personal link | 54 | 28 | 12 | |
| 7 | B feed / link | 53 / 18 | 27 / 11 | 7 / 6 | |
| 8 | A feed / link | 54 / 18 | 24 / 10 | 4 / 4 | |
| 9 | C feed / link | 53 / 18 | 19 / 7 | 3 / 2 | |
| 10 | Target users (Shop owner, Wholesaler) | 71 | 45 | 16 | 23% |
| 11 | Everyone else | 143 | 53 | 10 | 7% |
| 12 | Gujarat | 41 | 22 | 9 | 22% |
| 13 | Maharashtra | 62 | 28 | 8 | |
| 14 | West Bengal | 27 | 12 | 3 | |
| 15 | Uttar Pradesh | 33 | 13 | 2 | |
| 16 | Delhi | 27 | 11 | 2 | |
| 17 | Hidden (states under 10) | 24 | 12 | 2 | |
| 18 | Interest: Finance | 58 | 31 | 10 | |
| 19 | Interest: Retail | 96 | 45 | 14 | |
| 20 | Interest: Logistics | 41 | 17 | 4 | |
| 21 | Interest: Fashion | 22 | 9 | 2 | |
| 22 | Interest: Food | 37 | 14 | 3 | |

- Decided state (assistant): 256 valid swipers; B 96%, A 3%, C 1%; approved by Arjun Sen at 18:42.
- AI vs humans: AI personas predicted A, people prefer B; persona preview 60 personas (20 per card): B 9 of 20, A 7 of 20, C 4 of 20; track record "right in 1 of 3 finished decks".
- Insight cards: Result "People buy 'get paid', not 'voice'" (decks 1 and 2 · 438 swipers · Flagsmith 96% and 95% · 41 comments); Lead "Price matters most to small shops" (deck 3 · 83 target users · Flagsmith 88%).

### 13.2a Language test demo copy

- English: "Stop chasing payments. Get paid on time."
- Hindi: "पेमेंट के पीछे भागना बंद करें। समय पर पैसा पाएं।"; reward "लॉन्च पर 3 महीने मुफ़्त"; question "क्या आप इसके लिए हर महीने Rs 299 देंगे?"; answers "हाँ, मैं दूँगा" / "नहीं".
- Bengali: "টাকার পেছনে ছোটা বন্ধ করুন। সময়মতো টাকা পান।"

### 13.3 Swiper side

- Swiper: Priya Nair, priya.n@example.com, Gujarat, role Shop owner, ideas Retail, Finance, Logistics.
- Wallet: Rs 46.75; withdraw from Rs 100; Rs 0.25 per valid swipe on paid cards; weekly total Rs 31.00 from 124 valid swipes.
- Quality score demo: pass 82, not counted 54 (section 5.9).

### 13.4 Pricing and limits

- Deck plans: Free; 10 decks Rs 200; 100 decks Rs 1,600. Boost: Rs 2 per valid swipe, Rs 0.25 of it to the swiper; demo "Boosted · Rs 410 left".
- Thresholds: winner at 95% chance to be best; Flagsmith minimum 50 identities or 5 conversions per variation; results refresh at most every 5 minutes; groups under 10 swipers shown as "Other"; read time under 2 seconds is not valid; quality score 70 to count.

### 13.5 Standard lists

- Roles: Shop owner, Wholesaler, Business owner, Salaried, Freelancer, Student, Doctor, Driver, Homemaker, Farmer, Other.
- Industries: Retail, Finance, Food, Healthcare, Logistics, Travel, Education, Fashion, Real estate, Agriculture, SaaS, Gaming, Fitness, Beauty, Pets, Kids.
- Test types: Headline, Description, Reward, Price, Product UI, Logo, Language.

### 13.6 Screens (file names in the design canvas)

- Founder, phone: AppMyDecks, AppAssistAlert, AppProduct, AppDeckPlans, Founder, FounderDesc, FounderReward, FounderPrice, FounderShots, FounderLogo, FounderLanguage, FounderAI, AppFounderShare, AppFounderResults, AppPriceResults, AppDownload, AppShipWinner, AppShipped, AppAudience, AppAudienceTarget, AppDeckSwitch, AppAudienceSource, AppAudienceInterest, AppInsights, AppAsk.
- Swiper, phone: AppSignup, AppVerify, AppQualify, AppQualifyPass, AppQualifyWait, AppHome, Main, MainHindi, AppNotify, AppDone, AppVoiceNote, AppWallet.
- Web: WebLanding, WebDecks, WebAssistAlert, WebProduct, WebConnectSite, WebDeckPlans, WebCreate (and Desc, Reward, Price, UI, Logo, Language), WebAIPreview, WebPlans, WebResults, WebPriceResults, WebDownload, WebShipWinner, WebShipped, WebSiteShipped, WebAudience, WebDeckSwitch, WebInsights, WebAsk, WebSignup, WebVerify, WebQualify, WebQualifyResult, WebHome, WebSwipe, WebClaim, WebDone, WebWallet.

## 14. Sources

1. [What is PickFu?](https://www.pickfu.com/blog/what-is-pickfu/); [Best Wynter alternatives 2026](https://getperspective.ai/blog/best-wynter-alternatives-2026-message-testing-platforms-ranked)
2. [ValidateSwipe on Product Hunt](https://www.producthunt.com/products/validateswipe)
3. [NextUnicorn on Indie Hackers](https://www.indiehackers.com/post/i-wasted-6-months-8k-on-a-bad-idea-built-this-so-you-don-t-have-to-SokXpsWm9GkOPOVvXAGR); [StartupSwipe](https://www.producthunt.com/products/startupswipe); [Swipy](https://www.producthunt.com/products/swipy/launches)
4. [GeekWire: GoDaddy's Flare (2016)](https://www.geekwire.com/2016/tinder-startup-ideas-godaddys-flare-gives-entrepreneurs-feedback-concepts-swipe/)
5. [Koji: Stated vs revealed preferences](https://www.koji.so/docs/stated-vs-revealed-preferences)
6. [Flagsmith: Set up with a coding agent](https://docs.flagsmith.com/experimentation/set-up-with-a-coding-agent)
7. [Flagsmith: Analyse an experiment](https://docs.flagsmith.com/experimentation/analyse-an-experiment)
8. [PricingSaaS: Flagsmith pricing change, October 2026](https://pricingsaas.com/companies/flagsmith/diffs/2026W44)
9. [Toggle Wars hackathon page](https://www.wemakedevs.org/hackathons/flagsmith)
10. [PickFu: choosing your audience](https://www.pickfu.com/help/en/articles/2011986-choosing-your-audience); [PickFu panel](https://www.pickfu.com/industries)
11. [Lyssna preference testing](https://www.lyssna.com/features/preference-testing-software/)
12. [Wynter: message testing guide](https://wynter.com/post/why-use-message-testing); [Wynter info page](https://wynter.com/ai-info-page)
13. [WeMakeDevs: Cognee hackathon](https://archive.wemakedevs.org/hackathons/cognee)
14. [WeMakeDevs: Hack All February](https://www.wemakedevs.org/blogs/hack-all-february)
15. [HackQuest: Hack the Flag](https://www.hackquest.io/hackathons/HackTheFlag)
16. [Flagsmith: 2026 Lisbon offsite and hackathon](https://www.flagsmith.com/blog/2026-lisbon-offsite-and-hackathon)
17. [DEV: DevCycle Feature Flag Challenge winners](https://dev.to/devteam/congrats-to-the-devcycle-feature-flag-challenge-winners-2jie)
18. [LaunchDarkly: Moonshots V](https://launchdarkly.com/blog/moonshots-v/)
19. [LaunchDarkly: 2025 hackathon recap](https://launchdarkly.com/docs/blog/2025-hackathon-recap)
20. [WeMakeDevs: Cognee winners and projects](https://archive.wemakedevs.org/hackathons/cognee/projects)
21. [GitHub: RouteSmith](https://github.com/Deepak-Kambala/RouteSmith)
22. Meade, A. W. and Craig, S. B. (2012). Identifying careless responses in survey data. *Psychological Methods*, 17(3), 437-455. [doi:10.1037/a0028085](https://doi.org/10.1037/a0028085)
23. [Careless responding prevalence review (PMC10552731)](https://pmc.ncbi.nlm.nih.gov/articles/PMC10552731)
24. Huang, J. L., Curran, P. G., Keeney, J., Poposki, E. M. and DeShon, R. P. (2012). Detecting and deterring insufficient effort responding to surveys. *Journal of Business and Psychology*, 27, 99-114. [ProQuest](https://www.proquest.com/docview/921300847)
25. Bowling, N. A., Huang, J. L., Brower, C. K. and Bragg, C. B. (2021). The quick and the careless: The construct validity of page time as a measure of insufficient effort responding to surveys. *Organizational Research Methods*. [doi:10.1177/10944281211056520](https://journals.sagepub.com/doi/ref/10.1177/10944281211056520)
26. Oppenheimer, D. M., Meyvis, T. and Davidenko, N. (2009). Instructional manipulation checks: Detecting satisficing to increase statistical power. *Journal of Experimental Social Psychology*, 45(4), 867-872. [doi:10.1016/j.jesp.2009.03.009](https://doi.org/10.1016/j.jesp.2009.03.009)
27. Oleson, D. et al. (2011). Programmatic gold: Targeted and scalable quality assurance in crowdsourcing. *AAAI Human Computation Workshop*. [dblp](https://dblp.uni-trier.de/rec/conf/aaai/OlesonSLHLB11.html)
28. Checco, A., Bates, J. and Demartini, G. (2019). Quality control attack schemes in crowdsourcing. *IJCAI*. [ijcai.org](https://ijcai.org/proceedings/2019/850.md)
29. [Detecting careless respondents in web-based questionnaires (Niessen et al., 2016)](https://research.rug.nl/en/publications/detecting-careless-respondents-in-web-based-questionnaires-which-/)
30. Peer, E., Vosgerau, J. and Acquisti, A. (2014). Reputation as a sufficient condition for data quality on Amazon Mechanical Turk. *Behavior Research Methods*, 46(4), 1023-1031. [doi:10.3758/s13428-013-0434-y](https://doi.org/10.3758/s13428-013-0434-y)
31. Chmielewski, M. and Kucker, S. C. (2020). An MTurk crisis? Shifts in data quality and the impact on study results. *Social Psychological and Personality Science*, 11(4), 464-473. [doi:10.1177/1948550619875149](https://doi.org/10.1177/1948550619875149)
32. [CloudResearch: After the bot scare](https://cloudresearch.com/resources/blog/after-the-bot-scare-understanding-whats-been-happening-with-data-collection-on-mturk-and-how-to-stop-it/)
33. Douglas, B. D., Ewell, P. J. and Brauer, M. (2023). Data quality in online human-subjects research: Comparisons between MTurk, Prolific, CloudResearch, Qualtrics, and SONA. *PLOS ONE*, 18(3). [doi:10.1371/journal.pone.0279720](https://doi.org/10.1371/journal.pone.0279720)
34. Saris, W. E., Revilla, M., Krosnick, J. A. and Shaeffer, E. M. Comparing questions with agree/disagree response options to questions with construct-specific response options. [Stanford PDF](https://web.stanford.edu/dept/communication/faculty/krosnick/docs/2005/2005_saris.pdf)
35. Hill, S. J. and Roberts, M. E. (2023). Acquiescence bias inflates estimates of conspiratorial beliefs and political misperceptions. *Political Analysis*. [doi:10.1017/pan.2022.28](https://doi.org/10.1017/pan.2022.28)
36. Brühlmann, F. et al. (2024). The effectiveness of warning statements in reducing careless responding in crowdsourced online surveys. *Behavior Research Methods*. [doi:10.3758/s13428-023-02321-z](https://doi.org/10.3758/s13428-023-02321-z)
37. Prelec, D. (2004). A Bayesian truth serum for subjective data. *Science*, 306(5695), 462-466. [summary](https://stafforini.com/works/prelec-2004-bayesian-truth-serum/)
38. Gadiraju, U., Kawase, R., Dietze, S. and Demartini, G. (2015). Understanding malicious behavior in crowdsourcing platforms: the case of online surveys. *CHI 2015*, 1631-1640. [doi:10.1145/2702123.2702443](https://doi.org/10.1145/2702123.2702443)
39. Rzeszotarski, J. M. and Kittur, A. (2011). Instrumenting the crowd: using implicit behavioral measures to predict task performance. *UIST 2011*, 13-22. [PDF](https://jeffrz.com/papers/uist11fingerprint.pdf)
40. [A Survey on Task Assignment in Crowdsourcing (arXiv:2111.08501)](https://arxiv.org/pdf/2111.08501)
41. Ipeirotis, P. G., Provost, F. and Wang, J. (2010). Quality management on Amazon Mechanical Turk. *KDD Workshop on Human Computation*, 64-67. [doi:10.1145/1837885.1837906](https://doi.org/10.1145/1837885.1837906)
42. Cao, Q., Sirivianos, M., Yang, X. and Pregueiro, T. (2012). Aiding the detection of fake accounts in large scale social online services (SybilRank). *NSDI 2012*, 197-210. [USENIX](https://www.usenix.org/conference/nsdi12/technical-sessions/presentation/cao)
43. Wang, G., Konolige, T., Wilson, C., Wang, X., Zheng, H. and Zhao, B. Y. (2013). You are how you click: clickstream analysis for Sybil detection. *USENIX Security 2013*, 241-256. [USENIX](https://usenix.org/conference/usenixsecurity13/technical-sessions/presentation/wang)
44. [Bot detection with hand-coded free-response questions vs reCAPTCHA v3 (Behavior Research Methods, 2024)](https://link.springer.com/article/10.3758/s13428-024-02357-9)
45. Simone, M., Cascalheira, C. J. and Pierce, B. G. (2023). A quasi-experimental study examining the efficacy of multimodal bot screening tools. *American Psychologist*, 79(7), 956-969. [doi:10.1037/amp0001183](https://doi.org/10.1037/amp0001183)
46. Griffin, M. et al. (2022). Ensuring survey research data integrity in the era of internet bots. *Quality & Quantity*, 56, 2841-2852. [doi:10.1007/s11135-021-01252-1](https://doi.org/10.1007/s11135-021-01252-1)
47. [Recruiting through Reddit while facing internet bots (Cyberpsychology, Behavior, and Social Networking)](https://journals.sagepub.com/doi/ref/10.1089/cyber.2022.0173)
48. Peer, E., Rothschild, D., Gordon, A., Evernden, Z. and Damer, E. (2022). Data quality of platforms and panels for online behavioral research. *Behavior Research Methods*, 54, 1643-1662. [doi:10.3758/s13428-021-01694-3](https://doi.org/10.3758/s13428-021-01694-3)
49. Resnick, P., Zeckhauser, R., Friedman, E. and Kuwabara, K. (2000). Reputation systems. *Communications of the ACM*, 43(12), 45-48. [PDF](https://cs.uwaterloo.ca/~klarson/teaching/F04-886/papers/p45-resnick.pdf)
50. Shaw, A. D., Horton, J. J. and Chen, D. L. (2011). Designing incentives for inexpert human raters. *CSCW 2011*, 275-284. [summary](https://john-joseph-horton.com/papers/designing-incentives-for-inexpert-raters/)
51. [How accurate is IP geolocation (Abstract API)](https://www.abstractapi.com/guides/ip-geolocation/how-accurate-is-ip-geolocation)
52. [IP geolocation accuracy benchmark against GPS ground truth (ipapi.is, 2026)](https://hn.jakechampion.name/reader/https://ipapi.is/blog/ip-geolocation-accuracy.html)
53. [How accurate is IP geolocation: mobile carriers and CGNAT (ipconfig.io)](https://docs.ipconfig.io/guides/how-accurate-is-ip-geolocation)
54. [Mobile IP geolocation really is worse: what CGNAT does in Africa and Asia (Ipregistry, summarising "Lost in the Prefix")](https://ipregistry.co/blog/mobile-ip-geolocation-cgnat)
55. [Bare essentials of the DPDP Act, 2023 (Rainmaker)](https://rainmaker.co.in/bare-essentials-you-need-to-know-about-the-dpdp-act-2023)
56. [DPDP Act and Rules, 2025: notice and consent (Trilegal)](https://trilegal.com/wp-content/uploads/2025/11/DPDPA.pdf)
57. [Measuring discrepancies in Airbnb guest acceptance rates using anonymized demographic data (arXiv:2204.12001), review of minimum cell sizes](https://arxiv.org/pdf/2204.12001)
58. [Smoke tests for startups: revealed vs stated preference (User Intuition)](https://www.userintuition.ai/reference-guides/smoke-tests-for-startups-validate-before-you-build/)
59. [Fake door testing: behaviour over stated intent (Rocket)](https://www.rocket.new/blog/fake-door-testing-validate-demand-before-you-build)
60. [Product-market fit survey and the 40% benchmark (CRV)](https://www.crv.com/content/product-market-fit-survey); [Sean Ellis PMF survey framework (Umbrex)](https://umbrex.com/resources/frameworks/product-management-frameworks/sean-ellis-product-market-fit-survey/)
61. [Van Westendorp Price Sensitivity Meter (Conjointly)](https://conjointly.com/products/van-westendorp/)
62. [What is segment analysis? (Spotify Confidence)](https://confidence.spotify.com/glossary/segment-analysis.md)
63. [Segmenting A/B test results: exploratory only, pre-register segments (Atticus Li)](https://www.atticusli.com/blog/posts/optimizely-segmenting-ab-test-results/)
64. [Characterizing long-form summarization: numeric hallucinations (arXiv 2404.06162)](https://arxiv.org/pdf/2404.06162)
65. [LLMs summarising tabular data hallucinate numbers and rankings (SURGeLLM 2026)](https://aclanthology.org/2026.surgellm-1.21/)
66. [Multiple comparisons in A/B testing, including segment analysis (Statsig)](https://statsig.com/blog/multiple-comparisons-in-a-b-testing)
67. [Analyse an Experiment (Flagsmith docs)](https://docs.flagsmith.com/experimentation/analyse-an-experiment)
68. [Set Up an Experiment with a Coding Agent (Flagsmith docs)](https://docs.flagsmith.com/experimentation/set-up-with-a-coding-agent)
69. [Flagsmith Environments API reference (apis.io mirror of the OpenAPI spec)](https://apis.io/apis/flagsmith/flagsmith-environments-api/)
70. [Experimental: Updating Flags (Flagsmith docs)](https://docs.flagsmith.com/managing-flags/updating-flags)
71. [Create an Experiment: Enterprise beta (Flagsmith docs)](https://docs.flagsmith.com/experimentation/create-an-experiment)
72. [DPIIT reports 2.5 lakh startups (KNN India, Oct 2026)](https://knnindia.co.in/news/newsdetails/sectors/start-up/dpiit-reports-25-lakh-startups-generating-2542-lakh-jobs-47957-compliance-cuts)
73. [Centre recognises record 55,200 startups in FY26 (Inc42)](https://inc42.com/?p=555314)
74. [Product Hunt Pulse: launches per year (hunted.space)](https://hunted.space/product-hunt-pulse)
75. [India's research and insights industry Rs 29,008 crore in FY2025 (Social Samosa, MRSI)](https://www.socialsamosa.com/report/india-research-insights-industry-growth-size-in-fy2025-10975339)
76. [Koji vs Wynter (2026)](https://www.koji.so/blog/koji-vs-wynter-2026)
77. [Online survey software market size (SkyQuest via GII)](https://www.giiresearch.com/report/sky1734440-online-survey-software-market-size-share-growth.html)
78. [Global online survey software market forecast (Knowledge Sourcing via MarketResearch.com)](https://www.marketresearch.com/Knowledge-Sourcing-Intelligence-LLP-v4221/Global-Online-Survey-Software-Forecasts-42725296)
79. [Speech to Text API: REST for audio under 30 seconds (Sarvam docs)](https://docs.sarvam.ai/api-reference/speech-to-text/transcribe)
80. [Building for Indian Languages: Saaras v3, 22 Indian languages plus English (Sarvam docs)](https://docs.sarvam.ai/api/getting-started/building-for-india)
81. [Saarika v2.5: code-mixing support (Sarvam docs)](https://docs.sarvam.ai/api/getting-started/models/saarika.md)
