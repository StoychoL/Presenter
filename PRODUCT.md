# Product

## Register

product

## Users

Diageo field sales reps, using the app live in-store on a phone or tablet while standing in front of a store owner or client. Screen is often visible to the client during the visit, not just the rep. Lighting varies widely: bright daylight through shop windows, dim stockrooms, sometimes operated one-handed while holding stock or a clipboard.

## Product Purpose

Three jobs in one app: build a live drinks order with running totals during a client conversation (Product Presenter), track partnership-program tier progress for a store against reward thresholds (Partnership Program), and track call-file visit compliance across a rep's store list (Call File). Success looks like a rep moving fast enough to keep the conversation flowing, while the interface itself reads as credible and premium if the client glances at the screen.

## Brand Personality

Confident, premium, efficient. This represents a premium spirits brand's professional field sales team, not a startup or a consumer app. Functional clarity earns trust here more than decoration; the tool should feel like it belongs in the hand of someone selling Johnnie Walker and Guinness, not a generic productivity app.

## Anti-references

Generic AI-slop SaaS patterns: gradient text, identical icon-and-heading card grids repeated without variation, the "hero metric + small label + gradient accent" dashboard cliché, glassmorphism used decoratively rather than purposefully, side-stripe colored borders as a status-indicator shortcut.

## Design Principles

- Functional clarity over decoration — every element earns its place in a fast, in-store workflow.
- Premium at a glance — the interface must read as credible even to a client seeing it for a few seconds over the rep's shoulder.
- Offline-reliable by construction — no external font or asset dependency that could fail on patchy in-store wifi (this is a no-build-step PWA with an explicit offline-first service worker).
- One accent, used deliberately — the brand magenta marks primary actions and active state, not every element.
- Status is legible without color alone — red/amber/green compliance states pair color with text labels, never color as the sole signal.

## Accessibility & Inclusion

WCAG AA minimum. Real-world glare tolerance matters as much as lab contrast ratios — reps use this in direct sunlight through shop windows and in dim stockrooms. Touch targets are 48px minimum (the app's `--tap` token) to stay usable one-handed.
