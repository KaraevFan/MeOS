---
title: "BreathingOrb Component: Type Safety, GPU Memory Waste, and Animation Inefficiencies"
date: 2026-02-14
category: performance-issues
tags: [react, type-safety, css-animations, gpu-memory, performance, variant-design]
modules: [breathing-orb, home, login, pre-onboarding]
severity: medium
---

# BreathingOrb Component Optimization

## Problem

After initial implementation of a `<BreathingOrb />` component (animated amber orb used on login and home screens), a code review identified P1 and P2 issues:

**P1 (Critical):**
1. **Type safety gap**: `onTap` callback was optional but the `interactive` variant assumed it existed. The 3-variant enum (`hero | interactive | ambient`) was a poor discriminant — `hero` and `interactive` were visually identical.
2. **GPU memory waste**: `will-change: transform, opacity` set persistently on an always-rendered element, consuming 56-112MB GPU memory unnecessarily.

**P2 (Important):**
1. Duplicate size/haloSize configs for hero and interactive variants.
2. Two nearly-identical wrapper components (`PreOnboardingHero` + `TalkToSageOrb`, 48 LOC) each doing `useRouter().push('/chat')` + render orb.
3. Three ripple ring animations where two suffice visually.
4. Login page fade-in delays (0.3-0.9s) blocking interactivity for ~700ms.
5. Inline style objects recreated every render.

## Solution

### 1. Collapsed Variants

**Before:**
```typescript
type BreathingOrbVariant = 'hero' | 'interactive' | 'ambient'
// hero and interactive were visually identical
```

**After:**
```typescript
type BreathingOrbVariant = 'full' | 'ambient'
// 'full' is default; interactivity determined by onTap presence
```

Interactivity is now determined by `onTap` prop presence: if provided, renders as `<button>`; otherwise renders as decorative `<div>`. This eliminates the type safety gap entirely.

### 2. Removed Persistent `will-change`

Deleted `style={{ willChange: 'transform, opacity' }}` from the orb container. Modern browsers automatically promote elements animated with `transform` and `opacity` to GPU layers. The explicit declaration was redundant and prevented the browser's natural layer optimization.

### 3. Consolidated Wrapper Components

Deleted `components/home/talk-to-sage-orb.tsx`. Moved `TalkToSageOrb` export into `components/home/pre-onboarding-hero.tsx`. One file, one `'use client'` directive, shared imports. Consumers import both from one location.

### 4. Reduced Ripples 3 → 2

```typescript
// Before
const ripples = [0, 1.6, 3.2]

// After
const RIPPLE_DELAYS = [0, 2.5]
```

Visually equivalent with one fewer DOM element and smoother timing.

### 5. Halved Login Animation Delays

```typescript
// Before: 0.3/0.5/0.7/0.9s delays, 0.8s duration → form interactive after ~1.2s
// After: 0.15/0.25/0.35/0.45s delays, 0.6s duration → form interactive after ~0.6s
```

Users can interact with auth form 300ms sooner.

### 6. Extracted Inline Styles to Constants

```typescript
const haloStyle = {
  background: 'radial-gradient(...)',
  animation: 'orb-halo 7s ease-in-out infinite',
} as const

const bodyStyle = { ... } as const
const coreStyle = { ... } as const
const RIPPLE_DELAYS = [0, 2.5]
```

Prevents object recreation on every render, stable references for React reconciliation.

## Files Changed

| File | Change |
|------|--------|
| `components/ui/breathing-orb.tsx` | Rewrote: 2 variants, no will-change, 2 ripples, extracted styles |
| `components/home/pre-onboarding-hero.tsx` | Added `TalkToSageOrb` export |
| `components/home/talk-to-sage-orb.tsx` | **Deleted** |
| `app/(main)/home/page.tsx` | Updated import path |
| `app/(auth)/login/page.tsx` | Removed `variant="hero"`, halved animation delays |

## Prevention

### Variant API Design
- **Prefer behavior-driven variants over visual diffs.** When two variants differ only in an optional callback, merge them. Reserve separate variants for structural or interaction model changes.
- **Audit variant proliferation.** Before adding a new variant, ask: "Does this change how users interact, or just how it looks?"

### GPU Memory & `will-change`
- **Never apply `will-change` to always-rendered elements.** Reserve for elements that animate intermittently. Always-on `will-change` forces GPU layer creation, compounding memory cost.
- **Profile before optimizing.** Use DevTools Performance tab to detect actual repaints before adding `will-change`.

### Wrapper Components
- **Question wrapper necessity.** If a wrapper only passes props through or calls one hook, it's probably unnecessary indirection. Consolidate.

### Static Style Objects
- **Define style objects outside component scope.** Inline `style={{ ... }}` recreated per render defeats reference equality. Move to module level or use `useMemo`.

### Animation Delays
- **Delays should not block user input.** Keep total entrance animation under 500ms for interactive pages. Measure Time to Interactive.

## Related Documentation

- Design spec: `Docs/plans/2026-02-13-breathing-orb-palette-refresh-design.md`
- Implementation plan: `Docs/plans/2026-02-13-feat-breathing-orb-palette-refresh-plan.md`
- Design system: `.claude/skills/meos-design/SKILL.md`
