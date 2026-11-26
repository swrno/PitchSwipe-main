# 04 · Trust and safety, swipe quality, swiper quality score

Sections 5.4, 5.8, 5.9. NOTE: 5.9 replaces the earlier 200-deck practice set and 24 h lockout with a 30-card practice and a four-rule quality score; nobody is locked out.

### 5.4 Trust and Safety

- One vote per swiper per deck; swipes faster than 300 ms are ignored; requests are rate-limited.
- **Paid swipes must be valid:** the card was on screen for at least 2 seconds, and a daily earning cap applies. Invalid swipes are not paid and are excluded from results.
- Results can be filtered to "own link only", so founders can compare paid feed swipers with their own audience.
- Founders cannot see who swiped what, and cannot pay for specific answers: payment is per valid swipe, positive or negative.
- Founders see only aggregate results. Emails are collected only with consent.
- Founders can stay anonymous to swipers, but never to PitchSwipe: an anonymous founder who does not honour the reward can still be reported and removed.
- The dashboard shows "Too close to call" rather than naming a weak winner.


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

