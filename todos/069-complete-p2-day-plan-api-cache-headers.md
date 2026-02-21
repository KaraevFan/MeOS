---
status: complete
priority: p2
issue_id: "069"
tags: [code-review, performance, caching, day-plan, api]
dependencies: []
---

# 069 — Day plan API route missing cache headers for historical dates

## Problem Statement

`GET /api/day-plan` returns no `Cache-Control` headers. Historical day plans (dates before today) are immutable — their morning session is complete and captures are finalized. Without cache headers, the browser refetches on every swipe navigation, even for previously viewed historical dates.

**Source:** Performance oracle (OPT-3), architecture strategist.

## Proposed Solutions

### Fix

Add conditional cache headers based on whether the date is today or historical:

```typescript
const isHistorical = parsed.data.date < today
const headers: HeadersInit = isHistorical
  ? { 'Cache-Control': 'private, max-age=3600' }
  : { 'Cache-Control': 'private, no-cache' }
return NextResponse.json(data, { headers })
```

**Effort:** Trivial. **Risk:** None — `private` ensures shared caches don't store user data.

## Acceptance Criteria

- [ ] Historical dates return `Cache-Control: private, max-age=3600`
- [ ] Today's date returns `Cache-Control: private, no-cache`
- [ ] Browser uses cached responses when swiping back to previously viewed dates

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-21 | Identified during performance review | Immutable data should have cache headers |
