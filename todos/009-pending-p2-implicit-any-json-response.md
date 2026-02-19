---
status: pending
priority: p2
issue_id: "009"
tags: [code-review, typescript, type-safety]
dependencies: []
---

# 009 — `data` from `response.json()` is implicit `any` in `summary-screen.tsx`

## Problem Statement

`response.json()` returns `Promise<any>` in TypeScript's DOM lib. `data` is inferred as `any`, so `data.blurb` bypasses all type checking. The project CLAUDE.md explicitly states: "No `any` types — use `unknown` + type guards."

## Findings

- **File:** `components/onboarding/summary-screen.tsx:58`
- ```tsx
  .then((data) => setBlurb(data.blurb))  // data is any
  ```
- Violates project TypeScript conventions
- Reported by: TypeScript reviewer (P2-G)

## Fix

```tsx
interface BlurbResponse { blurb: string }

// In the fetch chain:
.then((res) => res.json() as Promise<BlurbResponse>)
.then((data) => {
  if (data?.blurb) setBlurb(data.blurb)
})
```

Or with `unknown` + type guard:
```tsx
.then((res) => res.json())
.then((data: unknown) => {
  if (data && typeof data === 'object' && 'blurb' in data && typeof (data as {blurb: unknown}).blurb === 'string') {
    setBlurb((data as {blurb: string}).blurb)
  }
})
```

**Effort:** Tiny

## Acceptance Criteria

- [ ] `data` from `response.json()` is typed (not implicit `any`)
- [ ] `npm run type-check` passes

## Work Log

- 2026-02-19: Created from PR #19 code review (TypeScript reviewer P2-G)
