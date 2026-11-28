# PitchSwipe information architecture

Chosen by the product owner: **workspace + tabs**. One sidebar, one page template, sub-pages as tabs.
Rules for every screen: docs/ux-principles.md.

## Sidebar (web)

```
PitchSwipe
⌂  Overview                 /overview
▦  Products                 /products            (expands to the founder's products)
     · Mess Menu Daily      /products/[id]
     · Appointment Pad      ...
     + New product          /products/new
⇄  Swipe                    /swipe
◫  Earnings      Rs 0.00    /wallet
⚙  Settings                 /profile
───────────────
980 of 1,000 tests left  →  /settings/plan
[ + New test ]              /decks/new
« Collapse
```
No section labels (five items do not need them). Products expands to show the products (max 8 + "All products").
Phone tab bar: Swipe · Earnings · Products · Settings.

## Page template (every signed-in page)

1. **Top bar**: the only breadcrumb, built from the route with real names: `Products › Mess Menu Daily › Headline test`.
   No in-page breadcrumbs anywhere.
2. **Page header**: title, one-line description (muted), at most one primary action + one secondary on the right.
3. **Tabs** (when the page has sub-pages), links with the active one underlined in the accent.
4. **Content**: same max width for every page (`max-w-[1200px]`), sections in cards, `space-y-6`.

## Pages and tabs

| Page | Route | Tabs |
| --- | --- | --- |
| Overview | /overview | – |
| Products | /products | – (list of products, each with its tests summary) |
| Product | /products/[id] | **Tests** /products/[id] · **Insights** /products/[id]/insights · **Website** /products/[id]/site · **Settings** /products/[id]/settings |
| Test | /decks/[id] | **Results** /decks/[id] · **Audience & Boost** /decks/[id]/boost · **Share** /decks/[id]/share |
| New test | /decks/new | – (wizard with step progress) |
| Swipe | /swipe | – |
| Earnings | /wallet | **Wallet** /wallet · **History** /history |
| Settings | /profile | **Profile** /profile · **Appearance** /appearance · **Plan** /settings/plan |

Redirects keep old links working: /decks → /products, /decks/plans → /settings/plan, /insights and /results → /products.
