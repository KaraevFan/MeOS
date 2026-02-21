---
title: "fix: Incremental Google Calendar OAuth consent flow"
type: fix
date: 2026-02-21
---

# fix: Incremental Google Calendar OAuth consent flow

## Overview

Google OAuth sign-in fails with 403 `access_denied` for non-test users because the login page requests `calendar.readonly` — a sensitive scope that Google blocks for unverified apps. The calendar infrastructure is fully built but unreachable. This plan removes the scope from login and builds an incremental OAuth flow so calendar becomes opt-in.

## Problem Statement

The login page (`app/(auth)/login/page.tsx:22-26`) requests `calendar.readonly` at sign-in time:

```typescript
scopes: 'https://www.googleapis.com/auth/calendar.readonly',
queryParams: { access_type: 'offline', prompt: 'consent' },
```

This causes:
1. **403 for all non-test users** — Google blocks unverified apps requesting sensitive scopes
2. **Calendar integration is unreachable** — working infrastructure exists (`lib/calendar/`, `components/home/calendar-card.tsx`, migration 013) but no user can authenticate to use it
3. **Secondary issue** — `getValidToken()` destructively deletes the integration row on ANY token refresh failure, including transient errors

## Proposed Solution

**Two-part fix:**

1. **Remove calendar scope from login** — Sign-in requests only basic auth (email + profile). All existing graceful degradation already handles missing calendar.

2. **Build incremental OAuth flow** — "Connect Calendar" surfaces in the user menu sheet AND as a warm nudge card on the home screen (morning layout, where CalendarCard would appear). Uses Google OAuth directly (not Supabase's `signInWithOAuth`) since this is an already-authenticated user requesting additional scope.

### Architecture

```
User clicks "Connect Calendar"
    ↓
GET /api/calendar/connect
    → Verify Supabase session
    → Generate CSRF state token → store in httpOnly cookie
    → Build Google OAuth URL (calendar.readonly scope, offline access)
    → 302 redirect to Google
    ↓
Google consent screen
    ↓
GET /api/calendar/callback
    → Verify CSRF state cookie matches state param
    → Verify Supabase session
    → Exchange authorization code for tokens via googleapis OAuth2Client
    → Call storeCalendarIntegration() (existing upsert)
    → Redirect to /home?calendar=connected
    ↓
Home screen shows CalendarCard (morning) or success toast (any time)
```

### Impact Analysis (removing scope from login)

| Feature | Behavior after fix |
|---|---|
| Google sign-in | Works for all users (no 403) |
| CalendarCard | Won't render — gated by `calendarSummary &&` check (`home-screen.tsx:231`) |
| Morning briefing AI context | `getCalendarEvents()` returns `[]` — nothing injected (`context.ts:151-165`) |
| Auth callback | `providerToken` is `null` → skips `storeCalendarIntegration()` (`callback/route.ts:38`) |
| Existing integrations | Unaffected — tokens already stored in `integrations` table |

## Technical Considerations

### CSRF Protection

The incremental OAuth flow is **outside Supabase's PKCE management**. It needs its own CSRF protection:
- Generate a cryptographic random `state` value in `/api/calendar/connect`
- Store it in an httpOnly, secure, sameSite=lax cookie
- Verify in `/api/calendar/callback` before exchanging the code
- Clear the cookie after verification

### Redirect URI

The existing `oauth2Client` (`lib/calendar/google-calendar.ts:7-10`) has no redirect URI. The connect flow must:
- Derive redirect URI from the request origin: `${origin}/api/calendar/callback`
- This URL must be registered in Google Cloud Console's authorized redirect URIs (both localhost for dev and production domain)

### Magic Link Users

Users who signed in via magic link (non-Google) can still connect their calendar. The incremental OAuth flow goes directly to Google, independent of how the user authenticated with MeOS. The Google account they connect may differ from their MeOS email — this is acceptable for MVP.

### Token Refresh Improvement

`getValidToken()` currently deletes the integration on ANY error. Fix:
- **Retryable errors** (5xx, network timeout): retry up to 2 times with short delay
- **Permanent errors** (`invalid_grant` — token revoked): delete the integration row
- Always log before deletion

### Environment Variables

`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are already used but missing from `.env.local.example`. Add them along with guidance that the redirect URI must be registered in Google Cloud Console.

## Acceptance Criteria

- [x] Google sign-in works for non-test users (no 403)
- [x] "Connect Calendar" button in user menu sheet initiates incremental OAuth
- [x] Home screen (morning) shows a warm nudge card to connect calendar when no integration exists
- [x] After successful connect, CalendarCard renders on home (morning) with real events
- [x] After successful connect, user sees brief success feedback (toast or query param banner)
- [x] "Disconnect Calendar" button in user menu deletes integration and optionally revokes Google token
- [x] Token refresh retries transient errors (2 attempts) before deleting on permanent failure
- [x] CSRF state parameter protects the OAuth callback
- [x] If user denies Google consent, they return to /home with no error — just no calendar
- [x] Session expiry during OAuth redirect shows a graceful error, not a crash
- [x] `.env.local.example` includes `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
- [x] No TypeScript or build errors

## Success Metrics

- All users can sign in (0 login failures from OAuth scope)
- Calendar connection is opt-in with < 3 taps
- Connected users see CalendarCard in morning briefing
- Token refresh survives transient Google API errors without losing integration

## Dependencies & Risks

**Dependencies:**
- Google Cloud Console: `/api/calendar/callback` must be registered as an authorized redirect URI (both `http://localhost:3000/api/calendar/callback` for dev and the production URL)
- `googleapis` npm package — already installed and used in `lib/calendar/google-calendar.ts`
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` environment variables — already configured

**Risks:**
- **Low:** Redirect URI mismatch if not registered in Google Cloud Console. Mitigation: document the registration step.
- **Low:** Magic link users connecting a different Google account than their MeOS email. Acceptable for MVP.
- **Low:** Mid-day or evening connect shows no CalendarCard (morning only). Mitigation: success toast confirms connection.

## Changes

### Files to Modify

#### 1. `app/(auth)/login/page.tsx` — Remove calendar scope

Remove `scopes` and `queryParams` from `signInWithOAuth` options (lines 22-26):

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

#### 2. `lib/calendar/google-calendar.ts` — Fix token refresh + add helpers

- Fix `getValidToken()`: add retry logic for transient errors, only delete on permanent errors
- Export a `generateCalendarAuthUrl(origin: string, state: string)` helper for the connect route
- Export a `exchangeCodeForTokens(code: string, redirectUri: string)` helper for the callback route
- Export `revokeCalendarToken(userId: string)` that calls Google's revocation endpoint before deleting the row

#### 3. `components/ui/user-menu-sheet.tsx` — Add calendar connect/disconnect

- Accept `hasCalendar: boolean` prop
- Show "Connect Calendar" row when `hasCalendar` is false → navigates to `/api/calendar/connect`
- Show "Disconnect Calendar" row when `hasCalendar` is true → calls `/api/calendar/disconnect` with confirmation

#### 4. `components/home/home-screen.tsx` — Add calendar nudge card

- In the morning layout block (around line 231), when `!data.calendarSummary`:
  - Show a warm nudge card: "Connect your Google Calendar to see today's schedule in your morning briefing"
  - Links to `/api/calendar/connect`
- When `data.calendarSummary` exists, show `CalendarCard` as before

#### 5. `.env.local.example` — Add Google env vars

Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` entries with comments.

### New Files to Create

#### 6. `app/api/calendar/connect/route.ts` — Initiate incremental OAuth

```typescript
// GET /api/calendar/connect
// 1. Verify Supabase session (401 if not authenticated)
// 2. Generate crypto random state, store in httpOnly cookie
// 3. Generate Google OAuth URL via googleapis OAuth2Client
//    - scope: calendar.readonly
//    - access_type: offline
//    - prompt: consent
//    - state: CSRF token
//    - redirect_uri: ${origin}/api/calendar/callback
// 4. Return 302 redirect to Google
```

#### 7. `app/api/calendar/callback/route.ts` — Handle Google callback

```typescript
// GET /api/calendar/callback?code=...&state=...
// 1. Verify CSRF state matches cookie value (403 if mismatch)
// 2. Clear state cookie
// 3. Handle error param (user denied consent → redirect /home)
// 4. Verify Supabase session (redirect to /login if expired)
// 5. Exchange code for tokens via googleapis OAuth2Client
// 6. Call storeCalendarIntegration(userId, accessToken, refreshToken, expiresAt)
// 7. Redirect to /home?calendar=connected
```

#### 8. `app/api/calendar/disconnect/route.ts` — Disconnect calendar

```typescript
// POST /api/calendar/disconnect
// 1. Verify Supabase session (401 if not)
// 2. Attempt to revoke Google token (best-effort)
// 3. Delete integration row via removeIntegration(userId)
// 4. Return { success: true }
```

#### 9. `components/home/calendar-connect-card.tsx` — Warm nudge card

A simple card component for the home screen morning layout that invites the user to connect their calendar. Follows the existing card pattern (warm amber accent, rounded corners, minimal text).

## References & Research

### Internal References

- Existing todo: [`todos/064-pending-p2-calendar-oauth-scope-blocking-login.md`](todos/064-pending-p2-calendar-oauth-scope-blocking-login.md)
- Previous plan (login-only fix): [`Docs/plans/2026-02-19-fix-google-oauth-scope-blocking-login-plan.md`](Docs/plans/2026-02-19-fix-google-oauth-scope-blocking-login-plan.md)
- STEERING.md decision (Feb 19): Calendar scope stays at login for playtest, incremental consent for launch
- Playtest feedback: [`Docs/feedback/20260221_R5a_open_day_testing.md`](Docs/feedback/20260221_R5a_open_day_testing.md) (Issue 9)
- Code review finding #12: [`Docs/solutions/code-review-fixes/20260218-daily-rhythm-p1-p2-p3-findings.md`](Docs/solutions/code-review-fixes/20260218-daily-rhythm-p1-p2-p3-findings.md)

### Key Codebase Files

- [`app/(auth)/login/page.tsx`](app/(auth)/login/page.tsx) — login page (remove scope)
- [`app/(auth)/auth/callback/route.ts`](app/(auth)/auth/callback/route.ts) — existing auth callback (no change needed)
- [`lib/calendar/google-calendar.ts`](lib/calendar/google-calendar.ts) — calendar operations, token management
- [`lib/calendar/types.ts`](lib/calendar/types.ts) — Zod schemas
- [`components/home/home-screen.tsx`](components/home/home-screen.tsx) — home screen (CalendarCard at line 231)
- [`components/home/calendar-card.tsx`](components/home/calendar-card.tsx) — CalendarCard UI
- [`components/ui/user-menu-sheet.tsx`](components/ui/user-menu-sheet.tsx) — user menu bottom sheet
- [`lib/supabase/home-data.ts`](lib/supabase/home-data.ts) — home data fetch with calendar
- [`app/api/calendar/events/route.ts`](app/api/calendar/events/route.ts) — existing calendar API
- [`supabase/migrations/013_calendar_integration.sql`](supabase/migrations/013_calendar_integration.sql) — integrations table

### External References

- [Google incremental authorization](https://developers.google.com/identity/protocols/oauth2/web-server#incrementalAuth)
- [Google OAuth verification docs](https://support.google.com/cloud/answer/7454865)
- [Google token revocation](https://developers.google.com/identity/protocols/oauth2/web-server#tokenrevoke)
