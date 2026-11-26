# 02 · Founder features

Sections 5.1, 5.3, 5.11, 5.13, 5.15. Screens: `../designs/README.md` (F-*).

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


### 5.3 Experiment Engine (Flagsmith)

- Creates a flag and an experiment for each deck through the Admin API.
- Assigns each swiper one card at random and records exposures and events.
- Pulls results from Flagsmith, cached and refreshed at most every 5 minutes, and respects the sample ratio mismatch (SRM) warning.
- Rolls out the winner through the same flag and archives the flag when the deck closes.


### 5.11 Logo Test

A deck can test the logo. The founder uploads 2 to 3 square marks (PNG or SVG, at least 256 px), each with a short name. Each card shows its own logo in the icon slot; everything else stays locked, and the card checker confirms the versions are the same size and shape so only the mark differs. The product icon is the default for every other deck; a logo test overrides it for that deck only. Results read the same way: Swipers → Said yes → Joined waitlist.


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

