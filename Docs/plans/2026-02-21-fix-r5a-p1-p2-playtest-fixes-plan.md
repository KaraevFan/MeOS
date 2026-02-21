---
title: "fix: R5a Playtest P1/P2 UX Fixes"
type: fix
date: 2026-02-21
brainstorm: Docs/brainstorms/2026-02-21-r5a-p1-p2-playtest-fixes-brainstorm.md
feedback: Docs/feedback/20260221_R5a_open_day_testing.md
---

# fix: R5a Playtest P1/P2 UX Fixes

## Overview

Batch of 7 fixes (3 P1, 4 P2) from Playtest 5 of the Open the Day flow. Addresses misplaced routing pills, a truncated energy check, non-interactive UI elements, missing day plan navigation, and two investigation items (calendar, artifact rendering). P0 date isolation is handled separately in PR #26.

## Problem Statement

The Open the Day morning ritual has several rough edges that break the intended flow:
- Routing pills from the `mapping_complete` state appear inside Open the Day, confusing the guided 5-step sequence
- The energy check shows only 3 of 5 options due to a hardcoded cap in both the parser and the pill component
- The "Something to sit with" prompt on Home is static with no interaction affordance
- The Day Plan tab only shows today with no way to view historical plans
- Calendar events aren't appearing in the morning ritual despite OAuth being configured
- The day plan artifact isn't rendering in either the chat or the Day tab

## Proposed Solution

Seven targeted fixes, ordered by dependency chain. Each fix is scoped to the minimum change needed.

---

## Phase 1: Foundation Fixes (Low Effort)

### 1.1 Verify auto-start behavior (Issue 5)

**Status:** Verified — not a code bug.

- `public/manifest.json` has `"start_url": "/home"` (correct)
- No middleware redirects to `/chat`
- No auto-redirect code in the home page or layout
- Root cause: mobile browser page restoration (bfcache) or PWA service worker serving cached `/chat` page

**Action:** Before next playtest, add a diagnostic log on Home page mount to confirm whether Home actually renders before any perceived redirect:

```typescript
// In the home screen client component
useEffect(() => {
  console.log('[MeOS] Home page mounted at', new Date().toISOString(), window.location.pathname)
}, [])
```

If Home mounts and then something navigates away, we'll see it in logs. If it never mounts, it's definitively bfcache/service worker. Also investigate `public/sw.js` stale-while-revalidate strategy for navigation requests (lines 38-53). Consider adding `Cache-Control: no-store` header on `/chat` responses.

**Files:**
- `components/home/home-screen.tsx` — add diagnostic `useEffect` log

### 1.2 Remove routing pills from Open the Day (Issue 6)

**Root cause:** `components/chat/chat-view.tsx:1175-1201` — `showStateQuickReplies` evaluates true when:
- `isLastMessage && isOpeningMessage && hasNoUserMessages && !isStreaming && !showPulseCheck && !hasSuggestedReplies`
- Session state is `mapping_complete` → generates 3 routing pills

These pills flash in the window between Sage's opening greeting and the AI's first response arriving with `[SUGGESTED_REPLIES]`.

**Fix:**

```typescript
// components/chat/chat-view.tsx — in the showStateQuickReplies calculation
const showStateQuickReplies = isLastMessage && isOpeningMessage && hasNoUserMessages
  && !isStreaming && !showPulseCheck && !hasSuggestedReplies
  && sessionType !== 'open_day' && sessionType !== 'close_day'  // ADD THIS
```

**Secondary fix — auto-trigger without BriefingCard:**

The SpecFlow analysis identified that when `briefingData` is null (no yesterday data), Open the Day has no BriefingCard, and therefore no `onStart` callback fires, so Sage never auto-triggers Step 1. The user sees a static greeting with routing pills and nothing happens.

```typescript
// components/chat/chat-view.tsx — add auto-trigger for open_day when no briefing
// In the existing useEffect that handles session initialization:
if (sessionType === 'open_day' && !briefingData && messages.length <= 1) {
  triggerSageResponse('none')
}
```

**Files:**
- `components/chat/chat-view.tsx` — add `sessionType` guard to `showStateQuickReplies` + add auto-trigger fallback

**Acceptance criteria:**
- [x] Opening Open the Day never shows "Start check-in early" / "Something on my mind" / "Update my life map" pills
- [x] Opening Close the Day never shows "Start check-in early" / "Something on my mind" / "Update my life map" pills
- [x] When no BriefingCard exists for `open_day`, Sage auto-triggers Step 1 (energy check) after the greeting
- [x] Verify whether `close_day` has the same no-briefing stall bug — if so, add equivalent auto-trigger
- [x] Other session types (life_mapping, weekly_checkin) still show state-based pills as before

---

## Phase 2: Energy Check Component (Medium Effort)

### 2.1 Raise parser cap for open_day suggested replies

**Root cause:** `lib/ai/parser.ts:391` — the `[SUGGESTED_REPLIES]` parser truncates to 3 items:
```typescript
const replies = blockContent.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 3)
```

The streaming parser at line 572 has the same cap.

**Fix:** Raise the cap to 5 for both parsers. The `SuggestionPills` component still has its own `.slice(0, 3)` at render time, so non-open_day sessions are unaffected.

```typescript
// lib/ai/parser.ts — both locations
const replies = blockContent.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 5)
```

**Files:**
- `lib/ai/parser.ts` — change `.slice(0, 3)` to `.slice(0, 5)` in both `parseMessage()` and `parseStreamingChunk()`

### 2.2 Build EnergyCheckChips component

**Purpose:** A purpose-built 5-option emoji+label chip selector for the Open the Day energy check. Does NOT replace `SuggestionPills` — used only for the energy check.

**Component spec:**

```typescript
// components/chat/energy-check-chips.tsx

interface EnergyOption {
  emoji: string
  label: string
  value: string  // sent as user message
}

const ENERGY_OPTIONS: EnergyOption[] = [
  { emoji: '🔥', label: 'Fired up', value: '🔥 Fired up' },
  { emoji: '⚡', label: 'Focused', value: '⚡ Focused' },
  { emoji: '😐', label: 'Neutral', value: '😐 Neutral' },
  { emoji: '😴', label: 'Low energy', value: '😴 Low energy' },
  { emoji: '😤', label: 'Stressed', value: '😤 Stressed' },
]

interface EnergyCheckChipsProps {
  onSelect: (value: string) => void
  disabled?: boolean
}
```

**Layout:**
- Horizontal flex row with `gap-2`, `overflow-x-auto` for scrollability on narrow screens
- Each chip: `rounded-full`, warm amber outline, 44px min height
- Selected state: filled warm amber background with white text
- Uses MeOS design tokens (cream-50, warm-amber, earth tones)

**Detection logic in ChatView:**

```typescript
// Detect energy check: session is open_day AND suggested_replies has 5 items
const isEnergyCheck = sessionType === 'open_day'
  && activePills.length === 5
  && messages.length <= 3  // only at the start of the session
```

When `isEnergyCheck` is true, render `<EnergyCheckChips>` instead of `<SuggestionPills>`.

**Files:**
- `components/chat/energy-check-chips.tsx` — new component
- `components/chat/chat-view.tsx` — detection logic + conditional rendering

**Acceptance criteria:**
- [x] Open the Day energy check shows all 5 options in a horizontal row
- [x] Each option is a 44px+ tap target
- [x] Tapping sends the emoji+label as a user message
- [x] Non-open_day sessions still use SuggestionPills with max 3

---

## Phase 3: Home Screen Interaction (Low-Medium Effort)

### 3.1 Make "Something to sit with" tappable → Sage conversation

**Current state:** `components/home/ambient-card.tsx` — static `<div>` with no click handler.

**Fix:** Make the card tappable. On tap, navigate to a Sage conversation seeded with the reflection prompt. A reflection prompt like "What conversation have you been putting off?" is a conversation starter, not a capture — pre-filling a text input with an existential question creates a dead-end interaction.

**Approach:** Use the same "Explore with Sage" pattern that captured thought cards already use on the Day tab. On tap, navigate to `/chat?mode=reflection&prompt=<encoded_prompt>`.

```typescript
// components/home/ambient-card.tsx
'use client'
interface AmbientCardProps {
  onTap?: (prompt: string) => void
}
// Render as tappable card with "Explore with Sage →" affordance in bottom-right
// Same visual pattern as captured thought cards on the Day tab
```

```typescript
// components/home/home-screen.tsx — wire tap to router navigation
const handleReflectionTap = (prompt: string) => {
  router.push(`/chat?mode=reflection&prompt=${encodeURIComponent(prompt)}`)
}
```

The chat view detects `mode=reflection` and creates a freeform session where Sage's opening message references the prompt naturally:

```
"You were sitting with this: '[prompt]' — want to unpack that?"
```

```typescript
// app/(main)/chat/page.tsx — handle mode=reflection + prompt searchParams
// Create a freeform/reflection session, seed the system prompt with the reflection question
// Sage references the prompt in its opening, then follows the user's lead
```

**Files:**
- `components/home/ambient-card.tsx` — make client component, add `onTap` prop, add "Explore with Sage" affordance, make tappable
- `components/home/home-screen.tsx` — wire `onTap` to router navigation
- `app/(main)/chat/page.tsx` — handle `mode=reflection` + `prompt` searchParams to seed a freeform session

**Acceptance criteria:**
- [x] Tapping "Something to sit with" navigates to a Sage conversation seeded with the reflection question
- [x] Sage's opening message references the prompt naturally (not verbatim repetition)
- [x] Session type is freeform — not `open_day` or `close_day`
- [ ] Back navigation returns to Home cleanly
- [x] "Explore with Sage" affordance is visible on the card (same pattern as Day tab captures)

---

## Phase 4: Investigation Items (Unknown Effort)

### 4.1 Calendar integration debug (Issue 9)

**Problem:** Calendar events don't appear in Open the Day despite OAuth being configured.

**Investigation plan (sequential):**

1. **Check integrations table:**
   ```sql
   SELECT * FROM integrations WHERE user_id = '<user_id>' AND provider = 'google_calendar';
   ```
   If no row → OAuth flow didn't store tokens. Check the OAuth callback route.

2. **Add logging to silent catch blocks:**
   - `lib/ai/context.ts:152-165` — add `console.error('Calendar fetch failed:', err)` in the empty catch
   - `lib/calendar/google-calendar.ts` — add logging for token refresh failures, API call failures

3. **Check token refresh behavior:**
   - `getValidToken()` deletes the integration row on ANY refresh failure (destructive). Replace with retry logic or at minimum add logging before deletion.
   - Verify `access_type: 'offline'` in OAuth request to ensure `refresh_token` is returned.

4. **Verify scope alignment:** Stored scopes in `integrations` table should include `calendar.readonly`.

5. **Test timezone on calendar query:** `getLocalMidnight()` / `getLocalEndOfDay()` should use the user's timezone (from `lib/dates.ts`), not server UTC.

**Files:**
- `lib/ai/context.ts` — add error logging in calendar catch block
- `lib/calendar/google-calendar.ts` — add logging, review `removeIntegration` behavior
- OAuth callback route (location TBD) — verify `access_type: 'offline'`

**Acceptance criteria:**
- [x] Server logs show clear error messages when calendar fetch fails
- [ ] If integration exists with valid tokens, calendar events appear in the Open the Day system prompt
- [ ] Token refresh failure does not silently delete the integration

### 4.2 Day Plan artifact rendering (Issue 11)

**Problem:** Two rendering gaps:
1. `[FILE_UPDATE type="day-plan"]` in `message-bubble.tsx` falls through to `return null` (no chat card)
2. `[DAY_PLAN_DATA]` block has no UI renderer (writes to Postgres only)

**Investigation plan:**

1. **Verify data is being generated:** Check if Open the Day sessions produce both `[FILE_UPDATE type="day-plan"]` and `[DAY_PLAN_DATA]` blocks in the raw message content.

2. **Verify Postgres writes succeed:** Check `day_plans` table for records matching today's date. If the P0 date isolation fix (PR #26) resolved the write issue, data should be correct now.

3. **Build chat card for day plan (if needed):**
   In `components/chat/message-bubble.tsx`, add a case for `fileType === 'day-plan'`:
   ```typescript
   case 'day-plan':
     return <DayPlanConfirmationCard intention={...} />
   ```
   This could be a simple confirmation card ("Day plan set — view in Day tab") rather than rendering the full artifact inline in chat.

4. **Verify Day tab rendering post-P0-fix:** After PR #26 lands with correct date isolation, the existing `IntentionCard` + `MorningSnapshotCard` + `CapturedThoughts` on the Day tab may already render correctly. Verify before building new components.

**Files:**
- `components/chat/message-bubble.tsx` — add `day-plan` case in `SegmentRenderer`
- Potentially: `components/chat/day-plan-confirmation-card.tsx` — new lightweight card
- Verify: `components/day-plan/day-plan-view.tsx` — ensure existing cards render correctly with P0 fix

**Acceptance criteria:**
- [x] After Open the Day completes, chat shows a visual indicator that the day plan was created (not just text)
- [ ] Day tab shows the correct data for today's plan (intention, energy, priorities)
- [ ] If data is missing, clear investigation trail shows where the pipeline breaks

---

## Phase 5: Day Plan Swipe Navigation (Medium-High Effort)

### 5.1 Convert Day page to support date parameter

**Current state:** `app/(main)/day/page.tsx` is a server component hardcoded to today's date.

**Approach:** Use URL searchParams for the date. Keep as server component for initial load, but add client-side navigation for swipe.

```typescript
// app/(main)/day/page.tsx
export default async function DayPage({ searchParams }: { searchParams: { date?: string } }) {
  const tz = getUserTimezone()
  const today = getLocalDateString(tz)
  const targetDate = searchParams.date || today
  const data = await getDayPlanWithCaptures(supabase, user.id, targetDate)
  return <DayPlanSwipeContainer initialDate={targetDate} today={today} initialData={data} />
}
```

### 5.2 Build DayPlanSwipeContainer

**Purpose:** Client-side swipeable wrapper around `DayPlanView`.

**Spec:**
- Holds the current date in state
- On swipe left: decrement date, fetch data for new date
- On swipe right: increment date (capped at today)
- Show loading state while fetching adjacent day data
- Use native touch events (no extra library) with a gesture threshold (~50px horizontal, reject if >30px vertical)

**Date navigation:**
- Today capped as rightmost boundary (no future dates)
- Left boundary: earliest `day_plans` record for user, or 30-day lookback max
- "Return to today" button visible when viewing past dates

**Empty day state:**
- Show date header + "No plan for this day" placeholder with muted text
- Still show any captures that exist for that date (captures can exist without a day plan)

**Prev/next arrow buttons:** Include as supplementary navigation alongside swipe for accessibility. Small arrow icons flanking the date header.

**Data fetching:** Client-side fetch to a new API route:

```typescript
// app/api/day-plan/route.ts
// GET /api/day-plan?date=2026-02-20
// Returns: { dayPlan, captures, streak }
```

**Files:**
- `app/(main)/day/page.tsx` — accept `searchParams.date`, pass to new container
- `components/day-plan/day-plan-swipe-container.tsx` — new client component
- `components/day-plan/day-plan-view.tsx` — accept `date` as prop instead of using `new Date()`
- `app/api/day-plan/route.ts` — new API route for client-side date fetching

**Acceptance criteria:**
- [x] Swiping left on Day tab navigates to the previous day's plan
- [x] Swiping right on Day tab navigates to the next day (capped at today)
- [x] Date header updates to show the viewed date
- [x] Days without plans show a clean empty state
- [x] Arrow buttons work as alternative to swipe gesture
- [x] "Return to today" button appears when viewing past dates
- [x] Uses `getLocalDateString(timezone)` for all date operations

---

## Dependencies & Build Order

```
Phase 1 ─── 1.1 Diagnostic log for auto-start
         └── 1.2 Remove routing pills + auto-trigger fallback
                   │
Phase 2 ─── 2.1 Parser cap ──→ 2.2 EnergyCheckChips
                   │
Phase 5 ─── 5.1-5.2 Day Plan swipe navigation (demo polish)
                   │
Phase 3 ─── 3.1 Ambient card → Sage conversation (engagement)
                   │
Phase 4 ─── 4.1 Calendar debug + 4.2 Artifact rendering (background investigation)
```

**Recommended build order for demo readiness:**

1. **Phase 1** (routing pills + auto-trigger) — unblocks the morning ritual flow
2. **Phase 2** (parser cap + energy chips) — completes the morning ritual feel
3. **Phase 5** (day plan swipe navigation) — visually impressive demo feature; P0 date fix means Day tab shows correct per-day data, navigation lets you *show* that
4. **Phase 3** (ambient card → Sage conversation) — engagement feature
5. **Phase 4** (calendar + artifact investigations) — background investigation, fix if straightforward

- Phase 1-2 are sequential (routing pills must be suppressed before energy chips make sense)
- Phase 5 is promoted because the P0 date fix means the Day tab should already show correct data — navigation is the missing piece for demo value
- Phase 3 is independent but lower priority for demo readiness
- Phase 4 investigations can run in background at any point

## Success Metrics

- Open the Day flow completes in 5-6 turns without confusion
- All 5 energy options visible and tappable
- "Something to sit with" gets tapped (analytics event) at least once per week
- Day tab shows correct data for current and historical days
- Calendar events appear in morning briefing (if connected)

## References

- Brainstorm: `Docs/brainstorms/2026-02-21-r5a-p1-p2-playtest-fixes-brainstorm.md`
- Feedback: `Docs/feedback/20260221_R5a_open_day_testing.md`
- Unified pills brainstorm: `Docs/brainstorms/2026-02-19-unified-suggestion-pills-brainstorm.md`
- Date isolation fix: PR #26, `Docs/solutions/logic-errors/2026-02-21-server-side-utc-date-bug.md`
- CSS Grid height: `Docs/solutions/ui-bugs/chat-input-pushed-offscreen-css-grid-height.md`
- Open the Day skill: `skills/open-day.md`
