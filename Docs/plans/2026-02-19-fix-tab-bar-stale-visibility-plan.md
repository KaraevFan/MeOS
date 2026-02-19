---
title: "fix: Tab Bar Stale Visibility During Active Sessions"
type: fix
date: 2026-02-19
supersedes: 2026-02-19-feat-tab-bar-session-exit-ux-plan.md (partially — visibility portion only)
---

# Fix: Tab Bar Stale Visibility During Active Sessions

## Overview

The tab bar remains visible during active life mapping sessions because `hasActiveSession` is computed once in a server-side layout (`app/(main)/layout.tsx`) that doesn't re-render on client-side navigation. This plan replaces the stale server prop with a client-side context that ChatView updates in real-time.

Secondary fix: the chat page hardcodes `bottom-[84px]` to reserve tab bar space even when the tab bar is hidden, wasting screen real estate during active sessions.

## Problem Statement

**Root cause:** Next.js App Router layouts are server components that execute once and cache. When a user navigates from `/home` to `/chat`, the layout does NOT re-run its Supabase query. The `hasActiveSession` value is frozen from the initial page load.

**Timeline of the bug:**
1. Layout renders on first visit → queries DB → no active session yet → `hasActiveSession = false`
2. User navigates to `/chat`, starts a life mapping conversation
3. Layout does NOT re-execute → `hasActiveSession` stays `false`
4. Tab bar checks `pathname.startsWith('/chat') && hasActiveSession` → `false` → stays visible

**Secondary issue:** `app/(main)/chat/page.tsx` uses `bottom-[84px]` on both its container divs (lines 52 and 192), permanently reserving space for the tab bar. During active sessions when the tab bar is hidden, this creates an 84px dead zone.

## Proposed Solution

Create an `ActiveSessionProvider` context at the layout level. ChatView writes to it, BottomTabBar reads from it. The server-side `hasActiveSession` prop becomes the initial SSR hint, then client state takes over.

### Architecture

```
app/(main)/layout.tsx (SERVER)
  └── ActiveSessionProvider (CLIENT wrapper)  ← NEW
        ├── <main>{children}</main>
        │     └── chat/page.tsx → ChatView
        │           └── calls setHasActiveSession(true/false)
        └── BottomTabBar
              └── reads hasActiveSession from context
```

## Technical Approach

### Phase 1: Context Provider

**New file:** `components/providers/active-session-provider.tsx`

```tsx
'use client'

import { createContext, useContext, useState, useCallback } from 'react'

interface ActiveSessionContextValue {
  hasActiveSession: boolean
  setHasActiveSession: (v: boolean) => void
}

const ActiveSessionContext = createContext<ActiveSessionContextValue>({
  hasActiveSession: false,
  setHasActiveSession: () => {},
})

export function useActiveSession() {
  return useContext(ActiveSessionContext)
}

export function ActiveSessionProvider({
  initialValue,
  children,
}: {
  initialValue: boolean
  children: React.ReactNode
}) {
  const [hasActiveSession, setHasActiveSessionRaw] = useState(initialValue)
  const setHasActiveSession = useCallback((v: boolean) => {
    setHasActiveSessionRaw(v)
  }, [])

  return (
    <ActiveSessionContext.Provider value={{ hasActiveSession, setHasActiveSession }}>
      {children}
    </ActiveSessionContext.Provider>
  )
}
```

**Key decisions:**
- `initialValue` prop allows the server layout to pass its SSR-time query result, so the first render is correct for full page loads
- Simple boolean state — no Supabase subscription, no polling. ChatView already knows session state; just let it tell the context.

### Phase 2: Wire Into Layout

**File:** `app/(main)/layout.tsx`

Wrap the existing layout content in `ActiveSessionProvider`:

```tsx
import { ActiveSessionProvider } from '@/components/providers/active-session-provider'

// ... existing server-side queries stay as-is ...

return (
  <ActiveSessionProvider initialValue={hasActiveSession}>
    <div className="relative mx-auto w-full max-w-[430px] min-h-[100dvh] bg-bg">
      {/* existing content unchanged */}
      <BottomTabBar onboardingCompleted={onboardingCompleted} />
    </div>
  </ActiveSessionProvider>
)
```

- Remove `hasActiveSession` prop from `BottomTabBar` — it reads from context now
- Keep the server query — its result seeds `initialValue` for SSR correctness

### Phase 3: BottomTabBar Reads Context

**File:** `components/ui/bottom-tab-bar.tsx`

```diff
- interface BottomTabBarProps {
-   onboardingCompleted: boolean
-   hasActiveSession: boolean
- }
+ interface BottomTabBarProps {
+   onboardingCompleted: boolean
+ }

+ import { useActiveSession } from '@/components/providers/active-session-provider'

  export function BottomTabBar({ onboardingCompleted }: BottomTabBarProps) {
+   const { hasActiveSession } = useActiveSession()
    const pathname = usePathname()
    // ... rest unchanged
```

### Phase 4: ChatView Writes Context

**File:** `components/chat/chat-view.tsx`

Add a `useEffect` that syncs session state to the context:

```tsx
import { useActiveSession } from '@/components/providers/active-session-provider'

// Inside ChatView:
const { setHasActiveSession } = useActiveSession()

// Signal active session when we have a sessionId and user has sent messages
useEffect(() => {
  const hasUserMessages = messages.some((m) => m.role === 'user')
  setHasActiveSession(!!sessionId && hasUserMessages)
}, [sessionId, messages, setHasActiveSession])

// Clean up on unmount (user navigated away from chat)
useEffect(() => {
  return () => setHasActiveSession(false)
}, [setHasActiveSession])
```

**When does `hasActiveSession` become `true`?**
- After `sessionId` is set AND at least one user message exists
- This matches the existing definition from the server query: `status='active'` with `>=1 user message`

**When does it revert to `false`?**
- Session completes (`sessionCompleted` → messages state unchanged, but the component unmounts on navigation)
- User navigates away from `/chat` (component unmounts → cleanup effect)
- User exits/pauses session (navigates to home → unmount)

### Phase 5: Dynamic Bottom Spacing

**File:** `app/(main)/chat/page.tsx`

Replace hardcoded `bottom-[84px]` with context-aware value:

```tsx
import { useActiveSession } from '@/components/providers/active-session-provider'

// Inside the component:
const { hasActiveSession } = useActiveSession()
const bottomClass = hasActiveSession ? 'bottom-0' : 'bottom-[84px]'
```

Apply to both container divs (lines 52 and 192).

**Note:** `chat/page.tsx` is currently a server component. It will need to be converted to a client component, OR extract the container into a small client wrapper component that reads the context.

## Acceptance Criteria

- [x] Tab bar hides immediately when life mapping session starts (no stale SSR value)
- [x] Tab bar hides during all active session types (life_mapping, weekly_checkin, ad_hoc, open_day, close_day)
- [x] Tab bar reappears when session completes
- [x] Tab bar reappears when user exits/pauses session and navigates away
- [x] Tab bar reappears on `/chat` when no active session exists (idle state)
- [x] Full page reload on `/chat` with active session correctly hides tab bar (SSR hint works)
- [x] Chat container uses full screen height during active sessions (no 84px dead zone)
- [x] Chat container reserves tab bar space when tab bar is visible (idle `/chat`)
- [x] No hydration mismatch warnings in console
- [x] Desktop viewport behavior unchanged (tab bar + sidebar coexist)

## Edge Cases

| Scenario | Expected Behavior |
|----------|------------------|
| Onboarding → first life mapping | Tab bar hidden (onboardingCompleted was just set to true, but session is active) |
| Session completes → user stays on /chat | Tab bar reappears (sessionCompleted = true, but still mounted) |
| User force-refreshes during active session | Tab bar hidden (SSR query finds active session with messages) |
| Two browser tabs open | Each tab manages its own context independently |
| Rapid navigation Home → Chat → Home | Cleanup effect fires on unmount, tab bar reappears |

## Files Changed

| File | Change |
|------|--------|
| `components/providers/active-session-provider.tsx` | **NEW** — Context + provider |
| `app/(main)/layout.tsx` | Wrap content in `ActiveSessionProvider`, remove prop from BottomTabBar |
| `components/ui/bottom-tab-bar.tsx` | Read `hasActiveSession` from context instead of prop |
| `components/chat/chat-view.tsx` | Sync session state to context via `useEffect` |
| `app/(main)/chat/page.tsx` | Dynamic `bottom-[84px]` / `bottom-0` based on context |

## Dependencies & Risks

- **Low risk:** Context is a standard React pattern, no new dependencies
- **Hydration:** `initialValue` from server query ensures SSR/client agreement on first render
- **Session completion edge case:** When session completes but user stays on `/chat`, the tab bar should reappear. This requires explicitly calling `setHasActiveSession(false)` when `sessionCompleted` becomes `true`, not just relying on unmount cleanup.
- **chat/page.tsx is currently a server component:** Reading context requires either converting to client component or extracting a small client wrapper. Prefer the wrapper to minimize blast radius.

## References

- Existing plan (partially superseded): `Docs/plans/2026-02-19-feat-tab-bar-session-exit-ux-plan.md`
- Bottom tab bar: `components/ui/bottom-tab-bar.tsx:101-111`
- Layout server query: `app/(main)/layout.tsx:20-34`
- ChatView session init: `components/chat/chat-view.tsx:301-489`
- SidebarContext (pattern reference): `components/chat/sidebar-context.tsx`
- Todo #014: `todos/014-pending-p3-chat-route-hide-contract.md` — can be closed after this fix
