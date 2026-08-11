---
name: Diageo Sales Presenter
description: In-store field sales PWA for building orders, tracking partnership tiers, and call-file visit compliance
colors:
  brand-magenta: "#b5136b"
  brand-magenta-deep: "#7d0d4a"
  gold: "#c9a24b"
  ink: "#17151a"
  ink-soft: "#5a5560"
  surface: "#fdfcfe"
  canvas: "#f4f2f5"
  border: "#e3dfe6"
  bar-ink: "#0b0b0d"
  status-good: "#1c7b44"
  status-warn: "#966115"
  status-bad: "#c62828"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.2
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif"
    fontSize: "23px"
    fontWeight: 800
    lineHeight: 1.2
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif"
    fontSize: "19px"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1.3
rounded:
  sm: "10px"
  md: "12px"
  lg: "16px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
components:
  button-primary:
    backgroundColor: "{colors.brand-magenta}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    height: "48px"
    padding: "0 18px"
  button-secondary:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    height: "48px"
    padding: "0 18px"
  nav-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "28px 20px"
  product-tile:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "10px"
  modal-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "22px 18px 18px"
---

# Design System: Diageo Sales Presenter

## 1. Overview

**Creative North Star: "The Field Rep's Trade Tool"**

This is a no-build-step, offline-first PWA a Diageo field rep opens mid-conversation, in a store, phone or tablet in hand, often with the store owner watching over their shoulder. Every screen has one job: keep the conversation moving while looking like it belongs to a premium spirits brand's professional sales team, not a generic productivity app. Density is high (data tables, tick lists, running totals) but never cluttered — one accent color (the brand magenta) marks what's actionable, everything else is a calm, barely-tinted neutral that gets out of the way.

This system explicitly rejects generic AI-slop SaaS: no gradient text, no identical icon-and-heading card grids, no "hero metric + small label + gradient accent" dashboard cliché, no decorative glassmorphism, and no side-stripe colored borders as a status shortcut — status reads through a full border-and-tint treatment plus a text label, never color alone.

**Key Characteristics:**
- One accent (brand magenta), used only for primary actions and active state — restrained, not decorative
- Neutrals are barely tinted toward the brand's magenta/violet hue, never pure `#fff`/`#000`
- System font stack only — no external font dependency that could fail on patchy in-store wifi
- Status (red/amber/green) always pairs color with a text label

## 2. Colors

Restrained color strategy: tinted neutrals carry almost the entire surface, with the brand magenta appearing only on primary buttons, active tabs, and selection state.

### Primary
- **Trade Magenta** (`#b5136b`): primary buttons, active nav/tab state, selected toggle state. Used deliberately and sparingly — it marks "this is the action," nothing else.
- **Trade Magenta Deep** (`#7d0d4a`): headings that need brand color without full-saturation weight (card titles, category headers, the brand wordmark), and links/underlined secondary actions.

### Secondary
- **Reward Gold** (`#c9a24b`): reserved for the Partnership Program reward/celebration moment (tier-unlock badge, order-total figure) — gold means "you earned this," and appears nowhere else, so it stays meaningful.

### Neutral
- **Canvas** (`#f4f2f5`): page background and the sunken well behind scrollable lists.
- **Surface** (`#fdfcfe`): cards, tiles, modals, inputs — a hair off pure white, tinted toward the same violet hue as the rest of the neutral ramp rather than `#ffffff`.
- **Ink** (`#17151a`): primary text.
- **Ink Soft** (`#5a5560`): secondary text, meta text, placeholders.
- **Border** (`#e3dfe6`): all hairline borders and dividers.
- **Bar Ink** (`#0b0b0d`): the sticky order-summary bar and reset bar — the one deliberately dark surface in the system, used only for the two persistent bottom action bars so they read as fixed chrome, not page content.

### Status
- **Good** (`#1c7b44`): "on track" / compliant. Darkened from a brighter green specifically to clear WCAG AA (4.5:1) at the small badge sizes it's used at.
- **Warn** (`#966115`): "partial" / needs another visit. Darkened from a brighter amber for the same AA reason — reads as a deep ochre rather than a bright warning color, which also suits the "premium" personality better than a construction-amber would.
- **Bad** (`#c62828`): "not visited" / non-compliant.

### Named Rules
**The One Accent Rule.** Trade Magenta appears only on primary actions and active state. If more than one element per screen is fighting for magenta, something is mis-prioritized.

**The Status-Without-Color Rule.** Every red/amber/green indicator ships with a text label (a status pill or explicit word) next to it. Color reinforces meaning; it never carries it alone.

## 3. Typography

**Display Font:** `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`
**Body Font:** same stack (single-family system throughout)

**Character:** A native system-font pairing, deliberately — no webfont load, no FOUT/FOIT risk, on a PWA that has to keep working over patchy in-store wifi. The personality comes from weight and color, not typeface choice.

### Hierarchy
- **Display** (700, 24px, 1.2): home-page card titles (`.nav-card h2`) — the biggest text in the system, reserved for the four entry points on the dashboard.
- **Headline** (800, 23px, 1.2): section headers within a page (`.category h3`) — bumped up from a prior 18px that sat flush with body text; now a clear step above it.
- **Title** (700, 19px, 1.3): modal titles.
- **Body** (400, 18px, 1.4): the base size for the entire app — large by typical web standards, deliberate given glare/one-handed in-store use.
- **Label** (700, 13px, 1.3): status pills, meta text, badges.

### Named Rules
**The No-Flat-Scale Rule.** Any two text roles appearing near each other differ by at least a 1.2 ratio in size, weight, or both — never same-size-different-color as the only distinction.

## 4. Elevation

Flat by default. Cards and tiles are distinguished by a 1px border, not a shadow — the system leans on borders and background tint for structure. The two exceptions are `.nav-card` and `.tier-hero` (a very soft `0 2px 10px rgba(0,0,0,0.05–0.06)` ambient shadow, barely visible, used only on the home page's entry cards and the Partnership Program poster image) and modals/dropdowns, which get a slightly stronger ambient shadow (`0 8px 24px rgba(0,0,0,0.12–0.15)`) purely to separate them from the page behind, since they float above it.

### Shadow Vocabulary
- **ambient-card** (`box-shadow: 0 2px 10px rgba(0,0,0,0.05)`): home-page nav cards, auth card.
- **ambient-float** (`box-shadow: 0 8px 24px rgba(0,0,0,0.12–0.15)`): dropdown menu, floating progress badge.

### Named Rules
**The Flat-By-Default Rule.** A card is a border and a tint, not a shadow. Shadow is reserved for things that visually float above the page (modals, dropdowns), not things that sit on it.

## 5. Components

### Buttons
- **Shape:** 10px radius, 48px min height (the app's touch-target floor for one-handed in-store use)
- **Primary:** Trade Magenta background, white text, 700 weight
- **Secondary:** Canvas background, Ink text, 1px Border outline
- **Pressed:** `scale(0.97)` on `:active` — an immediate, un-eased tap-feedback shrink
- **Focus:** 2px Trade Magenta outline, 2px offset, shown only on `:focus-visible` (keyboard/assistive tech, never on a tap)

### Cards
- **Corner style:** 16px radius (nav cards, modals) or 12px (store cards, tiles use 16px too via the shared `.tile` class)
- **Background:** Surface
- **Shadow strategy:** none at rest (see Elevation); ambient-card only on the home-page entry cards
- **Border:** 1px Border, or a status-tinted border (see Status colors) on Call File store cards
- **Internal padding:** 10px (tiles) to 28px (home cards), scaled to content density
- **The Nested-Card Rule.** A card never contains another card. Where a colored zone needs to group cards (Partnership Program's tier-colored category bands), the zone is a background tint with no border of its own — the products inside remain the only card layer.

### Status Pills / Tags
- **Style:** background = status color at 12–14% opacity, text = the status color itself, pill radius (999px)
- **Usage:** always paired with a text label ("Not visited", "1 visit", "On track"), never a bare color dot as the only signal

### Inputs / Fields
- **Style:** 1px Border, 12px radius, Surface background, 48px min height
- **Focus:** 2px Trade Magenta outline (shared focus-visible rule)

### Navigation
- **Style:** sticky top header, pill-shaped nav links, active link = Trade Magenta fill + white text. Account (email/logout) collapses behind a circular icon-button dropdown in the top-right corner rather than sitting inline, keeping the header uncluttered on narrow phones.

## 6. Do's and Don'ts

### Do:
- **Do** keep every neutral (background, surface, border, ink) tinted toward the same violet/magenta hue family — never introduce a flat gray.
- **Do** pair every status color with a text label; color is reinforcement, not the only signal.
- **Do** use the system font stack; no webfont load on a PWA that must keep working over patchy in-store wifi.
- **Do** give every interactive element a visible `:focus-visible` ring in Trade Magenta.
- **Do** respect `prefers-reduced-motion` on any celebratory/decorative animation.

### Don't:
- **Don't** use a side-stripe colored border (`border-left`/`border-right`) as a status-indicator shortcut — use a full border + background tint instead.
- **Don't** nest a card inside a card. A colored grouping zone is a background tint with no border of its own.
- **Don't** use gradient text, identical icon-and-heading card grids repeated without variation, the hero-metric-plus-gradient-accent dashboard cliché, or decorative glassmorphism — named anti-references from `PRODUCT.md`.
- **Don't** use `#fff` or `#000` directly for a background or ink token; always a tinted near-neutral.
- **Don't** let more than one element per screen carry the primary accent color as a resting (non-active) state.
