# DRAFT: A/B test your pitch before you build your landing page

> Draft built only from `docs/spec/README.md` and `docs/spec/`. Everything marked TODO needs real results or a human decision. No customers, quotes or results are claimed.

## The problem

Founders often choose a headline, positioning or price by gut feel, then build a landing page around that guess. Asking friends "which sounds better?" gives polite, biased answers. Paid research tools use panels of strangers and charge per test; simple polls are biased by order.

## What PitchSwipe does

PitchSwipe lets a founder test two or three versions of one idea, changing exactly one thing: the headline, description, reward, price, product UI, logo or language. Everything else is locked and identical. Each swiper sees exactly one card, assigned at random by Flagsmith, so there is no comparing and no order bias.

The version that earns the most reward-claim emails wins. People who claim the launch reward (for example "Get 3 months free at launch") become the founder's waitlist: their first pilot customers.

## Why email sign-ups decide the winner

A swipe is a stated preference. An email sign-up costs the user something, so it is a stronger signal. (The spec cites one vendor's estimate that stated-preference research predicts real purchases with about 34% accuracy; that is a vendor figure, not ours.)

## How Flagsmith is used

- One flag per deck, one variant per card, with an experiment behind it.
- Swipers are identities; valid swipes and reward claims are sent as events.
- Flagsmith alone decides the winner: at least 95% chance to beat control, at least 50 identities per card and no sample-ratio-mismatch warning. Otherwise the answer is "Too close to call".
- The winner ships only after the founder taps **Approve and ship**. AI writes and explains; it never decides, ships or changes a flag, and every number in AI text is filled in by code from real data.

## Trust and privacy

Founders see aggregates only. Emails are shared only when a swiper explicitly claims. Groups under 10 are hidden. Raw IPs are never shown. A swipe counts only if the card was on screen at least 2 seconds, and swipers with a quality score under 70 are not blocked, their swipes just are not counted or paid. In the hackathon build no real money moves: earnings are labelled "Demo earnings".

## We tested PitchSwipe with PitchSwipe

Plan: a Flagsmith experiment on PitchSwipe's own swipe screen (flag `ps_reward_button_copy`, metric `reward_claimed`) comparing two reward-button wordings.

TODO: results. Insert real numbers from Flagsmith only after the experiment meets its decision rules. See `docs/archive/dogfood.md`.

## AI vs humans

TODO: only if the feature ships and has real data. The spec's idea is to compare AI persona predictions (marked Unproven) with what real people chose. Do not publish a comparison without real numbers.

## What we built

Next.js app with one responsive layout (phone and web), MongoDB, Firebase Authentication and Flagsmith. Add: TODO architecture diagram, link to `docs/ARCHITECTURE.md`.

## What is not built

The business model, deck packs, Boost and UPI payouts are designed but not built. State this plainly.

## Try it

TODO: public URL, repository link, video link.
