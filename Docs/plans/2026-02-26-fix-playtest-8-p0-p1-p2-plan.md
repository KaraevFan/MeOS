---
title: "fix: Playtest 8 — Day Plan Persistence, Context Deep-Link, Domains Nudge"
type: fix
date: 2026-02-26
brainstorm: Docs/brainstorms/2026-02-26-playtest-8-fixes-brainstorm.md
---

# fix: Playtest 8 — Day Plan Persistence, Context Deep-Link, Domains Nudge

## Overview

Three bugs + one feature from Playtest 8, plus a cross-cutting timezone audit. Scoped to ship reliability fixes (P0, P1) first, then the nudge (P2).

**Source:** `Docs/feedback/20260226_playtest_8.md`

## Problem Statement

1. **P0 — Day Plan Not Populating:** After completing "Open the Day," the Day view shows "No plan for this day." The DayPlanConfirmationCard appeared in chat (data was parsed), but the Postgres row was either not written or queried incorrectly.

2. **P1 — "Explore with Sage" Drops Context:** Tapping "Explore with Sage" from the AmbientCard on the Home screen resumes an existing life mapping session instead of starting a fresh reflection seeded with the prompt.

3. **P2 — No Nudge for Unexplored Domains:** Users with partially mapped life domains have no gentle encouragement to continue mapping on the Home screen.

## Proposed Solution

### P0: Fix Day Plan Write Reliability

**Root cause (confirmed via code trace):** The Postgres write in [chat-view.tsx:1026-1060](components/chat/chat-view.tsx#L1026-L1060) is **fire-and-forget** (`.then().catch()`). Two failure modes:

1. **Race condition:** User taps "View day plan" on the DayPlanConfirmationCard before the async `getOrCreateTodayDayPlan()` + `updateDayPlan()` chain completes. The Day view server component fetches an empty or incomplete row.
2. **Silent write failure:** `.catch()` handlers only `console.error()` — Supabase errors are invisible. Auth token expiry, constraint violations, or network failures go unnoticed.

The timezone handling is actually correct in the current code — both the client write (`Intl.DateTimeFormat().resolvedOptions().timeZone`) and the server read (`getUserTimezone()` → `getLocalDateString()`) use timezone-aware utilities.

**Fix:**

#### Step 1: Await the day plan write before showing the confirmation card

In [chat-view.tsx](components/chat/chat-view.tsx), refactor the fire-and-forget day plan write into an awaited operation. The DayPlanConfirmationCard's "View day plan" link should only be active after the write succeeds.

```typescript
// BEFORE (fire-and-forget):
getOrCreateTodayDayPlan(supabase, userId, clientTimezone).then((dayPlan) => {
  updateDayPlan(supabase, userId, dayPlan.date, updateData).catch(...)
}).catch(...)

// AFTER (awaited, with error surfacing):
try {
  const dayPlan = await getOrCreateTodayDayPlan(supabase, userId, clientTimezone)
  await updateDayPlan(supabase, userId, dayPlan.date, updateData)
  setDayPlanWriteComplete(true)  // Enables "View day plan" link
} catch (err) {
  console.error('[ChatView] Day plan write failed:', err)
  // Optionally surface to user: "Day plan saved to chat but couldn't sync to your day view"
}
```

**Note:** This refactoring moves the day plan write out of the fire-and-forget pattern. The write needs to happen in the `sendMessage` response processing, and we need a state flag to gate the "View day plan" link.

#### Step 2: Add error surfacing to day plan queries

In [day-plan-queries.ts](lib/supabase/day-plan-queries.ts), ensure `updateDayPlan()` throws on Supabase errors instead of silently returning:

```typescript
// Verify updateDayPlan throws on error (not just console.error)
export async function updateDayPlan(...) {
  const { error } = await supabase.from('day_plans').update(...)...
  if (error) throw new Error(`Failed to update day plan: ${error.message}`)
}
```

**Files to modify:**
- [components/chat/chat-view.tsx](components/chat/chat-view.tsx) — lines 1026-1060: Await the write, add state flag
- [components/chat/day-plan-confirmation-card.tsx](components/chat/day-plan-confirmation-card.tsx) — Gate "View day plan" link on write completion
- [lib/supabase/day-plan-queries.ts](lib/supabase/day-plan-queries.ts) — Verify error handling in `updateDayPlan()`

---

### P1: Fix Session Dedup Overriding Navigation Context

**Root cause (confirmed via code trace):** In [chat/page.tsx:105-110](app/(main)/chat/page.tsx#L105-L110), the session dedup guard checks for `!params.explore`, `!params.nudge`, `!params.session_context`, `!params.precheckin` — but does NOT check for `!params.mode` or `!params.prompt`.

When navigating via `AmbientCard` → `/chat?mode=reflection&prompt=...`:
1. `sessionType` = `open_conversation` (correct, line 92)
2. Dedup guard fires — all four checks pass (explore/nudge/session_context/precheckin are absent)
3. Recent active `open_conversation` found → `resumeOpenConversationId` set
4. `nudgeContext` IS correctly assigned (lines 148-151) but ignored because session is resumed

**Fix:**

#### Step 1: Add `params.mode` to the dedup guard

```typescript
// chat/page.tsx lines 105-110
// BEFORE:
if (
  sessionType === 'open_conversation' &&
  !params.explore &&
  !params.nudge &&
  !params.session_context &&
  !params.precheckin
)

// AFTER — add mode guard:
if (
  sessionType === 'open_conversation' &&
  !params.explore &&
  !params.nudge &&
  !params.session_context &&
  !params.precheckin &&
  !params.mode  // Reflection prompts and other mode-driven navigation warrant fresh session
)
```

This is the minimal, precise fix. When `mode=reflection` is present, the dedup is skipped, a fresh session is created, and `nudgeContext` flows through correctly to `ChatView` → session metadata → system prompt injection.

**Files to modify:**
- [app/(main)/chat/page.tsx](app/(main)/chat/page.tsx) — line 110: Add `&& !params.mode`

---

### P2: Unexplored Domains Nudge on Home Screen

**Design:** Sage-voice card on the Home screen showing unmapped domains as a gentle invitation, not a progress metric.

#### Step 1: Add unmapped domain data to HomeData

In [lib/supabase/home-data.ts](lib/supabase/home-data.ts), compute which domains have been mapped by checking which domain files exist in Supabase Storage:

```typescript
// In getHomeData():
const domainFiles = await ufs.listFiles('life-map/')
const mappedDomains = ALL_DOMAINS.filter((d) => {
  const filename = DOMAIN_FILE_MAP[d]
  return domainFiles.some((f) => f.includes(filename))
})
const unmappedDomains = ALL_DOMAINS.filter((d) => !mappedDomains.includes(d))
```

Add to `HomeData` interface:

```typescript
export interface HomeData {
  // ... existing fields
  unmappedDomains: DomainName[]
  totalDomains: number
}
```

Thread through [app/(main)/home/page.tsx](app/(main)/home/page.tsx) → `HomeScreen` props.

#### Step 2: Create LifeMapNudge component

New file: `components/home/life-map-nudge.tsx`

```typescript
// Sage-voice card — warm, invitational
// Shows when unmappedDomains.length > 0
// Uses DOMAIN_SHORT_NAMES for display
// CTA links to /chat?type=life_mapping
// Copy variants:
//   - Many unmapped: "There are parts of your map we haven't explored yet — want to go deeper?"
//   - Few unmapped: "We're almost there — just {names} left to explore."
//   - One unmapped: "One last domain to map: {name}. Want to round it out?"
```

Design follows MeOS design system:
- Rounded card (18px), cream background, warm border
- "YOUR LIFE MAP" header (11px uppercase tracking)
- Sage-voice italic copy (15px, warm-dark/60)
- "Continue mapping" CTA (12px, primary color)
- No progress bars, no completion percentages

#### Step 3: Place in Home screen layout

In [home-screen.tsx](components/home/home-screen.tsx), render `LifeMapNudge` after the primary HeroCard and CaptureBar, before the AmbientCard. Only shown when `unmappedDomains.length > 0`.

**Files to create/modify:**
- New: [components/home/life-map-nudge.tsx](components/home/life-map-nudge.tsx)
- [lib/supabase/home-data.ts](lib/supabase/home-data.ts) — Add domain mapping check
- [components/home/home-screen.tsx](components/home/home-screen.tsx) — Add `LifeMapNudge` to layout + update `HomeScreenData` interface
- [app/(main)/home/page.tsx](app/(main)/home/page.tsx) — Thread new data fields

---

### Cross-cutting: Timezone Audit

**Current state:** Post-PR #27, most code correctly uses `lib/dates.ts` utilities. The audit confirms minimal remaining issues.

#### Remaining UTC patterns to fix

1. **`lib/markdown/frontmatter.ts` line 84**: `generateCheckInFrontmatter()` fallback uses `new Date().toISOString().split('T')[0]`. While callers always pass the date, the fallback is unsafe. Fix: remove the fallback and make `date` required, OR thread timezone.

2. **Client-side `new Date().getHours()`**: Used in `home-screen.tsx:43` (`detectTimeState()`) and `lib/utils.ts:36`. These are client-side and SAFE per architectural rules (browser has correct timezone natively). No fix needed.

3. **ESLint guard gap**: The existing `no-restricted-syntax` rules block `toLocaleDateString('en-CA')`, `todayLocalDate()`, and `toISOString().split('T')`. Consider adding a rule for `new Date().toISOString().split` (the specific substring pattern used in frontmatter fallbacks).

#### Audit checklist

- [ ] `lib/supabase/day-plan-queries.ts` — All functions accept timezone param (verified: correct)
- [ ] `lib/markdown/file-write-handler.ts` — `resolveFileUpdatePath()` accepts timezone (verified: correct)
- [ ] `lib/markdown/frontmatter.ts` — Remove unsafe UTC fallback in `generateCheckInFrontmatter()`
- [ ] `app/(main)/day/page.tsx` — Uses `getLocalDateString(tz)` (verified: correct)
- [ ] `app/api/chat/route.ts` — Resolves timezone at entry (verified: correct)
- [ ] `app/api/day-plan/route.ts` — Verify date param validation uses timezone
- [ ] `components/chat/chat-view.tsx` — Client-side uses `Intl.DateTimeFormat().resolvedOptions().timeZone` (verified: correct)

**Files to modify:**
- [lib/markdown/frontmatter.ts](lib/markdown/frontmatter.ts) — Fix `generateCheckInFrontmatter()` date fallback

---

## Acceptance Criteria

### P0 — Day Plan Persistence
- [x] After completing "Open the Day," navigating to the Day view immediately shows the day plan (intention, priorities, energy level)
- [x] The "View day plan" link on DayPlanConfirmationCard is gated on write completion
- [x] Supabase write errors surface in logs (not swallowed by `.catch()`)
- [x] Works correctly in JST (+9) timezone

### P1 — Context Deep-Link
- [x] Tapping "Explore with Sage" from AmbientCard opens a fresh conversation seeded with the reflection prompt
- [x] Sage's opening message acknowledges the specific prompt
- [x] Existing active sessions are NOT resumed when explicit navigation context is present
- [x] The `mode=reflection` path continues to validate prompts against the allowlist

### P2 — Unexplored Domains Nudge
- [x] Home screen shows a Sage-voice card when domains are unmapped
- [x] Card copy references specific unmapped domain names
- [x] Tapping CTA opens a life mapping continuation session
- [x] Card disappears when all 8 domains are mapped
- [x] Card does NOT appear on the Day view

### Timezone Audit
- [x] `frontmatter.ts` date fallback removed or made timezone-aware
- [x] Audit checklist above all verified
- [x] No regression in existing timezone-dependent features

---

## Build Order

| Phase | Task | Priority | Est. Effort |
|-------|------|----------|-------------|
| 1 | P1: Add `!params.mode` to dedup guard | P1 | ~15 min |
| 2 | P0: Await day plan write + error surfacing | P0 | ~45 min |
| 3 | Timezone audit + frontmatter fix | P1 | ~30 min |
| 4 | P2: Home data + LifeMapNudge component | P2 | ~1 hr |

P1 is listed first because it's a one-line fix with immediate impact. P0 requires more careful refactoring of async flow.

---

## References & Research

### Internal References
- Brainstorm: [Docs/brainstorms/2026-02-26-playtest-8-fixes-brainstorm.md](Docs/brainstorms/2026-02-26-playtest-8-fixes-brainstorm.md)
- Prior timezone fix: [Docs/solutions/logic-errors/2026-02-21-server-side-utc-date-context-injection-bug.md](Docs/solutions/logic-errors/2026-02-21-server-side-utc-date-context-injection-bug.md)
- React state race condition: [Docs/solutions/logic-errors/2026-02-24-react-state-guard-race-condition-stale-batching.md](Docs/solutions/logic-errors/2026-02-24-react-state-guard-race-condition-stale-batching.md)
- Silent DB failures: [Docs/solutions/database-issues/2026-02-25-postgres-status-constraint-mismatch-expired-value.md](Docs/solutions/database-issues/2026-02-25-postgres-status-constraint-mismatch-expired-value.md)

### Key Files
| Concern | File |
|---------|------|
| Session dedup (P1 bug) | [app/(main)/chat/page.tsx:105-110](app/(main)/chat/page.tsx#L105-L110) |
| Day plan fire-and-forget (P0 bug) | [components/chat/chat-view.tsx:1026-1060](components/chat/chat-view.tsx#L1026-L1060) |
| Day plan queries | [lib/supabase/day-plan-queries.ts](lib/supabase/day-plan-queries.ts) |
| Home screen data | [lib/supabase/home-data.ts](lib/supabase/home-data.ts) |
| Home screen layout | [components/home/home-screen.tsx](components/home/home-screen.tsx) |
| AmbientCard | [components/home/ambient-card.tsx](components/home/ambient-card.tsx) |
| Timezone utilities | [lib/dates.ts](lib/dates.ts) |
| Frontmatter fallback | [lib/markdown/frontmatter.ts](lib/markdown/frontmatter.ts) |
| Domain constants | [lib/constants.ts](lib/constants.ts) |
