# Dogfood: PitchSwipe tests itself

Status: **PLAN. Nothing here has been run.** No results exist yet. Source: `docs/spec/07-strategy-and-research.md` section 10.8, round 1 idea 1 (status *Demo*, "Screens: not needed"), and the traffic plan in section 10.5.

## What it is

Run one real Flagsmith experiment on PitchSwipe's own swipe screen during the event, and show its live result while presenting as the validation example. It is a demo and presentation item, not a product feature.

## Experiment definition

| Field | Value |
|---|---|
| Flag | `ps_reward_button_copy` |
| Metric | `reward_claimed` |
| Variable | The wording of the reward button (one variable; everything else identical) |
| Variants | Two wordings, as the spec gives them as an example: "Claim 3 months free" and "Get early access" |
| Winner rule | The same rule as every deck: Flagsmith decides (95% chance to beat control, at least 50 identities per variant, no SRM warning), else "Too close to call" |
| Shipping | Only after a human approves; AI never decides or ships |

Notes and open points:

- The spec says "for example", so the two wordings are a proposal, not a locked decision. Confirm before launch.
- The spec names the metric `reward_claimed`, while the product decks use `reward_claim` (`docs/spec/06`, "Primary metric"). Decide whether the dogfood metric is a separate Flagsmith event or the same event; this doc does not resolve it. TODO.
- Which variant is control is not stated in the spec. TODO.
- The spec does not say which screen element carries the dogfood button. TODO (the live swipe screen is `/swipe`).

## Traffic plan (spec 10.5)

1. Dogfood deck: three ways to pitch PitchSwipe itself, shared with hackathon participants on day 1. Target: 150+ swipers (a target, not a result).
2. Other teams create decks for their own projects and bring their own swipers.
3. Growth loop: every thank-you screen invites the swiper to make their own deck.

Timeline from the spec: swipe page and dogfood experiment live on 26 Nov; push traffic on 28 Nov; record the video and submit on 29 Nov by 8 PM IST.

## Results (fill in from real data only)

| Variant | Identities | `reward_claimed` | Chance to beat control | Status |
|---|---|---|---|---|
| Claim 3 months free | TODO | TODO | TODO | TODO |
| Get early access | TODO | TODO | TODO | TODO |

Do not publish a winner unless Flagsmith's decision rules are met. Quote only numbers read from Flagsmith or the database.
