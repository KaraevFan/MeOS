---
status: pending
priority: p3
issue_id: "018"
tags: [code-review, accessibility, animations]
dependencies: []
---

# 018 — `prefers-reduced-motion` doesn't cover `animate-orb-breathe` and `animate-orb-inner-glow`

## Problem Statement

`globals.css` has a `prefers-reduced-motion` block that suppresses some animations, but `animate-orb-breathe` and `animate-orb-inner-glow` (used on the FAB orb in `bottom-tab-bar.tsx`) are not covered. Users who prefer reduced motion see a continuously breathing/glowing orb.

## Findings

- **File:** `app/globals.css:51` — existing `@media (prefers-reduced-motion: reduce)` block
- **File:** `components/ui/bottom-tab-bar.tsx:113, 119` — `animate-orb-breathe`, `animate-orb-inner-glow`
- Reported by: Performance reviewer (P3 — accessibility gap)

## Fix

Add to the existing `prefers-reduced-motion` block in `globals.css`:

```css
@media (prefers-reduced-motion: reduce) {
  /* existing rules */
  .animate-orb-breathe,
  .animate-orb-inner-glow {
    animation: none;
  }
}
```

**Effort:** Tiny
**Risk:** None

## Acceptance Criteria

- [ ] Orb animations suppressed for users with `prefers-reduced-motion: reduce`
- [ ] Orb is still visible and functional (just static)

## Work Log

- 2026-02-19: Created from PR #19 code review (Performance reviewer P3)
