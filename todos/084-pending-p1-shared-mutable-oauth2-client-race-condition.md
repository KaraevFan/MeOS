---
status: complete
priority: p1
issue_id: "084"
tags: [code-review, security, calendar]
dependencies: []
---

# Shared Mutable oauth2Client Race Condition

## Problem Statement

A single module-level `oauth2Client` instance in `lib/calendar/google-calendar.ts` is mutated with per-user credentials via `setCredentials()`. In a serverless environment (Vercel), concurrent requests on the same warm instance can cause User A's credentials to be overwritten by User B's before the Google API call completes — leading to cross-user calendar data leakage.

## Findings

- **Source**: security-sentinel agent
- **Location**: `lib/calendar/google-calendar.ts` lines 9-12, 44, 116-117
- **Evidence**: `oauth2Client.setCredentials({ access_token: token })` called in both `getCalendarEvents` and `getValidToken` on the shared singleton
- **Note**: `generateCalendarAuthUrl` and `exchangeCodeForTokens` already correctly create per-call instances (lines 206, 226)

## Proposed Solutions

### Option A: Per-request OAuth2 client (Recommended)
Create a new `OAuth2` client instance inside each function instead of reusing the module singleton.

```typescript
function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
}
```

- **Pros**: Eliminates race condition entirely, minimal code change
- **Cons**: Slightly more object allocation (negligible)
- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria

- [ ] No module-level mutable `oauth2Client` singleton
- [ ] Each `getCalendarEvents` and `getValidToken` call creates its own client
- [ ] Existing `generateCalendarAuthUrl` and `exchangeCodeForTokens` patterns unchanged

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-23 | Discovered during code review of Playtest 6 PR | Pre-existing issue, exposed by adding calendar to Day page |
