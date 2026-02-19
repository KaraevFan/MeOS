---
title: "fix: Remove calendar.readonly scope from Google login to unblock sign-in"
type: fix
date: 2026-02-19
---

# fix: Remove calendar.readonly scope from Google login to unblock sign-in

## Problem

Google OAuth sign-in fails with **403 access_denied** for all non-test users because:

1. The login page requests `https://www.googleapis.com/auth/calendar.readonly` at sign-in time (`app/(auth)/login/page.tsx:24`)
2. The Google Cloud app hasn't completed Google's verification process
3. Unverified apps requesting sensitive scopes (like calendar) are blocked for all users except those explicitly listed as test users in Google Cloud Console

This was documented as an MVP tradeoff in code review finding #12 (`Docs/solutions/code-review-fixes/20260218-daily-rhythm-p1-p2-p3-findings.md`).

## Proposed Solution

Remove the `calendar.readonly` scope, `access_type: 'offline'`, and `prompt: 'consent'` from the Google OAuth login flow. Calendar access should be requested incrementally post-MVP when the user opts into calendar integration.

**Impact analysis — no features break:**

| Feature | Behavior after fix |
|---|---|
| Google sign-in | Works for all users (no 403) |
| CalendarCard on home | Won't render — already gated by `calendarSummary &&` check (`components/home/home-screen.tsx:224`) |
| Morning contextual line | Still works — `calendarSummary` is optional in the payload (`components/home/home-screen.tsx:151`) |
| `getCalendarEvents()` | Returns `[]` — no integration row = graceful no-op (`lib/calendar/google-calendar.ts:28`) |
| Auth callback | `providerToken` will be `null` → skips `storeCalendarIntegration()` (`app/(auth)/auth/callback/route.ts:38`) |
| Existing users with calendar tokens | Unaffected — their tokens are already stored in `integrations` table |

## Acceptance Criteria

- [ ] Google sign-in works without 403 for non-test-user accounts
- [ ] Home screen loads without errors (CalendarCard simply absent)
- [ ] Existing calendar integrations (if any) continue to work via stored tokens
- [ ] No TypeScript or build errors

## Changes

### 1. `app/(auth)/login/page.tsx`

Remove lines 22-28 (the `scopes` and `queryParams` options from `signInWithOAuth`):

```typescript
// Before
const { error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/auth/callback`,
    scopes: 'https://www.googleapis.com/auth/calendar.readonly',
    queryParams: {
      access_type: 'offline',
      prompt: 'consent',
    },
  },
})

// After
const { error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/auth/callback`,
  },
})
```

### 2. `app/(auth)/auth/callback/route.ts` (no change needed)

The callback already guards calendar storage with `if (providerToken)` on line 38. When no calendar scope is requested, `provider_token` will be `null` and the block is skipped. No change required.

## Future Work (out of scope)

- Incremental calendar scope request via a settings page or integration toggle
- Google Cloud app verification for production release with sensitive scopes

## References

- Code review finding #12: `Docs/solutions/code-review-fixes/20260218-daily-rhythm-p1-p2-p3-findings.md`
- Google OAuth verification docs: https://support.google.com/cloud/answer/7454865
