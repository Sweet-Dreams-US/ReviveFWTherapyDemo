# REVIVE Fitness & Recovery — Website Demo

A pitch demo built for **Revive Fitness & Recovery** (Fort Wayne, IN), produced by **Sweet Dreams Studios**. Vanilla HTML/CSS/JS, deployed via GitHub Pages — zero build step, zero dependencies, instant load.

**Live demo:** https://sweet-dreams-us.github.io/ReviveFWTherapyDemo/

---

## Pages

| Route | Purpose |
|---|---|
| `/` (`index.html`) | Landing — hero, three pillars, mission, founders CTA |
| `/about.html` | Story — founder narrative, the why, what makes us different |
| `/experience.html` | Inside the gym — train / recover / belong with tabs + day timeline |
| `/pricing.html` | Three tiers + founders/standard toggle + comparison table + FAQ |
| `/join.html` | Founders 200 waitlist — split layout with form |
| `/giveaway.html` | Morgan Wallen tickets contest — countdown, entry form, rules |
| `/admin.html` | Internal operator dashboard (mock data, demo only) |
| `/404.html` | Lost page |

## Aesthetic

Editorial luxury wellness × brutalist athleticism — a deliberate departure from box-gym design language. Inspired by Equinox, Othership, Aesop, Continuum Club.

- **Type**: Anton (display), Cormorant Garamond italic (editorial), Manrope (body), JetBrains Mono (technical accents)
- **Palette**: warm-tinted blacks · revive red `#FF3819` · ice cyan accent · cream warmth · gold for founders
- **Effects**: film-grain overlay, scroll reveals, marquees, blend-mode nav, animated counters, live countdown

## Tech

- Pure HTML / CSS / JS — no framework, no bundler
- Google Fonts via CDN
- Unsplash for hero/lifestyle imagery
- IntersectionObserver for scroll-triggered reveals
- `.nojekyll` so GitHub Pages serves files as-is
- Forms are demo-only (log to console + show success state)

## Deploy

Push to `main`. In repo settings, enable GitHub Pages from the `main` branch root. Done.

## Notes for the client

- All form submissions are local-only — no backend wired up
- Member counts (153/200, 47 remaining, etc.) are illustrative
- Admin dashboard data is mock — included to show what an operator panel could look like
- Imagery is placeholder; final shoot recommended for opening week

## Built by

[Sweet Dreams Studios](https://sweetdreamsmusic.com) · Fort Wayne, IN
