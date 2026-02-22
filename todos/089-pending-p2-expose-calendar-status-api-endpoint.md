---
status: pending
priority: p2
issue_id: "089"
tags: [code-review, agent-native, calendar]
dependencies: []
---

# Expose Calendar Integration Status as API Endpoint

## Problem Statement

`hasCalendarIntegration()` is a server-side function with no API equivalent. An API consumer calling `GET /api/calendar/events?date=...` gets `{ events: [] }` regardless of whether the user has no integration or just has no events today — the responses are indistinguishable.

## Findings

- **Source**: agent-native-reviewer agent
- **Location**: `lib/calendar/google-calendar.ts` line 77 (function), no API route
- **Evidence**: `hasCalendarIntegration` used in page.tsx but not exposed via HTTP

## Proposed Solutions

### Option A: Add GET /api/calendar/status (Recommended)
```typescript
// app/api/calendar/status/route.ts
export async function GET() {
  // auth check, then:
  const connected = await hasCalendarIntegration(user.id)
  return NextResponse.json({ connected })
}
```

- **Pros**: 10-line route, closes agent-native observability gap
- **Cons**: One more API endpoint to maintain
- **Effort**: Small
- **Risk**: None

## Acceptance Criteria

- [ ] `GET /api/calendar/status` returns `{ connected: boolean }`
- [ ] Endpoint requires authentication

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-23 | Found during code review | Agent-native parity gap |
