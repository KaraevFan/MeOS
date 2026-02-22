---
status: complete
priority: p2
issue_id: "087"
tags: [code-review, observability]
dependencies: []
---

# Silent .catch(() => []) on Calendar Fetch in Day Page

## Problem Statement

`getCalendarEvents(user.id, today, tz).catch(() => [])` in `app/(main)/day/page.tsx` swallows all errors silently with zero observability. If the Google Calendar API fails unexpectedly, there is no log trace to diagnose.

## Findings

- **Source**: kieran-typescript-reviewer, learnings-researcher agents
- **Location**: `app/(main)/day/page.tsx` line 23
- **Institutional pattern**: `docs/solutions/react-hooks/supabase-client-in-usecallback-deps.md` — "Never: `.catch(() => {})` // Silent error"

## Proposed Solutions

### Option A: Add console.error in catch (Recommended)
```typescript
getCalendarEvents(user.id, today, tz).catch((err) => {
  console.error('[DayPage] Calendar fetch failed:', err)
  return []
})
```

- **Effort**: Trivial
- **Risk**: None

## Acceptance Criteria

- [ ] Calendar fetch errors are logged with context

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-23 | Found during code review | Institutional pattern: never swallow errors silently |
