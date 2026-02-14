---
title: "feat: Breathing Orb + App-Wide Palette Refresh"
type: feat
date: 2026-02-13
---

# Breathing Orb + App-Wide Palette Refresh

## Overview

Add a breathing amber orb as the visual identity of MeOS across the login and home screens, paired with an app-wide palette refresh from soft amber (#D4A574) to brighter amber (#D97706). The orb is a shared component with three variants that adapts to context: hero visual on login, interactive CTA pre-onboarding, ambient backdrop post-onboarding.

## Design Doc

`Docs/plans/2026-02-13-breathing-orb-palette-refresh-design.md`

## Proposed Solution

Single `<BreathingOrb />` client component with `hero | interactive | ambient` variants. App-wide palette token update in `tailwind.config.ts`. Login page redesigned with orb + staggered fade-in. Home page updated for both pre- and post-onboarding states.

## Technical Approach

### Phase 1: Palette Refresh (Foundation)

Update all color tokens first so subsequent work uses the new palette.

**1.1 Update `tailwind.config.ts` color tokens**
- `primary`: `#D4A574` -> `#D97706`
- `primary-hover`: `#C4956A` -> `#B45309`
- `primary-glow`: `rgba(212, 165, 116, 0.3)` -> `rgba(245, 158, 11, 0.3)`
- `bg`: `#FAF7F2` -> `#FDFCF8`
- `shadow-glow`: `0 0 20px rgba(212, 165, 116, 0.25)` -> `0 0 20px rgba(245, 158, 11, 0.25)`
- `status-stable`: KEEP at `#D4A574` (semantic meaning distinct from brand primary)

**1.2 Update `app/layout.tsx`**
- Change `themeColor` in Viewport export from `#D4A574` to `#D97706` (line 21)

**1.3 Update `public/manifest.json`**
- `theme_color`: `#D4A574` -> `#D97706`
- `background_color`: `#FAF7F2` -> `#FDFCF8`

**1.4 Update `public/icons/icon.svg`**
- Change `fill="#D4A574"` to `fill="#D97706"`
- Regenerate `icon-192.png` and `icon-512.png` from updated SVG

**1.5 Update `.claude/skills/meos-design/SKILL.md`**
- Update documented color tokens to reflect new palette values

**1.6 Verify hardcoded color usage**
- Check `components/ui/compounding-engine-card.tsx` `from-amber-50` — this is Tailwind default, likely fine with new primary but verify visually
- Check `components/chat/pulse-check-card.tsx` `bg-amber-50/80` — same

### Phase 2: Animation Keyframes

Add orb animations to `globals.css`. These are complex multi-step keyframes (3-4 stops each, staggered delays) better suited to CSS `@keyframes` than the simple 2-stop keyframes in tailwind config.

**2.1 Add keyframes to `app/globals.css`**

```css
/* Orb animations */
@keyframes orb-breathe {
  0%, 100% { transform: scale(1); opacity: 0.9; }
  50% { transform: scale(1.08); opacity: 1; }
}

@keyframes orb-inner-glow {
  0%, 100% { transform: scale(1); opacity: 0.6; }
  40% { transform: scale(1.12); opacity: 0.85; }
  60% { transform: scale(1.1); opacity: 0.8; }
}

@keyframes orb-halo {
  0%, 100% { transform: scale(1); opacity: 0.3; }
  50% { transform: scale(1.15); opacity: 0.5; }
}

@keyframes ripple-expand {
  0% { transform: scale(1); opacity: 0.12; }
  70% { opacity: 0.03; }
  100% { transform: scale(2.2); opacity: 0; }
}

@keyframes fade-in-up {
  0% { opacity: 0; transform: translateY(16px); }
  100% { opacity: 1; transform: translateY(0); }
}

/* Reduced motion: disable all orb animations */
@media (prefers-reduced-motion: reduce) {
  .orb-animated, .orb-animated * {
    animation: none !important;
    transition: none !important;
  }
}
```

**2.2 Note on `prefers-reduced-motion`:** When reduced motion is active, the orb renders as a static circle with full opacity, no ripples, no breathing. All entrance animations (`fade-in-up`) also skip — content appears immediately.

### Phase 3: BreathingOrb Component

**3.1 Create `components/ui/breathing-orb.tsx`**

Client component (`'use client'`). Props:

```typescript
interface BreathingOrbProps {
  variant: 'hero' | 'interactive' | 'ambient'
  onTap?: () => void
  className?: string
}
```

**Variant behaviors:**

| Variant | Size | Layers | Mic Icon | Ripples | Interactive | ARIA |
|---------|------|--------|----------|---------|-------------|------|
| `hero` | 200px | all 4 | 30% opacity | yes (3 rings) | no | `aria-hidden="true"` |
| `interactive` | 200px | all 4 | 40% opacity | yes (3 rings) | yes (`onTap` + `active:scale-95`) | `role="button"`, `aria-label="Begin life mapping"`, `tabIndex={0}` |
| `ambient` | 160px | core + body + halo (no ripples) | none | no | no | `aria-hidden="true"` |

**Layer structure (inside-out):**

1. **Inner bright core** — `div` with radial gradient (`rgba(255,255,255,0.5)` -> `rgba(252,211,77,0.3)` -> transparent), `orb-inner-glow` animation (7s, 0.3s delay)
2. **Main orb body** — `div` with radial gradient (`#fcd34d` -> `#f59e0b` -> `#d97706`), `orb-breathe` animation (7s), box-shadow for depth. Mic icon centered inside (Lucide `MicIcon` or inline SVG matching existing pattern).
3. **Outer halo** — `div` with radial gradient (`rgba(252,211,77,0.25)` -> transparent), `orb-halo` animation (7s)
4. **Ripple rings** (hero/interactive only) — 3 `div`s with `border border-amber-400/10`, `ripple-expand` animation (5s), staggered via inline `animationDelay` (0s, 1.6s, 3.2s)

**Interactive variant specifics:**
- Wraps the orb in a `<button>` element (not `<Link>`, since we want `onTap` flexibility)
- `active:scale-95` for press feedback via Tailwind
- Keyboard support: `onKeyDown` handler for Enter/Space triggers `onTap`
- `cursor-pointer` class
- Focus ring: `focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2`

**Ambient variant specifics:**
- Reduced opacity on all layers (0.3-0.4 range)
- No ripple rings — only core, body, halo
- `pointer-events-none` to prevent blocking content interaction

**Performance notes:**
- All animations use `transform` and `opacity` only (GPU-compositable, no paint triggers)
- Halo and ripples are separate `div`s with `opacity` animation, NOT `box-shadow` animation
- Apply `will-change: transform, opacity` on orb container

**Responsive sizing:**
- On viewports shorter than 600px: hero/interactive shrink to 160px
- On viewports shorter than 500px: shrink to 140px
- Use Tailwind responsive height classes or CSS `clamp()` on size

### Phase 4: Login Page Redesign

**4.1 Update `app/(auth)/login/page.tsx`**

Replace current layout with orb-centered design:

```
┌─────────────────────┐
│                     │
│   [BreathingOrb]    │  ← hero variant, 200px
│     (breathing)     │
│                     │
│       MeOS          │  ← text-4xl font-bold, fade-in-up 0.3s
│  Your AI partner    │  ← text-lg text-stone-500, fade-in-up 0.5s
│                     │
│  [Google sign in]   │  ← fade-in-up 0.7s, rounded-full
│  or email           │
│                     │
│  Terms · Privacy    │  ← fade-in-up 0.9s
└─────────────────────┘
```

**Staggered entrance:** Each section uses `fade-in-up` with increasing `animationDelay` via inline styles. Use `animation-fill-mode: both` to prevent flash of content before delay elapses.

**Error/loading states:** Unchanged behavior, just repositioned within new layout. Orb continues breathing during loading (provides visual continuity during brief redirect).

**Google OAuth button:** Restyle to `rounded-full` with `shadow-lg shadow-primary/20`.

**Email magic link toggle:** Stays as-is functionally, just inherits new palette via token references.

### Phase 5: Home Screen Updates

**5.1 Update `app/(main)/home/page.tsx` — Pre-onboarding**

Replace the current "Ready to map your life?" section (lines ~28-41):

```tsx
{/* Pre-onboarding: interactive orb */}
<div className="flex flex-col items-center justify-center min-h-[60vh]">
  <p className="text-text-secondary text-lg mb-lg">
    {homeData.greeting}{homeData.firstName ? `, ${homeData.firstName}` : ''}
  </p>
  <BreathingOrb variant="interactive" onTap={handleStartMapping} />
  <p className="mt-md text-stone-400 text-sm">Tap to begin</p>
</div>
```

**Architecture note:** The home page is currently a server component. The `BreathingOrb` is a client component. Two options:

- **Option A (simpler):** Extract the pre-onboarding section into a client component `components/home/pre-onboarding-hero.tsx` that wraps the orb and handles navigation via `useRouter().push('/chat')`.
- **Option B:** Keep the orb's `onTap` as a plain callback and have the orb itself wrap content in a `<Link href="/chat">` when interactive.

**Recommendation: Option A** — extract a small client component. This keeps the orb component generic (it doesn't know about routing) and follows the existing pattern where the page is a server component that composes client components.

**"Tap to begin" should be inside the tappable area** — wrap both orb and text in the interactive container so tapping the text also navigates.

**5.2 Update `app/(main)/home/page.tsx` — Post-onboarding**

Add ambient orb behind the greeting section:

```tsx
{/* Post-onboarding: ambient orb behind greeting */}
<div className="relative">
  <BreathingOrb variant="ambient" className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/4" />
  <div className="relative z-10">
    {/* Existing greeting + sage line + content */}
  </div>
</div>
```

The ambient orb scrolls with content (position absolute within section, NOT fixed). It provides a warm glow behind the top area and naturally scrolls out of view.

## Acceptance Criteria

- [x] `<BreathingOrb />` component renders correctly in all 3 variants
- [x] Login page shows hero orb with staggered fade-in entrance animations
- [x] Login page auth flows (Google OAuth + email magic link) work unchanged
- [x] Home pre-onboarding shows interactive orb; tapping navigates to `/chat`
- [x] Home post-onboarding shows ambient orb behind greeting content
- [x] All app-wide primary color references updated to `#D97706`
- [x] Voice button in chat uses new brighter amber
- [x] PWA manifest `theme_color` and `background_color` updated
- [x] App icon SVG updated with new fill color
- [x] `prefers-reduced-motion` disables all orb animations (static fallback)
- [x] Interactive orb has proper ARIA attributes (`role="button"`, `aria-label`)
- [x] Interactive orb responds to keyboard (Enter/Space)
- [x] Orb renders correctly on viewports as small as 320px wide
- [x] No layout overflow on iPhone SE-size viewport (login page)
- [x] Design skill (`SKILL.md`) updated with new palette values

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `tailwind.config.ts` | MODIFY | Update color tokens, shadow-glow |
| `app/globals.css` | MODIFY | Add orb keyframe animations + reduced-motion rule |
| `app/layout.tsx` | MODIFY | Update themeColor in Viewport export |
| `components/ui/breathing-orb.tsx` | CREATE | Shared orb component |
| `components/home/pre-onboarding-hero.tsx` | CREATE | Client wrapper for interactive orb on home |
| `app/(auth)/login/page.tsx` | MODIFY | Redesign with orb + staggered entrance |
| `app/(main)/home/page.tsx` | MODIFY | Integrate orb in pre/post-onboarding states |
| `public/manifest.json` | MODIFY | Update theme_color + background_color |
| `public/icons/icon.svg` | MODIFY | Update fill color |
| `public/icons/icon-192.png` | REGENERATE | From updated SVG |
| `public/icons/icon-512.png` | REGENERATE | From updated SVG |
| `.claude/skills/meos-design/SKILL.md` | MODIFY | Update documented palette tokens |

## Dependencies & Risks

**Risks:**
- Palette refresh affects every screen — visual regression possible on pages not directly modified. Mitigate by visually checking chat, life-map, and history screens after token changes.
- 200px orb on small viewports could overflow — mitigated by responsive sizing (shrink below 600px height).
- `status-stable` diverges from `primary` for the first time — verify domain cards still look intentional with the old amber.

**Dependencies:**
- Phase 1 (palette) must complete before Phase 3 (component) so the orb uses the correct tokens.
- Phase 2 (keyframes) must complete before Phase 3 (component).
- Phases 4 and 5 depend on Phase 3 (component must exist).
- Icon regeneration (Phase 1.4) requires a tool or manual export.

## Implementation Order

```
Phase 1: Palette Refresh (tailwind.config.ts, layout.tsx, manifest.json, icon.svg, SKILL.md)
    ↓
Phase 2: Animation Keyframes (globals.css)
    ↓
Phase 3: BreathingOrb Component (breathing-orb.tsx)
    ↓
Phase 4: Login Page Redesign (login/page.tsx)     ← can run parallel with Phase 5
Phase 5: Home Screen Updates (home/page.tsx, pre-onboarding-hero.tsx)
```

## References

- Design doc: `Docs/plans/2026-02-13-breathing-orb-palette-refresh-design.md`
- Original proposal: `First_page_idea.zip` (extracted to `/tmp/first_page_idea/`)
- Current voice button: `components/chat/chat-input.tsx:107-161`
- Current login page: `app/(auth)/login/page.tsx`
- Current home page: `app/(main)/home/page.tsx`
- Design system skill: `.claude/skills/meos-design/SKILL.md`
- Tailwind config: `tailwind.config.ts:11-72`
