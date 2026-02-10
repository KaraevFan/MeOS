---
name: meos-design
description: Use when building any MeOS frontend component, page, or layout. Enforces the warm, conversational design system — prevents generic AI aesthetics and maintains visual consistency across the app. Triggers on any UI, component, page, or styling work.
---

# MeOS Design System Skill

Read `UX_design.md` for full design philosophy and screen specs before building any UI.

## Aesthetic Identity: Warm Journal Meets Calm Conversation

MeOS feels like a beautifully designed personal journal crossed with talking to a wise friend. NOT a dashboard. NOT a productivity tool. NOT a clinical interface. Every pixel should feel warm, human, and intentional.

## Design Tokens

```
/* Palette */
--color-primary: #D4A574;        /* Warm amber/gold — voice button, key CTAs */
--color-primary-hover: #C4956A;
--color-primary-glow: rgba(212, 165, 116, 0.3);  /* Voice button pulse */
--color-bg: #FAF7F2;             /* Warm cream — NOT pure white */
--color-bg-sage: #F5F0E8;        /* Sage message background */
--color-bg-card: #FFFFFF;         /* Cards get true white for lift */
--color-text: #3D3832;           /* Dark warm gray — NOT pure black */
--color-text-secondary: #8A7E74;
--color-border: rgba(61, 56, 50, 0.08);
--color-accent-sage: #7D8E7B;    /* Sage green — domain status, accents */
--color-accent-terra: #C17B5D;   /* Terracotta — warmth accents */
--color-accent-navy: #5B6B7A;    /* Soft navy — secondary actions */

/* Domain status */
--status-thriving: #7D8E7B;      /* Sage green */
--status-stable: #D4A574;        /* Warm amber */
--status-attention: #C17B5D;     /* Terracotta */
--status-crisis: #B05A5A;        /* Muted red — never aggressive */

/* Spacing — 4px base */
--space-xs: 4px;
--space-sm: 8px;
--space-md: 16px;
--space-lg: 24px;
--space-xl: 32px;
--space-2xl: 48px;

/* Radius */
--radius-sm: 8px;
--radius-md: 12px;
--radius-lg: 20px;
--radius-full: 9999px;          /* Voice button, avatars */

/* Shadows — warm tinted, never cool gray */
--shadow-sm: 0 1px 3px rgba(61, 56, 50, 0.06);
--shadow-md: 0 4px 12px rgba(61, 56, 50, 0.08);
--shadow-glow: 0 0 20px rgba(212, 165, 116, 0.25);  /* Voice button active */
```

## Typography

Use **Satoshi** (primary) or **DM Sans** as fallback. Load from Fontshare or Google Fonts. NEVER use Inter, Roboto, Arial, Open Sans, or system-ui defaults.

- Headings: Satoshi Bold (700), tracking tight (-0.02em)
- Body: Satoshi Regular (400), line-height 1.6, 16px base
- Sage messages: Satoshi Regular, slightly warmer bg, generous padding
- Small/meta text: Satoshi Medium (500), 13px, secondary color, tracking wide (0.02em)
- Size scale: 13 / 15 / 16 / 20 / 24 / 32 — restrained, not dramatic

## Component Patterns

**Voice Button (hero element):**
- 64px circle, `--color-primary` fill, centered bottom of chat view
- Idle: subtle CSS pulse animation (scale 1.0→1.03, 3s ease-in-out infinite)
- Recording: grows to 72px, deeper amber, ripple animation outward
- Processing: gentle spinner or dot pulse, "Processing..." label
- Must feel like an invitation, not a utilitarian button

**Chat Bubbles:**
- User: right-aligned, `--color-bg` with subtle border, rounded-lg
- Sage: left-aligned, `--color-bg-sage`, left border 3px `--color-accent-sage`, rounded-lg
- Max-width 85% on mobile. Generous padding (16px).

**Domain Cards (inline in chat):**
- Full-width, `--color-bg-card` with `--shadow-md`, rounded-lg
- Status dot (8px circle) top-right with domain status color
- Structured fields with `--color-text-secondary` labels, `--color-text` values
- Subtle edit icon (pencil) top-right, appears on hover/tap
- Visually distinct from chat bubbles — elevated, structured

**Quick-Reply Buttons (after domain cards):**
- Pill-shaped, `--color-bg` with `--color-border` border
- On tap: fill with `--color-primary`, white text
- Horizontal scroll on mobile if overflow
- Reduce decision fatigue — always include "Wrap up" option

**Bottom Tab Bar:**
- 4 tabs: Home, Chat, Life Map, History
- Active tab: `--color-primary` icon + label
- Inactive: `--color-text-secondary`
- Subtle top border, cream background

## Anti-Patterns — NEVER Do These

- Purple or blue gradients anywhere
- Pure white (#FFFFFF) backgrounds on pages (use cream)
- Pure black text (use warm gray)
- Cold gray borders or shadows
- Metric dashboards, progress bars, or gamification
- Dense information layouts — let content breathe
- Generic hero sections or marketing patterns in the app
- Guilt-inducing streaks, scores, or red warning badges
- Stiff, clinical layouts — this is a conversation, not a spreadsheet
- Emojis as design elements (icons only)

## Motion

- Page transitions: subtle fade (150ms ease)
- Cards appearing: fade-up (translateY 8px → 0, 200ms ease-out)
- Voice button pulse: CSS only, `@keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.03); } }`
- Domain cards entering chat: slide-up with slight delay after Sage message
- No bouncy, playful animations — keep it calm and considered
- Prefer `transition` over `animation` where possible

## Accessibility

- Touch targets minimum 44px
- Focus rings: 2px `--color-primary` with 2px offset
- Color contrast: all text passes WCAG AA on its background
- Voice input as primary removes typing barriers
- Screen reader labels on all interactive elements
