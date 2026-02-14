# Breathing Orb + Palette Refresh Design

**Date:** 2026-02-13
**Status:** Approved

## What We're Building

A breathing amber orb that serves as the visual identity of MeOS across the login screen and home screen, paired with an app-wide palette refresh to a brighter, more vivid amber.

## Why This Approach

The current app lacks a dedicated landing experience — unauthenticated users go straight to a login form. The orb introduces a living, warm presence that communicates "alive and listening" before users interact. Making it a shared component with variants keeps it consistent across contexts while allowing context-appropriate behavior.

## Key Decisions

1. **Orb placement:** Login page (merged with auth) AND home screen
2. **Context-dependent behavior:** Pre-onboarding = interactive CTA (tap to start life mapping). Post-onboarding = ambient background presence behind content.
3. **Shared component:** Single `<BreathingOrb />` with `hero`, `interactive`, and `ambient` variants
4. **App-wide palette refresh:** Shift from soft amber (#D4A574) to brighter amber (#D97706) across all tokens
5. **CSS keyframe animations:** Pure CSS, no animation libraries

## Component: `<BreathingOrb />`

**Location:** `components/ui/breathing-orb.tsx` (client component)

### Variants

| Variant | Where | Size | Behavior |
|---------|-------|------|----------|
| `hero` | Login page | 200px | Full glow, ripples, mic icon (30% opacity). Not clickable. |
| `interactive` | Home (pre-onboarding) | 200px | Same as hero but tappable — navigates to `/chat` (life_mapping). Mic icon slightly more visible. |
| `ambient` | Home (post-onboarding) | 160px | Reduced opacity (0.3-0.4), no ripples, no mic icon. Breathes subtly behind greeting. Positioned absolute, top-center, z-0. |

### Layers (inside-out)

1. **Inner bright core** — white-to-amber radial gradient, pulses independently (7s cycle, 0.3s delay)
2. **Main orb body** — amber radial gradient (`#fcd34d` -> `#f59e0b` -> `#d97706`), breathes scale 1->1.08 (7s cycle)
3. **Outer halo** — soft ambient glow, scales 1->1.15 (7s cycle)
4. **Ripple rings** (hero/interactive only) — 3 rings, staggered 5s animation, expand to 2.2x and fade out

### Props

- `variant: 'hero' | 'interactive' | 'ambient'`
- `onTap?: () => void` (for interactive variant)
- `className?: string` (positioning overrides)

## Login Page Redesign

**File:** `app/(auth)/login/page.tsx`

### Layout (top to bottom, staggered fade-in-up)

1. `<BreathingOrb variant="hero" />` — center-top, dominant visual
2. "MeOS" — `text-4xl font-bold text-stone-900`, fade-in at 0.3s
3. "Your AI life partner" — `text-lg text-stone-500`, fade-in at 0.5s
4. Auth section — Google OAuth button + email magic link toggle, fade-in at 0.7s. Buttons get rounded-full + amber shadow.
5. Terms & Privacy — small text, fade-in at 0.9s

Auth flows unchanged: Google OAuth + email OTP, same error/loading states.

## Home Screen Updates

### Pre-onboarding state

Replaces current "Ready to map your life?" UI:

1. Greeting ("Good morning, [name]") — above orb
2. `<BreathingOrb variant="interactive" onTap={navigateToChat} />` — center of screen
3. "Tap to begin" — subtle prompt below orb, `text-stone-400 text-sm`
4. Tap navigates to `/chat` with session type `life_mapping`

### Post-onboarding state

Current home content stays, gains orb as atmosphere:

1. `<BreathingOrb variant="ambient" />` — positioned absolute, top-center, behind greeting area, z-0
2. Greeting + Sage line — layered on top (z-10), fully readable
3. Compounding Engine card, priorities, check-in card — below, unchanged

## App-Wide Palette Refresh

### Token changes in `tailwind.config.ts`

| Token | Current | New |
|-------|---------|-----|
| `primary` | `#D4A574` | `#D97706` |
| `primary-hover` | `#C4956A` | `#B45309` |
| `primary-glow` | `rgba(212,165,116,0.3)` | `rgba(245,158,11,0.3)` |
| `bg` | `#FAF7F2` | `#FDFCF8` |

### Impact

- Voice button in chat: brighter amber (uses `bg-primary`)
- Bottom tab bar active state: brighter highlights
- Primary buttons: more vivid amber
- Shadow-glow: updated to new glow value
- Theme-color meta tag: updated to `#D97706`

### Unchanged

Stone scale (grays), accent colors (sage green, terracotta, navy), text colors, spacing, typography.

## Animation System

New keyframes in `globals.css`:

```
orb-breathe:      7s ease-in-out infinite — scale 1 -> 1.08, opacity 0.9 -> 1
orb-inner-glow:   7s ease-in-out infinite — independent inner core pulse
orb-halo:         7s ease-in-out infinite — halo scale 1 -> 1.15, opacity 0.3 -> 0.5
ripple-expand:    5s ease-out infinite    — 3 rings (staggered 0/1.6s/3.2s), scale 1 -> 2.2, fade out
fade-in-up:       0.8s ease-out           — translateY(16px) -> 0, opacity 0 -> 1
```

These supplement existing `pulse` and `fade-up` animations.

## Files Affected

- `components/ui/breathing-orb.tsx` — NEW: shared orb component
- `app/(auth)/login/page.tsx` — MODIFY: integrate orb, staggered entrance
- `app/(main)/home/page.tsx` — MODIFY: orb in pre/post-onboarding states
- `app/globals.css` — MODIFY: add orb keyframe animations
- `tailwind.config.ts` — MODIFY: update color tokens
- `app/layout.tsx` — MODIFY: update theme-color meta tag
