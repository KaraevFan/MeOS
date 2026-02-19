---
status: complete
priority: p1
issue_id: "029"
tags: [code-review, typescript, performance, react-hooks, life-map-pill]
dependencies: []
---

# 029 — `LifeMapProgressPill` missing `useMemo` — expensive recomputation on every streaming render

## Problem Statement

In `life-map-progress-pill.tsx`, three expensive computations run on every render: `pulseMap` (line 47-49), `domainFileIndex` (line 182-186), and `domains` (line 188-197). During streaming, the parent `ChatView` re-renders ~50-200 times per Sage response due to `streamingText` changes. Each re-render cascades to the pill, rebuilding Maps and arrays unnecessarily. Additionally, the `pulseCheckRatings` prop is created with an inline `.map()` in `chat-view.tsx:1024`, creating a new array reference every render which defeats any `React.memo`.

## Findings

- **File:** `components/chat/life-map-progress-pill.tsx:47-49`
- **Evidence:**
  ```ts
  const pulseMap = new Map(...)  // line 47 — runs every render
  ```
- **File:** `components/chat/life-map-progress-pill.tsx:182-186`
- **Evidence:**
  ```ts
  const domainFileIndex = new Map(...)  // line 182 — runs every render
  ```
- **File:** `components/chat/life-map-progress-pill.tsx:188-197`
- **Evidence:**
  ```ts
  const domains: PillDomain[] = ALL_DOMAINS.map(...)  // line 188 — runs every render
  ```
- **File:** `components/chat/chat-view.tsx:1024`
- **Evidence:**
  ```ts
  pulseCheckRatings={pulseCheckRatings?.map((r) => ({...})) ?? null}
  // new array reference every render — defeats React.memo
  ```
- Reported by: TypeScript reviewer (HIGH), Performance oracle (P0), Code simplicity reviewer

## Proposed Solutions

### Option A — Wrap pill in `React.memo`, memoize computations with `useMemo`, stabilize props in ChatView (Recommended)

```tsx
// In life-map-progress-pill.tsx:
const pulseMap = useMemo(
  () => new Map(pulseCheckRatings?.map((r) => [r.domain, r.ratingNumeric]) ?? []),
  [pulseCheckRatings]
)

const domainFileIndex = useMemo(
  () => new Map(Object.entries(fileIndex ?? {}).map(([k, v]) => [k, v])),
  [fileIndex]
)

const domains = useMemo(
  () => ALL_DOMAINS.map((d) => ({ ... })),
  [fileIndex, domainsExplored, pulseMap]
)

// Export with React.memo:
export const LifeMapProgressPill = memo(LifeMapProgressPillInner)

// In chat-view.tsx:
const pillRatings = useMemo(
  () => pulseCheckRatings?.map((r) => ({ domain: r.domain, ratingNumeric: r.ratingNumeric })) ?? null,
  [pulseCheckRatings]
)
// Then pass: pulseCheckRatings={pillRatings}
```

**Pros:** Eliminates ~50-200 unnecessary Map/array rebuilds per Sage response. Stabilized prop references allow `React.memo` to skip re-renders entirely when pill inputs haven't changed.
**Cons:** Slightly more code
**Effort:** Small-Medium
**Risk:** Low

## Recommended Action

Option A — add `useMemo` to all three computations in the pill, wrap the component in `React.memo`, and stabilize the `pulseCheckRatings` prop in `ChatView`.

## Technical Details

- **Affected files:** `components/chat/life-map-progress-pill.tsx` lines 47-49, 182-197; `components/chat/chat-view.tsx` line 1024
- **PR:** #20

## Acceptance Criteria

- [ ] `pulseMap`, `domainFileIndex`, and `domains` wrapped in `useMemo` with correct dependency arrays
- [ ] `LifeMapProgressPill` exported with `React.memo`
- [ ] `pulseCheckRatings` prop in `chat-view.tsx` stabilized via `useMemo` (no inline `.map()`)
- [ ] No unnecessary re-renders of the pill during streaming (verifiable via React DevTools Profiler)
- [ ] TypeScript strict check passes
- [ ] ESLint passes (no `// eslint-disable` added)

## Work Log

- 2026-02-19: Created from PR #20 R4.2 code review (TypeScript reviewer HIGH, Performance oracle P0, Code simplicity reviewer)
