---
status: pending
priority: p3
issue_id: "014"
tags: [code-review, architecture, routing, maintainability]
dependencies: []
---

# 014 — `/chat` prefix hide-all is an implicit contract; document or make explicit

## Problem Statement

`pathname.startsWith('/chat')` hides the tab bar on any path under `/chat`, including future sub-routes like `/chat/history` or `/chat/settings`. The variable name `isActiveSession` implies semantic meaning (active AI session in progress) but the implementation is a route prefix check. Future developers adding `/chat/*` child routes will silently lose the tab bar.

## Findings

- **File:** `components/ui/bottom-tab-bar.tsx:104`
- ```tsx
  const isActiveSession = pathname.startsWith('/chat')
  ```
- Reported by: TypeScript reviewer (P2-E), Architecture reviewer (P2), Simplicity reviewer (P3)

## Fix Options

### Option A — Document the contract with a comment

```tsx
// Hide the tab bar on all /chat routes: the active session header takes over navigation.
// If a future /chat/* child route should show the tab bar, change this to an exact match
// or an explicit allowlist.
const isActiveSession = pathname.startsWith('/chat')
```

Also add to `CLAUDE.md` Gotchas section: "The tab bar hides on any `/chat` route — if a sub-route under `/chat` needs the tab bar, update `isActiveSession` in `bottom-tab-bar.tsx`."

### Option B — Rename variable to match what it actually tests

```tsx
const isChatRoute = pathname.startsWith('/chat')
if (!onboardingCompleted || isChatRoute) return null
```

### Option C — Exact match for now

```tsx
const isChatRoute = pathname === '/chat'
```

**Effort:** Tiny
**Risk:** None

## Acceptance Criteria

- [ ] Comment explains the hide-all intent at `bottom-tab-bar.tsx:104`
- [ ] OR variable renamed from `isActiveSession` to `isChatRoute`
- [ ] CLAUDE.md Gotchas updated

## Work Log

- 2026-02-19: Created from PR #19 code review
