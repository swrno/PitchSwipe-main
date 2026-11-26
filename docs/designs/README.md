# UI designs (v2, 15 Nov 2026 update)

Hi-fi mockups exported losslessly from the design PDFs: **phone** = 41 screens (780×1688 @2x), **web** = 36 screens (2880 px wide @2x, heights vary). Numbered in original deck order. Section dividers are title cards, not screens.
Canvas file names from `spec/08-build-reference.md §13.6` are given in *italics* so you can match code ↔ design ↔ spec.

Tags: **F** founder · **S** swiper · **M** marketing. Routes per `spec/06-experiment-and-architecture.md`.
Visual language: near-black primary buttons, green accent, white cards on light-grey page, bold tight sans headings with a green underline on key words, pill chips, rounded-xl cards. Phone = bottom tab bar (Swipe · Wallet · My decks · Profile); web = left sidebar (same four + "New deck" + user chip). Card accent colour follows the product (green / blue / purple).
Demo content (Voice Khata, Arjun Sen, Priya Nair, all numbers) is specified in `spec/08-build-reference.md` – use it as fixtures.

## Founder (Part 1 — "Test one thing. Then decide.")
| ID | Screen | Route | Phone | Web | Notes |
|---|---|---|---|---|---|
| M1 | Landing | `/` | – | [02](web/02-landing.jpg) *WebLanding* | Hero, founder/swiper sections, pricing (Pitch-only copy) |
| F1 | My decks | `/decks` | [02](phone/02-my-decks.jpg) *AppMyDecks* | [03](web/03-my-decks.jpg) *WebDecks* | Product cards with deck statuses; Plans link; filters All/Live/Drafts/Finished (+Archived); "Ready to ship" status on a deck |
| F1b | My decks + **Test decided** alert | `/decks` | [17](phone/17-my-decks-test-decided-alert.jpg) *AppAssistAlert* | [19](web/19-my-decks-test-decided-alert.jpg) *WebAssistAlert* | Dark alert card: "Voice Khata headline test: B has a 96% chance… Nothing changes until you approve" · Review and ship / Later |
| F2 | Product settings | `/products/[id]`, `/products/new` | [03](phone/03-product-settings.jpg) *AppProduct* | [04](web/04-product-settings.jpg) *WebProduct* | Name+icon, category line (+ one industry), founder shown as, **Target user** role chips ("Made for"; no target question any more), audience: **Who** (Everyone / Target users only), States, Interests, reach |
| F2b | Connect website | `/products/[id]/site` | – | [05](web/05-connect-website.jpg) *WebConnectSite* | JS snippet w/ public client key, `data-pitchswipe="<flag>"` elements, "Connected · snippet seen 2 min ago · 3 elements found", live values; "What happens when you approve" |
| F3 | Deck plans | `/billing` (Pitch only) | [04](phone/04-deck-plans.jpg) *AppDeckPlans* | [06](web/06-deck-plans.jpg) *WebDeckPlans* | Static |
| F4 | New deck – Headline | `/decks/new` | [05](phone/05-new-deck-headline.jpg) *Founder* | [07](web/07-new-deck-headline.jpg) *WebCreate* | **Seven** test-type chips: Headline, Description, Reward, Price, Product UI, Logo, **Language**. Locked "Same on every card" list; Save draft / Test with AI personas / Publish; web has live phone preview + card checker |
| F4 | – Description | same | [06](phone/06-new-deck-description.jpg) *FounderDesc* | [08](web/08-new-deck-description.jpg) | |
| F4 | – Reward | same | [07](phone/07-new-deck-reward.jpg) *FounderReward* | [09](web/09-new-deck-reward.jpg) | |
| F4 | – **Price** | same | [08](phone/08-new-deck-price.jpg) *FounderPrice* | [10](web/10-new-deck-price.jpg) | Toggle **Find the best price** (2–4 prices, same unit → demand curve) vs **Test framing** (same price, different wording) |
| F4 | – Product UI | same | [09](phone/09-new-deck-product-ui.jpg) *FounderShots* | [11](web/11-new-deck-product-ui.jpg) | Screenshot sets per version |
| F4 | – Logo | same | [10](phone/10-new-deck-logo.jpg) *FounderLogo* | [12](web/12-new-deck-logo.jpg) | Named square marks |
| F4 | – **Language** | same | [11](phone/11-new-deck-language.jpg) *FounderLanguage* | [13](web/13-new-deck-language.jpg) *WebCreateLanguage* | English / Hindi / Bengali versions of the whole card (AI-drafted, founder edits); "price and product UI stay the same"; web button "Translate with AI" |
| F5 | AI preview (Simulated + **Unproven**) | modal on `/decks/new` | [12](phone/12-ai-preview.jpg) *FounderAI* | [14](web/14-ai-preview.jpg) *WebAIPreview* | Track record line "right in 1 of 3 finished decks" |
| F6 | Audience and Boost | `/decks/[id]/boost` | [13](phone/13-audience-and-boost.jpg) *AppFounderShare* | [15](web/15-audience-and-boost.jpg) *WebAudience* | Boost budgets (Pitch only), personal link, WhatsApp, LinkedIn (+QR on web) |
| F7 | Results – headline test | `/decks/[id]` | [14](phone/14-results-leaderboard.jpg) *AppFounderResults* | [16](web/16-results-leaderboard.jpg) *WebResults* | **Deck switcher** dropdown + Download icon in header; "Assistant is watching · last check 2 min ago: 91%"; leaderboard; waitlist + CSV; web adds "Why people swiped" incl. **voice-note comments translated**, AI vs Humans, Boost / Ship winner buttons |
| F7b | Results – **price test** (demand curve) | `/decks/[id]` | [15](phone/15-price-results-demand-curve.jpg) *AppPriceResults* | [17](web/17-price-results-demand-curve.jpg) *WebPriceResults* | Join-rate line with range bars + revenue bars side by side, table of every number, Lead card |
| F8 | **Download results** | sheet / dialog | [16](phone/16-download-results-sheet.jpg) *AppDownload* | [18](web/18-download-results-dialog.jpg) *WebDownload* | Scope: This deck / Whole product; files: Results report (PDF), Summary table (Excel/CSV), Every swipe (CSV), Waitlist emails (CSV); zip or email; "Download 3 files" |
| F9 | **Test decided – approve & ship** | sheet / dialog over results | [18](phone/18-test-decided-ship-sheet.jpg) *AppShipWinner* | [20](web/20-test-decided-ship-dialog.jpg) *WebShipWinner* | Chance per card, "When you approve" steps, AI insight, **Keep testing / Approve and ship B** |
| F9b | **Shipped** | sheet / dialog | [19](phone/19-shipped-sheet.jpg) *AppShipped* | [21](web/21-shipped-dialog.jpg) *WebShipped* | Four ticks (experiment completed, flag serves B 100%, A/C left the feed, waitlist kept, website shows B), "Assistant suggests next" + Draft it, **Undo: switch back** / Done |
| F9c | Website shipped before/after | `/decks/[id]` | – | [22](web/22-website-shipped-before-after.jpg) *WebSiteShipped* | Before / after of the founder's site, "updated, no deploy" |
| F10 | Who swiped – Location | `/decks/[id]/who` | [20](phone/20-who-swiped-location.jpg) *AppAudience* | [23](web/23-who-swiped.jpg) *WebAudience* | State tile map, bars, **Lead** tags "Confirm with a test", ≥10 rule |
| F10 | – Target users | same | [21](phone/21-who-swiped-target-users.jpg) *AppAudienceTarget* | same | Split by profile **role** vs product target list (71 + 143 = 214); no question |
| F10 | – Source | same | [23](phone/23-who-swiped-source.jpg) *AppAudienceSource* | same | |
| F10 | – Interests | same | [24](phone/24-who-swiped-interests.jpg) *AppAudienceInterest* | same | |
| F10b | **Deck switcher** | dropdown in header | [22](phone/22-deck-switcher-dropdown.jpg) *AppDeckSwitch* | [24](web/24-who-swiped-deck-switcher.jpg) *WebDeckSwitch* | Lists every deck of the product with status + chance, keeps same page/tab; last item "All decks: product insights" |
| F11 | Product insights | `/products/[id]/insights` | [25](phone/25-product-insights.jpg) *AppInsights* | [25](web/25-product-insights.jpg) *WebInsights* | Winners so far, **Result** vs **Lead** cards with source lines, suggested next test; web: Download + "Ask about results" |
| F12 | **Ask your results** (chat) | `/products/[id]/ask` | [26](phone/26-ask-results-chat.jpg) *AppAsk* | [26](web/26-ask-results-chat.jpg) *WebAsk* | Suggested questions, tool-call lines, bar list / Lead card / deck draft card; web side panel lists tools + components |

## Swiper (Part 2 — "Swipe, claim, earn.")
| ID | Screen | Route | Phone | Web | Notes |
|---|---|---|---|---|---|
| S1 | Create profile (1/3) | `/signup` | [28](phone/28-signup-profile.jpg) *AppSignup* | [28](web/28-signup-profile.jpg) *WebSignup* | **Role** (one, standard list of 11) + Interests (standard industry list of 16) + state + age group + consent. Web = focused page, no sidebar |
| S2 | Verify email (2/3) | `/verify` | [29](phone/29-verify-email.jpg) *AppVerify* | [29](web/29-verify-email.jpg) *WebVerify* | |
| S3 | **Quick quality check** (3/3) | `/practice` | [30](phone/30-quality-check-practice.jpg) *AppQualify* | [30](web/30-quality-check-practice.jpg) *WebQualify* | **30** practice cards, "about 3 minutes left"; practice card on web |
| S4 | Quality result | `/practice/result` | [31 counting](phone/31-quality-result-swipes-counting.jpg) *AppQualifyPass* · [32 not counted](phone/32-quality-result-not-counted.jpg) *AppQualifyWait* | [31](web/31-quality-result.jpg) *WebQualifyResult* | 82 "Swipes counting" → Start swiping; 54 "Not counted yet" → reasons ("Too fast 9 of 30 cards"), **Re-check now: 20 cards**, **Keep swiping (not counted)**, ask a person to review. Nobody is locked out |
| S5 | Swipe home | `/swipe` | [33](phone/33-swipe-home.jpg) *AppHome* | [32](web/32-swipe-home.jpg) *WebHome* | |
| S6 | Swipe card (paid) | `/swipe`, `/d/[slug]` | [34](phone/34-swipe-card-paid.jpg) *Main* · [39](phone/39-swipe-card-paid-queueless.jpg) | [33](web/33-swipe-card.jpg) *WebSwipe* | "Made for Shop owner, Wholesaler" |
| S6b | Swipe card in **Hindi** | same | [35](phone/35-swipe-card-hindi.jpg) *MainHindi* | – | Whole card translated (language test) |
| S6c | Unpaid card | same | [40](phone/40-swipe-card-unpaid-loadmate.jpg) | – | |
| S7 | Claim reward | sheet / dialog | [36](phone/36-claim-reward-sheet.jpg) | [34](web/34-claim-reward-dialog.jpg) *WebClaim* | |
| S8 | Answer saved | sheet / dialog | [37](phone/37-answer-saved-sheet.jpg) *AppDone* | [35](web/35-answer-saved-dialog.jpg) *WebDone* | **No "Is this you?" question any more**: optional comment + **"Or say it in any language · up to 30 s"** |
| S8b | Voice note recording | in sheet | [38](phone/38-answer-saved-voice-note.jpg) *AppVoiceNote* | – | Waveform, "Bengali detected", transcript + English translation, "Let Arjun play my voice note" (off), Delete / Stop and keep |
| S9 | Wallet | `/wallet` | [41](phone/41-wallet.jpg) *AppWallet* | [36](web/36-wallet.jpg) *WebWallet* | Demo earnings, withdraw disabled; web rule "swipes count while quality score ≥70 (now 82)" |

Dividers (ignore): phone 01, 27 · web 01, 27. `AppNotify` (named in spec §13.6) has no separate image in this export.

## Gaps (spec-only, no mockup)
Account/profile edit screen · swipe feed empty state · "Test your own idea" thank-you · Archived filter · move-product dialog · QR view · billing purchase flow · Platform-flag admin · Founder's-guess prompt before publish (idea R1-3) · WhatsApp share-card preview (idea R1-7).
