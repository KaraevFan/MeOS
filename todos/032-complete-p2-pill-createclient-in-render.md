---
status: complete
priority: p2
issue_id: "032"
tags: [code-review, supabase, createClient, life-map-pill]
dependencies: []
---

# 032 — `createClient()` called in component body — move to module scope

## Problem Statement

`life-map-progress-pill.tsx:43` calls `createClient()` in the component body, creating a new Supabase client reference every render. The sidebar (`life-map-sidebar.tsx:40`) places it at module scope. While `@supabase/ssr` internally uses singleton behavior, the inconsistency is fragile — the `supabase` reference used inside effects is technically stale after re-renders (hidden by eslint-disable comments).

## Findings

- **File:** `components/chat/life-map-progress-pill.tsx:43`
- **Evidence:**
  ```tsx
  export function LifeMapProgressPill(...) {
    const supabase = createClient()  // line 43 — called every render
    // ...
  }
  ```
  Compare with `components/chat/life-map-sidebar.tsx:40`:
  ```tsx
  const supabase = createClient()  // module scope — created once
  export function LifeMapSidebar(...) { ... }
  ```
  The pill creates a new reference on every render. Effects that capture `supabase` in their closure hold a stale reference after re-renders. This is masked by `@supabase/ssr`'s internal singleton, but the pattern is incorrect and fragile.
- Reported by: TypeScript reviewer (HIGH), Security sentinel (LOW), Performance oracle (P3), Architecture strategist, Code simplicity reviewer

## Proposed Solutions

### Option A — Move to module scope (Recommended)

Match the sidebar pattern:

```tsx
const supabase = createClient()

export function LifeMapProgressPill(...) {
  // use supabase directly — stable reference
}
```

**Pros:** Consistent with sidebar, stable reference across renders, no stale closure risk
**Cons:** None
**Effort:** Tiny
**Risk:** Negligible

## Recommended Action

Option A — move `createClient()` to module scope. One-line move, matches existing sidebar pattern.

## Technical Details

- **Affected file:** `components/chat/life-map-progress-pill.tsx` line 43
- **Reference pattern:** `components/chat/life-map-sidebar.tsx` line 40
- **PR:** #20

## Acceptance Criteria

- [ ] `createClient()` called at module scope in `life-map-progress-pill.tsx`, not inside the component function
- [ ] Pattern matches `life-map-sidebar.tsx` module-scope initialization
- [ ] No `eslint-disable` comments added for the `supabase` variable
- [ ] TypeScript strict check passes
- [ ] ESLint passes

## Work Log

- 2026-02-19: Created from PR #20 R4.2 code review (TypeScript reviewer HIGH, Security sentinel LOW, Performance oracle P3, Architecture strategist, Code simplicity reviewer)
