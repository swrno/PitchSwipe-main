# PitchSwipe marketing landing: old static draft

The live landing page now lives in the Next.js app at `src/app/page.tsx` (route `/`), with its sections in
`src/components/landing/`. The app also ships `src/app/opengraph-image.tsx` (share image), `src/app/robots.ts` and
`src/app/sitemap.ts`. Change the landing there, not here.

This folder is the earlier static, dependency-free draft (WP16). The app's landing was ported from its copy. It is
kept for reference only and is not deployed.

- `index.html`: the old landing draft (hero, founders, how the test works, swipers, pricing, waitlist, footer)
- `styles.css`: its styling (mobile first, 16px side gutter)
- `demo-site/voice-khata/index.html`: a made-up founder website (Voice Khata) with the PitchSwipe snippet, used to
  show "ship to your website" in the demo. `src/lib/sites/tests/sites.test.ts` checks that its snippet matches
  `src/lib/sites/snippet.ts`. Nothing in the app reads it.

Differences in the app version: the waitlist form is gone (the calls to action go to sign up and to /swipe; in demo
mode the founder buttons go straight to /decks/new, so the page renders per request), the swipers section leads with
"See new ideas first" and labels earnings "Demo earnings for now, payouts later", the Free plan says only what is
true today (live decks show in the swipe feed and get a share link, no deck limit during the pilot), and the paid
plans are marked "Planned pricing, not available yet".

`/` is the public landing, not the app home. In-app logo links should point at `/swipe`, and the Android shell's
`CAP_SERVER_URL` should include `/swipe` so the app does not open on the landing.
