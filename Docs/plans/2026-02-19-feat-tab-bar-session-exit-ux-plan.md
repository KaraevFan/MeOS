---
title: "feat: Tab Bar Session Exit UX"
type: feat
date: 2026-02-19
---

# Tab Bar Session Exit UX

## Overview

Three UX gaps were identified in the R4 playtest audit and are now spec'd in `Docs/UX_design.md` (Tab Bar Visibility State Machine) and `Docs/MVP_PRD.md` (Section 0):

1. **Tab bar hides on ALL `/chat` routes** — it should only hide during an *active* session with user messages
2. **Session header has no exit affordance** — it's a center-only badge; users have no clear way to leave mid-session
3. **No mid-session exit decision tree** — no "Pause & Exit" confirmation, no onboarding "Save & finish later" variant

---

## Problem Statement

The tab bar currently uses `pathname.startsWith('/chat')` as the sole visibility check (`bottom-tab-bar.tsx:106`). This hides navigation even when the user is on `/chat` with no active session (idle state, just opened chat). The result is navigational limbo: the user can't get back to Home, Life Map, or History without browser back.

When a session is active, there is no graceful exit path. Users who accidentally open a session or lose interest can only use the device's back gesture — there's no affordance, no state preservation, no confirmation.

---

## Proposed Solution

Three independent, surgical changes:

### Fix 1 — Tab bar visible on idle `/chat`

`layout.tsx` gains one additional Supabase query (mirrors the existing `onboarding_completed` pattern and the `ActiveSessionCard` query). The result is passed as a new `hasActiveSession` prop to `BottomTabBar`. The visibility check becomes:

```tsx
// bottom-tab-bar.tsx — replaces line 106
const isActiveSession = pathname.startsWith('/chat') && hasActiveSession
```

"Active session" is defined as: `status = 'active'` AND at least one `messages.role = 'user'` (inner join). This matches the definition used by `ActiveSessionCard` — consistent throughout.

### Fix 2 — Session header exit affordance

`SessionHeader` gains an `onExit?: () => void` prop. Layout changes from `justify-center` to a `relative` container with an absolute-left exit button (× icon). The center label stays centered.

```tsx
// session-header.tsx — new layout sketch
<div className="relative flex items-center justify-center py-3">
  {onExit && (
    <button className="absolute left-4" onClick={onExit}>
      <X className="w-4 h-4 text-text-secondary" />
    </button>
  )}
  <div className="flex items-center gap-2">
    <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
    <span className="text-[11px] text-text-secondary font-medium">{label}</span>
    {duration && <span className="text-[11px] text-text-secondary/60">{duration}</span>}
  </div>
</div>
```

### Fix 3 — Mid-session exit decision tree

`ChatView` gains a `handleExit()` function wired to `SessionHeader`'s `onExit`. Decision tree:

| Condition | Behavior |
|---|---|
| Onboarding (`life_mapping` + `new_user` state) | "Save & finish later" sheet → leave session `active`, navigate `/home` |
| Non-onboarding, `userMessageCount < 3` | Silent discard → set session to `abandoned`, navigate `/home` |
| Non-onboarding, `userMessageCount >= 3` | Pause confirmation sheet → "Pause & Exit" (leave active, navigate home) / "Keep Going" (dismiss) |

A new `ExitConfirmationSheet` component follows the existing `UserMenuSheet` bottom-sheet pattern (z-[40] backdrop + z-[50] sheet, `translate-y` animation).

---

## Technical Considerations

- **No DB schema change needed.** `status: 'abandoned'` already exists in the `SessionStatus` type. Leaving a session `active` is already the implicit pause mechanism (resume via `ActiveSessionCard`).
- **All fixed elements must use** `left-1/2 -translate-x-1/2 w-full max-w-[430px]` — from institutional learning `20260219`. The ExitConfirmationSheet must follow this pattern.
- **Loop-invariant `userMessageCount`** must be computed above the messages `.map()` loop — from institutional learning about O(n²) scan pattern.
- **Session header is not sticky** — it renders inside the scrollable message area. Consider whether it should be sticky for long sessions (out of scope, but note it).

---

## Acceptance Criteria

- [ ] Tab bar is **visible** when navigating to `/chat` with no active session (idle, returning user with no in-progress session)
- [ ] Tab bar is **hidden** when navigating to `/chat` with an active session (session with ≥1 user message, `status=active`)
- [ ] Session header shows an × button on the left during any active session
- [ ] Tapping × with 0-2 user messages: silently marks session `abandoned`, navigates to `/home`, no confirmation
- [ ] Tapping × with 3+ user messages: shows `ExitConfirmationSheet` with "Pause & Exit" and "Keep Going" options
- [ ] "Pause & Exit" leaves session `active` and navigates to `/home`; `ActiveSessionCard` appears on home screen
- [ ] "Keep Going" dismisses the sheet, session continues normally
- [ ] During onboarding (`life_mapping` + `new_user`): × shows "Save & finish later" variant; behavior = leave active, navigate home
- [ ] FAB continues to hide whenever the tab bar hides (no change needed — already follows tab bar)
- [ ] All fixed-position elements in `ExitConfirmationSheet` use the `left-1/2 -translate-x-1/2 w-full max-w-[430px]` constraint

---

## Dependencies & Risks

- **`layout.tsx` query performance:** Adding a second Supabase query (active session check) to the main layout adds ~10-20ms latency on every page. Acceptable for MVP but worth monitoring. Mitigation: the query is extremely lightweight (indexed `user_id + status + messages.role`).
- **`SessionHeader` scroll position:** The session header renders inside the scroll container — on long sessions it scrolls off-screen. The exit button becomes invisible mid-session. Out of scope for this PR, but worth a follow-up issue.
- **Server vs client component boundary:** `layout.tsx` is a server component. `BottomTabBar` is already `'use client'`. Passing `hasActiveSession` as a prop from server to client is valid and follows existing patterns.

---

## Files Changed

| File | Change |
|---|---|
| `app/(main)/layout.tsx` | Add active session query; pass `hasActiveSession` to `BottomTabBar` |
| `components/ui/bottom-tab-bar.tsx` | Accept `hasActiveSession` prop; update `isActiveSession` logic |
| `components/chat/session-header.tsx` | Add `onExit` prop; add × button with absolute positioning |
| `components/chat/chat-view.tsx` | Implement `handleExit()`; pass to `SessionHeader`; hook into `ExitConfirmationSheet` |
| `components/chat/exit-confirmation-sheet.tsx` | **New file** — bottom-sheet following `UserMenuSheet` pattern |

---

## References

- Spec: [`Docs/UX_design.md` — Tab Bar Visibility State Machine](../../Docs/UX_design.md)
- Spec: [`Docs/MVP_PRD.md` — Section 0: Navigation Visibility](../../Docs/MVP_PRD.md)
- Pattern reference: [`components/ui/user-menu-sheet.tsx`](../../components/ui/user-menu-sheet.tsx) (bottom-sheet)
- Existing active session query: [`lib/supabase/home-data.ts:87-128`](../../lib/supabase/home-data.ts)
- Tab bar: [`components/ui/bottom-tab-bar.tsx:100-110`](../../components/ui/bottom-tab-bar.tsx)
- Session header: [`components/chat/session-header.tsx`](../../components/chat/session-header.tsx)
- Institutional learnings: `docs/solutions/code-review-fixes/20260219-react-hooks-security-db-hygiene-multi-pass-review.md`
