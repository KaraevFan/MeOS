---
status: pending
priority: p3
issue_id: "036"
tags: [code-review, performance, animation, tailwind]
dependencies: []
---

# 036 — Shimmer animation not GPU-composited — potential jank on low-end mobile

## Problem Statement

The shimmer animation in `tailwind.config.ts` uses `translateX` which may not be GPU-composited. It runs continuously during streaming inside a `rounded-full overflow-hidden` container. On low-end mobile devices, this can cause jank due to CPU-painted animation.

## Findings

- **File:** `tailwind.config.ts` — shimmer keyframe definition
- **Evidence:** The shimmer keyframe uses `translateX` without `translate3d` or `will-change` hints, meaning the browser may not promote the element to its own compositor layer. During streaming, the animation runs continuously alongside frequent DOM updates from incoming text, compounding the paint cost.
- Reported by: Performance reviewer (R4.2 code review)

## Proposed Solutions

### Option A — Use `translate3d` in the keyframe (Recommended)

Replace `translateX(...)` with `translate3d(..., 0, 0)` in the shimmer keyframe definition. This forces GPU compositing by hinting to the browser that the element needs a separate layer.

**Pros:** Zero runtime cost, handled entirely by the compositor thread
**Cons:** None
**Effort:** Tiny
**Risk:** None

### Option B — Add `will-change-transform` class to shimmer element

Apply Tailwind's `will-change-transform` utility to the element that uses the shimmer animation.

**Pros:** Explicit intent, easy to apply
**Cons:** `will-change` consumes GPU memory for the lifetime of the element; should be removed when not animating
**Effort:** Tiny
**Risk:** Low — minor GPU memory overhead

## Recommended Action

Option A — use `translate3d` in the keyframe definition. It is the most direct fix with no side effects.

## Technical Details

- **Affected file:** `tailwind.config.ts` (keyframe definition), shimmer consumer component(s)
- **PR:** #20

## Acceptance Criteria

- [ ] Shimmer keyframe uses `translate3d` (or equivalent GPU-composited transform)
- [ ] Animation remains visually identical
- [ ] No layout shift or visual regression on mobile Safari and Chrome

## Work Log

- 2026-02-19: Created from PR #20 R4.2 code review (Performance reviewer)
