---
status: pending
priority: p3
issue_id: "037"
tags: [code-review, performance, framer-motion, life-map-pill]
dependencies: []
---

# 037 — `DomainSlotCompact` applies Framer Motion animation props unconditionally — wasted controllers

## Problem Statement

In `domain-slot-compact.tsx`, all 8 `DomainSlotCompact` instances receive `animate={{ scale: 1 }}` even when `justCompleted` is false, creating unnecessary Framer Motion animation controllers. Only the one just-completed domain needs animation. The remaining 7 instances pay the cost of Framer Motion's layout effect subscriptions and spring solvers for no visual benefit.

## Findings

- **File:** `components/chat/domain-slot-compact.tsx`
- **Evidence:** Every `DomainSlotCompact` renders as a `motion.div` (or receives `animate`/`initial` props) regardless of `justCompleted` state. During life mapping, 8 pill slots are rendered simultaneously, but at most 1 is animating at any time.
- Reported by: Performance reviewer (R4.2 code review)

## Proposed Solutions

### Option A — Conditionally apply animation props only when `justCompleted` is true (Recommended)

Render a plain `div` (or omit `animate`/`initial` props) when `justCompleted` is false. Only pass Framer Motion animation props to the slot that actually needs to animate.

```tsx
// Instead of always:
<motion.div animate={{ scale: 1 }} initial={{ scale: 0.8 }} ...>

// Conditionally:
const Component = justCompleted ? motion.div : 'div'
<Component
  {...(justCompleted ? { animate: { scale: 1 }, initial: { scale: 0.8 } } : {})}
>
```

**Pros:** Eliminates 7 unnecessary Framer Motion animation controllers per render cycle
**Cons:** Slightly more conditional logic
**Effort:** Small
**Risk:** Low — only changes non-animating instances

## Recommended Action

Option A — conditionally apply animation props based on `justCompleted`.

## Technical Details

- **Affected file:** `components/chat/domain-slot-compact.tsx`
- **PR:** #20

## Acceptance Criteria

- [ ] `DomainSlotCompact` only creates a Framer Motion animation controller when `justCompleted` is true
- [ ] Non-animating slots render as plain elements (no `motion.div` wrapper or animation props)
- [ ] The just-completed domain still animates correctly (scale bounce)
- [ ] No visual regression in the life map pill shelf

## Work Log

- 2026-02-19: Created from PR #20 R4.2 code review (Performance reviewer)
