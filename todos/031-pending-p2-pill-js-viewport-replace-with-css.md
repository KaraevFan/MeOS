---
status: pending
priority: p2
issue_id: "031"
tags: [code-review, css, hydration, breakpoint, chat-view]
dependencies: []
---

# 031 — `LifeMapProgressPill` JS viewport detection — replace with CSS `lg:hidden`

## Problem Statement

`chat-view.tsx` uses `useState(false)` + `useEffect` with `window.matchMedia('(max-width: 768px)')` for mobile viewport detection (lines 178-184). This causes three problems: (1) a hydration mismatch — SSR renders `false`, mobile client immediately re-renders to `true`; (2) a breakpoint gap — the sidebar uses Tailwind `lg:` (1024px), the pill uses 768px, so viewports between 769px-1023px show neither component; (3) 8 lines of JS when a CSS class would suffice.

## Findings

- **File:** `components/chat/chat-view.tsx:178-184`
- **Evidence:**
  ```tsx
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    setIsMobile(mq.matches)
    // ...listener
  }, [])
  ```
  SSR always renders `isMobile = false`. On mobile clients, the effect fires and sets `isMobile = true`, causing a flash/layout shift. The 768px breakpoint also does not match the sidebar's `lg:` (1024px) breakpoint, creating a 769px-1023px dead zone where neither pill nor sidebar renders.
- Reported by: Architecture strategist (Priority 2), Code simplicity reviewer (LOW), Performance oracle

## Proposed Solutions

### Option A — CSS `lg:hidden` wrapper (Recommended)

Replace the JS viewport check with a CSS-only visibility toggle:

```tsx
{sessionType === 'life_mapping' && !showPulseCheck && !showCheckinPulse && (
  <div className="lg:hidden">
    <LifeMapProgressPill ... />
  </div>
)}
```

Remove the `isMobile` state, the `useEffect`, and the `isMobile &&` conditional entirely. ~8 lines removed.

**Pros:** Zero hydration mismatch, breakpoint aligns with sidebar (`lg:`), fewer lines of JS, no layout shift on mobile
**Cons:** Pill component mounts on desktop too (hidden via CSS) — negligible cost
**Effort:** Small
**Risk:** Low

## Recommended Action

Option A — wrap in `<div className="lg:hidden">` and delete the `isMobile` state + effect. Aligns pill visibility breakpoint with the sidebar's `lg:` breakpoint.

## Technical Details

- **Affected file:** `components/chat/chat-view.tsx` lines 178-184 (state + effect), and the render conditional that uses `isMobile`
- **PR:** #20

## Acceptance Criteria

- [ ] `isMobile` state and `useEffect` with `matchMedia` removed from `chat-view.tsx`
- [ ] `LifeMapProgressPill` wrapped in `<div className="lg:hidden">` instead
- [ ] Pill visible on viewports below 1024px, hidden at 1024px+ (matching sidebar breakpoint)
- [ ] No hydration mismatch warnings in browser console
- [ ] TypeScript strict check passes
- [ ] ESLint passes

## Work Log

- 2026-02-19: Created from PR #20 R4.2 code review (Architecture strategist P2, Code simplicity reviewer LOW, Performance oracle)
