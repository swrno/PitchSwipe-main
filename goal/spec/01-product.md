# 01 · Product overview, business model, one app two roles

Sections 1–5.0, 5.5–5.7 of the product spec. Scope legend: MVP (default), **(Stretch)**, **(Pitch only)** = designed but NOT built; no real money moves in the hackathon.

# PitchSwipe: Product Specification

> A/B test your pitch before you build your landing page.

| | |
|---|---|
| **Hackathon** | Toggle Wars: The Flagsmith Experimentation Hackathon (WeMakeDevs) |
| **Track** | Track 01: Test Something Real ($2,000) |
| **Dates** | 26 Nov 2026, 8 AM IST to 29 Nov 2026, 8 PM IST (online) |
| **Stack** | Next.js, shadcn/ui, MongoDB, Flagsmith |


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

