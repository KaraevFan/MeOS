# Login & Logout Design

## Context

MeOS has a working auth foundation (Google OAuth + Magic Link via Supabase, PKCE flow, middleware route protection). Users can sign in but have no way to sign out or see their account info. The login page is functional but needs visual polish.

## Scope

Two deliverables:
1. **Logout:** App shell header with user avatar + bottom sheet menu for sign out
2. **Login polish:** Tighten spacing, typography, and interaction states on the existing login page

## Design

### App Shell Header

Added to `app/(main)/layout.tsx`, appears on all authenticated pages.

- **Height:** 48px, `bg-bg` background (transparent feel)
- **Left side:** Empty (pages provide their own titles/greetings)
- **Right side:** User initial circle
  - 32px diameter, `bg-primary/15` background, `text-primary` letter
  - Initial from: first letter of display name (from `users` table), fallback to first letter of email

### User Menu (Bottom Sheet)

Triggered by tapping the avatar circle.

- **Content:** User email display, app version/label
- **Action:** "Sign out" button (warm terra accent, not alarming red)
- **Dismiss:** Tap outside or swipe down
- **No confirmation dialog** (signing back in is instant, not destructive)

### Sign-Out Flow

1. Call `supabase.auth.signOut()`
2. Redirect to `/login`
3. Middleware handles protecting routes if session is cleared

### Login Page Polish

No structural or functional changes. Visual tightening only:

- Typography: refine title/subtitle sizing and weight
- Spacing: normalize vertical rhythm (tighter, more composed)
- Buttons: consistent shadows, hover states, active press states
- Loading state: polish spinner positioning and transitions
- Error state: fade-in animation, warm styling

## New Components

- `components/ui/app-header.tsx` — Slim header bar with user avatar (server component for user data, client wrapper for interactivity)
- `components/ui/user-menu-sheet.tsx` — Bottom sheet with email + sign out (client component)

## Modified Files

- `app/(main)/layout.tsx` — Add `<AppHeader>` above `<main>`, pass user data
- `app/(auth)/login/page.tsx` — Visual polish

## Out of Scope

- Profile editing, display name changes
- Settings page, preferences
- Password management, 2FA
- Session management (multi-device sign out)
- Account deletion
