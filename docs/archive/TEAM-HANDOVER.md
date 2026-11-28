# Team handover: 26 Nov 2026

What changed in PitchSwipe this round, how to run it, which secrets go to whom, and what is left. Server operations
(logging in, backups, rotating secrets) are in [HANDOVER.md](../HANDOVER.md); this page does not repeat them.

Nothing secret is written here.

## Where the code is

- **Since 26 Nov 2026 the code lives in [`swrno/PitchSwipe-main`](https://github.com/swrno/PitchSwipe-main)**, the final
  submission repo, which deploys to the server. What follows was written for the earlier private repo.
- Branch `fix/founder-feedback` on `swrno/PitchSwipe`, with a pull request into `main`. 10 commits on top of the merge
  of PR #43 (`01a2ec8`):
  1. Keep headline and price when switching test type
  2. Put the practice quality check behind a switch
  3. Add starter decks seed for the swipe feed
  4. Rename draft slug and flag when the test type changes
  5. Fix price test text when nobody has signed up
  6. Move server handover into docs and ignore env copies
  7. Weight the feed towards matching decks and founders
  8. Add Groq as the AI provider
  9. Fix card translation dropping numbers
  10. Add team handover notes
- **Not merged, so not live.** Merging into `main` deploys to the server by itself (CI, then the deploy workflow).
- Every check passes: `npm run typecheck`, `npm run lint` (0 errors), `npm test` (631 of 631), `npm run build`, and the
  app serves every main page locally.

## What changed

| # | Change | Where |
|---|---|---|
| a | **Saving the price no longer wipes the headline (and the other way round).** Switching the test type in New deck keeps what was written: version A becomes the locked field, the new test starts from the locked value, switching back restores the versions. | `src/features/decks/wizard.ts` |
| b | **The 30-card quality check is off.** New swipers go straight from verifying their email to swiping, and every signed-in swipe counts, so feed answers go through Flagsmith. Turn it back on with `NEXT_PUBLIC_QUALITY_CHECK=on`. | `src/features/quality/switch.ts` |
| c | **Starter feed decks.** 25 ideas x headline, price, description and reward tests, owned by a house account "PitchSwipe Ideas Lab" whose name shows on each card. Not written to any database. | `scripts/seed/feed-ideas.mjs`, `npm run seed:feed` |
| d | **Seed a small set.** `npm run seed:feed -- --ideas 3 --variables headline,price` gives 6 decks. Without `--yes` it only checks them. | `scripts/seed/feed-decks.mjs` |
| e | **A draft's Flagsmith flag name follows its test type.** A deck started as a headline draft and switched to price was published as `deck_..._headline_...` (the live `deck_pitch-swipe-headline-af2f` is a price test). Published decks are never renamed. | `src/features/decks/server/service.ts` |
| f | **Honest price text with no sign-ups.** "Both 0%, so Rs 35 earns about 1.4x as much" now reads "No sign-ups at any price yet." | `src/features/demand-curve/shape.ts` |
| g | **The feed favours fit and founders.** The next deck is still random, but x2 for the swiper's role among the target users, x1.5 for a matching interest, x0.25 for starter decks. Which version a swiper sees is still Flagsmith's call. | `src/features/swipe/ordering.ts` |
| h | **AI runs on a free Groq key.** Main model `openai/gpt-oss-120b`, fallback `openai/gpt-oss-20b`. Drafting, Ask, insight wording, comment themes and voice-note translation. | `src/shared/lib/ai/groq-provider.ts`, `src/shared/lib/ai/llm-env.ts` |
| i | **Card translation keeps the card's numbers.** "Translate with AI" failed for every language: the prompt told the model never to write a number, and Bengali wrote 3 as ৩. Both fixed. | `src/features/decks/server/ai-live.ts` |
| j | **Docs.** `docs/HANDOVER.md` (server guide) moved into `docs/` and updated; `.env.example` documents the new settings; the privacy page names Groq as the AI provider; `server.env` and `*.env` can never be committed. | `docs/`, `.env.example`, `.gitignore` |

## Run it locally

1. Get `team-dev.env` from the team's password manager (never from GitHub or chat) and save it as `.env.local` in the
   repo root.
2. `npm ci`, then `npm run dev` and open http://localhost:3000.
3. Locally the app runs on labelled demo data: no database, no sign-in, nothing touches production. AI is live (Groq).
4. Before pushing: `npm run typecheck`, `npm run lint`, `npm test`. `npm run doctor` shows which services your env reaches.

## Secrets: which file goes to whom

| File | What is in it | Who gets it | How |
|---|---|---|---|
| `team-dev.env` | Demo mode, a local signing secret, the shared Groq key | Every developer | Password manager share (Bitwarden Send, 1Password) |
| `server.env` | Everything production: database, Firebase Admin private key, Flagsmith admin key, signing and cron secrets, Groq key | Only whoever runs the server, ideally one or two people | Password manager only |

- Never commit either file, paste it into chat, email it or put it in a shared drive. Git ignores both.
- Do not use `server.env` for local development: the app would publish real Flagsmith flags in Production.
- The Groq key is shared, so everyone shares its daily limit. Heavy AI users can make their own free key at
  https://console.groq.com/keys.
- When someone leaves the team, rotate what they had (steps in [HANDOVER.md](../HANDOVER.md), "Rotate after the handover").

## AI (Groq)

- Free limits are per model: 1,000 requests a day and 8,000 tokens a minute for each. When the main model is rate
  limited, retired or failing, the call moves to the fallback model. Voice-note translation starts on the fast model.
- `npm run doctor` checks the key and warns if Groq retires either model. To switch, set `LLM_MODEL` to a model marked
  Production on https://console.groq.com/docs/models.
- AI writes and explains only. Flagsmith decides winners, founders approve shipping, and code fills every number.

## Flagsmith

- Every published deck is a Flagsmith multivariate flag with an experiment. Flagsmith assigns the version each counted
  swiper sees, receives exposure and sign-up events, and its results decide the winner (95% chance to beat the control,
  50 swipers per version, no sample ratio warning). "Approve and ship" writes the winner to the flag.
- Two test decks are live in Production: `deck_pitch-swipe-headline-af2f` and `deck_pitch-swipe-headline-5c45`.
- Until change b, no swiper counted, so live answers never reached Flagsmith. b fixes that once it is deployed.
- Free plan: 50,000 API calls a month, 1 seat, 1 project.

## To go live

Done on 26 Nov 2026: these changes are in `swrno/PitchSwipe-main`, which is live, and `/etc/pitchswipe.env` has
`GROQ_API_KEY`. The old repo's Deploy workflow is disabled, so merging anything there no longer deploys.

For future changes:

1. Open a pull request on `swrno/PitchSwipe-main`, check its CI, then merge it into `main`; it deploys itself after CI
   passes on `main`.
2. If the change needs a new server setting, update `/etc/pitchswipe.env` on the server and run
   `sudo systemctl restart pitchswipe`. `server.env` is the standard copy of the server env: keep it in the password
   manager and update it whenever the server changes.
3. Check `https://noor-api.centralindia.cloudapp.azure.com/api/health` shows the new commit. `npm run doctor` runs in
   a local checkout with the same values (the server has only the built app, not the scripts).

## For the hackathon demo

- Show one full loop on the live site: publish a deck, its flag appears in Flagsmith, people swipe signed in,
  "Test decided", Approve and ship, the flag now serves the winner.
- Use **2 versions** per demo deck: a winner then needs 100 counted swipers instead of 150.
- Keep the feed small. Every deck splits the swipers, and the 5-minute "Test decided" check visits each live deck in
  turn. If the feed needs filling, seed about 6 starter decks, not 100.
- No ML models are needed: the core is the product and Flagsmith running the experiment.

## Still open

- Not deployed: see "To go live".
- Insight wording can repeat a unit ("438 swipers swipers") because the model writes the unit next to a figure that
  already has it. Small; the numbers themselves are filled by code.
- Voice notes work in Chrome, Edge and Safari, not inside the Android and iOS apps.
- No email yet (Resend key and a verified domain), no support email.
- The quality check is off; decide before a wider launch whether to bring it back.
- The terms and privacy notice are unreviewed drafts.
- `AGENTS.md` and `next-env.d.ts` show as changed after `npm run dev`: Next.js rewrites them, leave them out of commits.
