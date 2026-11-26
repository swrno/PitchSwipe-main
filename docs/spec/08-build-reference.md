# 08 · Build reference: demo numbers, labels, lists, screen names

Section 13. Use these exact numbers and strings in fixtures and UI copy.

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

