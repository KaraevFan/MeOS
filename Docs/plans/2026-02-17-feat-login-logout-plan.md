# Login & Logout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add user avatar header with sign-out bottom sheet to the authenticated app shell, and visually polish the login page.

**Architecture:** The main layout (`app/(main)/layout.tsx`) gains a slim `<AppHeader>` that renders the user's initial in a circle. Tapping it opens a `<UserMenuSheet>` bottom sheet (client component) showing email + sign out. The login page gets spacing/typography/interaction polish with no functional changes.

**Tech Stack:** Next.js App Router, Supabase Auth (`signOut()`), Tailwind CSS, `cn()` utility

**Design doc:** `docs/plans/2026-02-17-login-logout-design.md`

**Relevant skill:** `@meos-design` — read before building any component

---

### Task 1: Create the UserMenuSheet component

**Files:**
- Create: `components/ui/user-menu-sheet.tsx`

**Context:** This is a client component — a bottom sheet overlay triggered by the avatar. It needs `useState` for open/close state and calls `supabase.auth.signOut()` from the browser client. Follow patterns from `components/ui/bottom-tab-bar.tsx` for style conventions.

**Step 1: Create the component file**

```tsx
'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface UserMenuSheetProps {
  email: string
  initial: string
}

export function UserMenuSheet({ email, initial }: UserMenuSheetProps) {
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const router = useRouter()

  const handleSignOut = useCallback(async () => {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }, [router])

  return (
    <>
      {/* Avatar trigger */}
      <button
        onClick={() => setOpen(true)}
        className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center
                   text-sm font-semibold text-primary transition-colors hover:bg-primary/25
                   active:scale-95"
        aria-label="User menu"
      >
        {initial}
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-text/20 animate-fade-up"
          style={{ animation: 'none', opacity: 1, transition: 'opacity 150ms ease-out' }}
          onClick={() => setOpen(false)}
        />
      )}

      {/* Bottom sheet */}
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50 bg-bg-card rounded-t-lg shadow-md px-lg pt-lg pb-2xl',
          'transition-transform duration-200 ease-out',
          open ? 'translate-y-0' : 'translate-y-full'
        )}
        style={{ paddingBottom: 'max(48px, env(safe-area-inset-bottom))' }}
      >
        {/* Handle */}
        <div className="flex justify-center mb-lg">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* User info */}
        <div className="flex items-center gap-md mb-lg">
          <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center
                          text-base font-semibold text-primary">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="text-sm text-text truncate">{email}</p>
            <p className="text-xs text-text-secondary">MeOS</p>
          </div>
        </div>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full h-12 rounded-md text-sm font-medium text-accent-terra
                     bg-accent-terra/10 hover:bg-accent-terra/15 transition-colors
                     disabled:opacity-50 active:scale-[0.98]"
        >
          {signingOut ? 'Signing out...' : 'Sign out'}
        </button>
      </div>
    </>
  )
}
```

**Step 2: Run type check**

Run: `npm run type-check`
Expected: PASS (no errors in new file)

**Step 3: Commit**

```bash
git add components/ui/user-menu-sheet.tsx
git commit -m "feat: add UserMenuSheet bottom sheet component"
```

---

### Task 2: Create the AppHeader component

**Files:**
- Create: `components/ui/app-header.tsx`

**Context:** This is a server-rendered wrapper that passes user data to the client `UserMenuSheet`. It sits in the main layout above `<main>`. Height is 48px, transparent bg, avatar on the right.

**Step 1: Create the component file**

```tsx
import { UserMenuSheet } from '@/components/ui/user-menu-sheet'

interface AppHeaderProps {
  email: string
  displayName: string | null
}

export function AppHeader({ email, displayName }: AppHeaderProps) {
  const initial = (displayName?.[0] || email[0] || '?').toUpperCase()

  return (
    <header className="h-12 flex items-center justify-end px-md max-w-lg mx-auto">
      <UserMenuSheet email={email} initial={initial} />
    </header>
  )
}
```

**Step 2: Run type check**

Run: `npm run type-check`
Expected: PASS

**Step 3: Commit**

```bash
git add components/ui/app-header.tsx
git commit -m "feat: add AppHeader with user avatar"
```

---

### Task 3: Integrate AppHeader into the main layout

**Files:**
- Modify: `app/(main)/layout.tsx`

**Context:** The layout already fetches the user via `supabase.auth.getUser()`. We need to also fetch the user's display_name and email from the `users` table, then pass them to `<AppHeader>`. Look at how `home-data.ts` queries the users table for the pattern.

**Step 1: Update the layout**

Replace the current `app/(main)/layout.tsx` content with:

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BottomTabBar } from '@/components/ui/bottom-tab-bar'
import { AppHeader } from '@/components/ui/app-header'
import { ActivityTracker } from '@/components/activity-tracker'
import { getDisplayName } from '@/lib/utils'

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('users')
    .select('email, display_name')
    .eq('id', user.id)
    .single()

  const email = profile?.email || user.email || ''
  const displayName = getDisplayName({
    display_name: profile?.display_name,
    email: profile?.email,
  })

  return (
    <div className="min-h-screen bg-bg">
      <ActivityTracker />
      <AppHeader email={email} displayName={displayName} />
      <main className="pb-20">
        {children}
      </main>
      <BottomTabBar />
    </div>
  )
}
```

**Step 2: Run type check**

Run: `npm run type-check`
Expected: PASS

**Step 3: Start dev server and verify visually**

Run: `npm run dev`

Check in browser:
- Avatar circle appears top-right on all authenticated pages (home, chat, life map, history)
- Shows first letter of display name (or email)
- Tapping opens bottom sheet with email + sign out
- Sign out redirects to `/login`
- Bottom sheet dismisses on backdrop tap

**Step 4: Commit**

```bash
git add app/\(main\)/layout.tsx
git commit -m "feat: integrate AppHeader with user avatar into main layout"
```

---

### Task 4: Polish the login page visuals

**Files:**
- Modify: `app/(auth)/login/page.tsx`

**Context:** No functional changes. Tighten spacing, refine typography, add tactile button states, polish error/loading transitions. The current file uses inline `style` tags for `fade-in-up` animation — keep that pattern. Reference `tailwind.config.ts` for design tokens.

**Step 1: Apply visual polish**

Key changes to make (edit in place, not full rewrite):

1. **Title typography:** Change `text-2xl font-bold` to `text-2xl font-bold tracking-tighter` for a tighter, more polished feel.

2. **Subtitle spacing:** Change `mt-3` to `mt-2` to tighten the title-subtitle gap.

3. **Auth section spacing:** Change `mt-12` to `mt-10` and `mt-16` (terms) to `mt-12` to compress the vertical rhythm.

4. **Orb spacing:** Change `mb-14` to `mb-10` to bring the orb closer.

5. **Button active states:** Add `active:scale-[0.98]` to both the Google button and email button for tactile press feedback.

6. **Error state:** Change `{error && (` block to include a fade-in transition:
```tsx
{error && (
  <p className="mt-md text-sm text-accent-terra animate-fade-up">{error}</p>
)}
```

7. **Loading state:** Move loading indicator inside the auth section instead of below it, and simplify:
```tsx
{loading && !error && (
  <div className="mt-md flex items-center justify-center gap-2">
    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    <span className="text-sm text-text-secondary">Redirecting...</span>
  </div>
)}
```
Change `mt-lg` to `mt-md` for tighter positioning.

**Step 2: Run type check**

Run: `npm run type-check`
Expected: PASS

**Step 3: Verify visually in dev server**

Check in browser at `/login`:
- Spacing feels tighter and more composed
- Buttons have press feedback (slight scale)
- Error messages fade in smoothly
- Overall vertical rhythm feels balanced

**Step 4: Commit**

```bash
git add app/\(auth\)/login/page.tsx
git commit -m "feat: polish login page spacing, typography, and interaction states"
```

---

### Task 5: Final verification and build check

**Step 1: Run full type check**

Run: `npm run type-check`
Expected: PASS with zero errors

**Step 2: Run production build**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 3: Run lint**

Run: `npm run lint`
Expected: PASS

**Step 4: Manual smoke test**

In dev server, verify the complete flow:
1. Visit `/` while logged out → redirects to `/login`
2. Login page looks polished (tighter spacing, tactile buttons)
3. Sign in (Google or magic link)
4. Arrive at `/home` → avatar circle visible in top-right header
5. Navigate to Chat, Life Map, History → avatar persists
6. Tap avatar → bottom sheet opens with email + sign out
7. Tap backdrop → sheet dismisses
8. Tap "Sign out" → redirected to `/login`
9. Try to visit `/home` → redirected to `/login` (middleware protection)

**Step 5: Final commit (if any lint/type fixes needed)**

```bash
git add -A
git commit -m "fix: address lint/type issues from login-logout feature"
```
