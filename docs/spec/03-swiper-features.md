# 03 · Swiper features, standard lists, voice comments

Sections 5.2, 5.12, 5.14.

### 5.2 For Swipers

| Feature | Description |
|---|---|
| No sign-up | Opens straight from a link, built for mobile |
| Target check | No extra question. With one login, every swiper's profile already has a role, so the founder's results split into target users vs everyone else automatically. The "Answer saved" pop-up only asks for an optional one-line comment. Interests chosen in the profile or on the home screen decide which decks they get |
| Swiping | Swipe gestures or left and right buttons, with card animation |
| Answer | Pick the positive or negative answer by tapping it or swiping right or left |
| Claim reward | Swipers set and verify their email once (one-time code) in their profile. After a positive answer, they tap the reward button; a sheet shows the verified email that will be shared with this founder, and one more tap claims it. No typing each time, but every claim is an explicit tap, so the email is only shared with founders the swiper chooses. The screen says the founder will contact them at launch or before. Optional; "Skip" continues swiping |
| Swipe feed | Founders can run many decks at once. The feed shows live decks in a random order, so every deck gets a fair share of swipers and no swiper picks what they see. Each swiper sees a deck only once, and Flagsmith picks which card of that deck they get. *(Built, 26 Nov 2026: the random pick is weighted, never sorted: x2 when the swiper is a target user of the product, x1.5 when its industry is one of the swiper's interests, x0.25 for house starter decks, so founders' decks get most swipers. It only picks the deck, never the card. `src/features/swipe/ordering.ts` feedWeight.)* Later, Boost raises a deck's chance of being picked; the order stays random **(Pitch only)** |
| Earnings | Hackathon: demo earnings, Rs 0.25 per valid swipe on paid cards, in a wallet with history, labelled "Demo earnings"; withdraw button disabled. Later: real pay on boosted decks and UPI withdrawal from Rs 100 **(Pitch only)** |
| Feedback | Optional one-line "why?" |
| Growth loop | Thank-you screen with "Next deck" and "Test your own idea" |


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

