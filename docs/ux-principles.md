# PitchSwipe UX principles

The rules every screen follows. Based on the Laws of UX (Jon Yablonski, lawsofux.com) and WCAG 2.2 AA, turned into
concrete checks for this product. Two audiences: **founders** test pitches, **swipers** answer cards.

## Psychology → rule

| Law | What it says | Rule in PitchSwipe |
| --- | --- | --- |
| Jakob's law | People expect your app to work like the ones they know. | Standard patterns only: left sidebar, top-right account menu, breadcrumbs, swipe right = yes, Esc closes, Enter submits. No novel controls. |
| Hick's law | More choices = slower decisions. | **One primary action per screen** (filled button). Everything else is secondary (outline) or tertiary (text link). Max ~5 nav items per group; hide advanced options behind "More" / disclosure. |
| Fitts's law | Big, near targets are faster to hit. | Touch targets ≥ 44×44 px; primary buttons full-width on phones; the main action sits where the eye/thumb already is (bottom on phone, top-right of the content on web). |
| Miller's law | Working memory holds ~7±2 chunks. | Chunk long content: group into cards of related info, ≤ 4 KPI tiles per row, ≤ 7 rows before "View all". |
| Law of proximity / common region | Things close together, or inside one border, read as one group. | Related controls live in the same card; 8px between related items, 24px between groups, 32–48px between sections. Labels sit directly above their field. |
| Law of similarity | Similar-looking things are read as the same kind. | One style per element type: all status pills look alike, all secondary buttons look alike, all cards share radius/border. |
| Von Restorff (isolation) | The one different thing gets noticed. | The accent colour is reserved for the single most important thing on screen (primary action, key positive number, active nav). Never decorate with it. |
| Serial position | First and last items are remembered best. | Put the most important info first (title, key number) and the next step last (CTA at the end of a flow/card). |
| Aesthetic-usability | Polished UIs feel easier to use. | Consistent spacing scale (4/8/12/16/24/32/48), aligned edges, no orphaned text, consistent radius (`rounded-xl` cards, `rounded-lg` buttons). |
| Doherty threshold | Responses under 400 ms keep people engaged. | Every action gives feedback < 100 ms (pressed state, spinner, optimistic UI). Loading shows **skeletons that match the final layout**, never blank pages. |
| Goal-gradient | People speed up as they near a goal. | Show progress: test wizard steps ("Step 2 of 4"), wallet progress to Rs 100, tests left, swipers toward a decision. |
| Zeigarnik effect | Unfinished tasks stay on the mind. | Surface unfinished work: drafts, "Needs your review", incomplete profile — with a direct link to finish. |
| Peak-end rule | Experiences are judged by their peak and their end. | Make the end of key flows feel good: clear success state after publishing a test, claiming a reward, finishing practice — with what happens next. |
| Tesler's law | Complexity can't vanish; someone must absorb it. | The product absorbs it: smart defaults, AI drafts, prefilled fields; never ask for what we can infer. |
| Postel's law | Be liberal in what you accept. | Forgiving inputs (trim spaces, accept "Rs 299" or "299"), helpful inline errors that say how to fix it. |
| Cognitive load | Every extra word costs attention. | Microcopy: short, plain, verb-first buttons ("Publish test", not "Submit"); one idea per sentence; no jargon ("Flagsmith experiment" only where the founder needs it). |

## Visual system

- **Type scale**: page title `text-2xl md:text-3xl font-semibold tracking-tight`; section title `text-lg font-semibold`; body `text-sm`/`text-base`; meta `text-xs text-muted-foreground`. Max 3 sizes per card.
- **Colour**: neutrals for surfaces and text; one accent; `warning` only for warnings, `destructive` only for destructive actions. Text contrast ≥ 4.5:1 (WCAG AA), large text ≥ 3:1, both themes.
- **Numbers**: `tnum` for all figures; right-align numbers in lists; units small and muted ("Rs 299 / mo").
- **States**: every data view has loading (skeleton), empty (what it is + one action), error (what happened + retry) and success states.
- **Status pills**: one component look: `rounded-md border px-2 py-0.5 text-xs`; neutral by default, accent only for good news.
- **Coming soon**: features that do not work yet are visibly marked "Coming soon" and disabled; never a button that silently does nothing.

## Accessibility (WCAG 2.2 AA)

Visible focus ring on every interactive element; keyboard reachable; aria-labels on icon-only buttons; `aria-live` for async results;
respect `prefers-reduced-motion`; never colour alone to convey state.
