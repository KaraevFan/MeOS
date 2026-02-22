---
title: "fix: Playtest 6 UI & conversation flow fixes"
type: fix
date: 2026-02-22
source: Docs/feedback/20260222_Playtest_6.md
---

# Playtest 6 — UI & Conversation Flow Fixes

Three independent tickets from Playtest 6 feedback: dynamic morning opening message, pulse check redesign, and calendar widget on Day Plan page.

## Overview

| Ticket | Summary | Effort | Key Files |
|--------|---------|--------|-----------|
| A | Replace hard-coded morning opening with AI-generated, context-rich greeting | Small | `chat-view.tsx`, `app/api/chat/route.ts`, `skills/open-day.md` |
| B | Fix emoji doubling + redesign energy check from horizontal scroll to vertical card | Medium | `energy-check-chips.tsx` (rename to `energy-check-card.tsx`), `chat-view.tsx`, `skills/open-day.md` |
| C | Add calendar section to Day Plan page | Small-Medium | `day-plan-view.tsx`, `day/page.tsx`, move `CalendarCard`/`CalendarConnectCard` to `/components/ui/` |

Implementation order: **B → A → C** (B fixes the most visually broken component, A is prompt-only + small API change, C is additive).

---

## Ticket A: Dynamic Morning Opening Message

### Problem

The hard-coded opening `"Good morning, [name]. Let's set the tone for today."` is generic and puts the burden on the user. The AI already has rich context (calendar, yesterday's data, weekly priorities) but the user sees a static message first.

### Approach

Remove the hard-coded opening message for `open_day` sessions. Let the AI's first response BE the opening. The `skills/open-day.md` prompt already instructs Sage on how to open warmly with context — the hard-coded message was redundant scaffolding.

### Key Decision

**Allow empty messages for `open_day` in the API.** Currently `ChatRequestSchema` requires `.min(1)` messages. When the hard-coded opening is removed, `triggerSageResponse` sends an empty array. Fix: use Zod `.superRefine()` to allow 0 messages when `sessionType === 'open_day'`.

### Changes

#### 1. `app/api/chat/route.ts` — Relax message validation for open_day

```typescript
// Before (line 40-43):
messages: z.array(z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().max(10_000),
})).min(1).max(100),

// After: remove .min(1), add superRefine
messages: z.array(z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().max(10_000),
})).max(100),
// + superRefine on the whole schema:
}).superRefine((data, ctx) => {
  if (data.messages.length === 0 && data.sessionType !== 'open_day') {
    ctx.addIssue({
      code: z.ZodIssueCode.too_small,
      minimum: 1,
      type: 'array',
      inclusive: true,
      message: 'Messages array must have at least 1 item',
      path: ['messages'],
    })
  }
})
```

#### 2. `components/chat/chat-view.tsx` — Remove hard-coded opening for open_day

In `getSageOpening()` (line 125-126):
- Remove the `case 'open_day'` branch entirely
- In `init()` (around line 421-447): skip the opening message insertion when `sessionType === 'open_day'`
- The `triggerSageResponse('none')` call at line 464-469 already fires for open_day — this becomes the first response

**Loading state fix:** Show the typing indicator immediately for open_day sessions so the user doesn't see a blank screen:
- After session creation for open_day, set `isStreaming` to `true` before the `setTimeout` fires
- The `TypingIndicator` component already renders when `isStreaming && !streamingText`

#### 3. `skills/open-day.md` — Add opening message guidance to Step 1

Update Step 1 (Energy Check) to include the opening message instructions from the feedback:

```markdown
### Step 1: Energy Check (~15 seconds)

Your opening message is the most important moment. Lead with context — the day,
what's on the calendar, what carried over from yesterday — so the user can orient
quickly and react rather than generate energy from scratch.

**Good openings:**
- "Morning, Tom. It's Sunday — quiet calendar. You've got two things carried
  from yesterday: calendar integration and picking up contact lenses. How are
  you feeling heading in?"
- "Hey Tom, Wednesday. You've got a 10am with Sarah and a 2pm design review.
  Yesterday you said you wanted to focus on the MVP spec — still the priority?"

**Bad openings:**
- "Let's set the tone for today." (too vague)
- "Good morning! How are you feeling?" (generic, doesn't use context)
- "Ready to make today count?" (motivational poster energy)

Keep to 2-3 sentences max. After the opening, emit energy pills immediately.

**First-ever morning session** (no yesterday data, no weekly plan):
"Morning, [name]. This is your first morning session — I'll keep it quick.
How are you feeling heading into today?"
```

### Edge Cases

- **Existing sessions in DB:** Sessions created before this change already have the hard-coded opening stored. `resumeSessionId` path loads existing messages — the old greeting is harmless in history.
- **BriefingCard path:** When `briefingData` exists, `BriefingCard.onStart` calls `triggerSageResponse('none')`. With the empty messages fix, this now works — the AI generates the opening after the user dismisses the briefing card.
- **StrictMode double-mount:** The `isStreaming` guard in `triggerSageResponse` prevents duplicate triggers.

### Acceptance Criteria

- [x] Opening message references at least one piece of real context (day of week, calendar, yesterday's items)
- [x] Opening message is AI-generated, not hard-coded
- [x] Tone is warm and specific, not generic motivational
- [x] First-ever session has a graceful fallback
- [x] Opening is 2-3 sentences max, flows into energy check pills
- [x] Typing indicator appears immediately (no blank screen gap)
- [x] BriefingCard path works with empty messages array

---

## Ticket B: Pulse Check / Energy Check Redesign

### Problem

Two bugs in the current `EnergyCheckChips` component:
1. **Emoji doubling:** AI prompt emits `🔥 Fired up` → `getEmoji()` strips emoji, looks up `"fired up"` → finds `🔥` → renders `🔥` (lookup) + `🔥 Fired up` (label) = `🔥 🔥 Fired up`
2. **Horizontal overflow:** Options use `overflow-x-auto` flex row, requiring scroll to see all 5 options

### Approach

1. Fix emoji doubling in the AI prompt (strip emoji from `[SUGGESTED_REPLIES]` labels in `open-day.md`)
2. Rebuild `EnergyCheckChips` as a vertical card component (`EnergyCheckCard`)
3. Use Option A from the feedback: full-width card with 5 vertically stacked tappable rows

### Changes

#### 1. `skills/open-day.md` — Strip emoji from SUGGESTED_REPLIES labels

```markdown
# Before:
[SUGGESTED_REPLIES]
🔥 Fired up
⚡ Focused
😐 Neutral
😴 Low energy
😤 Stressed
[/SUGGESTED_REPLIES]

# After:
[SUGGESTED_REPLIES]
Fired up
Focused
Neutral
Low energy
Stressed
[/SUGGESTED_REPLIES]
```

The `getEmoji()` lookup in the component handles emoji decoration. This is the canonical source — the AI prompt should emit clean labels.

#### 2. `components/chat/energy-check-chips.tsx` → Rename to `components/chat/energy-check-card.tsx`

Replace the horizontal flex layout with a vertical card:

```tsx
// New component: EnergyCheckCard
'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { SuggestionPill } from './suggestion-pills'

const ENERGY_EMOJI: Record<string, string> = {
  'fired up': '🔥',
  'focused': '⚡',
  'neutral': '😐',
  'low energy': '😴',
  'stressed': '😤',
}

function getEmoji(label: string): string | undefined {
  const key = label.toLowerCase().replace(/^[\p{Emoji}\s]+/u, '').trim()
  return ENERGY_EMOJI[key]
}

interface EnergyCheckCardProps {
  pills: SuggestionPill[]
  onSelect: (value: string) => void
  disabled?: boolean
}

export function EnergyCheckCard({ pills, onSelect, disabled }: EnergyCheckCardProps) {
  const [selectedValue, setSelectedValue] = useState<string | null>(null)

  function handleSelect(pill: SuggestionPill) {
    if (selectedValue || disabled) return
    setSelectedValue(pill.value)
    onSelect(pill.value)
  }

  return (
    <div className="px-4 py-2 animate-fade-in-up">
      <div className="bg-bg border border-border rounded-2xl overflow-hidden">
        <p className="px-4 pt-3.5 pb-2 text-[13px] font-medium text-warm-gray">
          How are you feeling today?
        </p>
        <div className="flex flex-col">
          {pills.map((pill, i) => {
            const emoji = getEmoji(pill.label)
            const isSelected = selectedValue === pill.value
            const isDisabled = selectedValue !== null && !isSelected

            return (
              <button
                key={pill.value}
                type="button"
                onClick={() => handleSelect(pill)}
                disabled={disabled || selectedValue !== null}
                className={cn(
                  'flex items-center gap-3 px-4 min-h-[44px] text-left',
                  'transition-all duration-150',
                  i < pills.length - 1 && 'border-b border-border/50',
                  isSelected
                    ? 'bg-primary/10 text-primary font-semibold'
                    : isDisabled
                      ? 'opacity-40'
                      : 'hover:bg-primary/5 active:bg-primary/10',
                )}
              >
                {emoji && (
                  <span className="text-lg leading-none w-6 text-center">{emoji}</span>
                )}
                <span className="text-[15px]">{pill.label}</span>
                {isSelected && (
                  <span className="ml-auto text-primary text-sm">✓</span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
```

Key design decisions:
- **Vertical stack** inside a card with warm off-white background
- **44px min-height** per row (touch targets)
- **One-tap select:** `selectedValue` state locks interaction after first tap
- **Visual confirmation:** Selected row gets amber/gold highlight + checkmark
- **Non-interactive after selection:** `disabled` via `selectedValue !== null`
- **No scrolling needed:** 5 rows at 44px = 220px + header = ~260px total

#### 3. `components/chat/chat-view.tsx` — Update import and detection logic

```typescript
// Update import:
import { EnergyCheckCard } from './energy-check-card'

// Update render condition (around line 1233):
// Keep the same detection logic but use new component name
{sessionType === 'open_day' && activePills.length >= 4 && messages.length <= 3 ? (
  <EnergyCheckCard
    pills={activePills}
    onSelect={handlePillSelect}
    disabled={isStreaming}
  />
) : ...}
```

### Edge Cases

- **AI emits fewer than 5 options:** The `activePills.length >= 4` guard falls back to regular `SuggestionPills`. Acceptable degradation.
- **iPhone SE (320px width):** Card uses `px-4` = 16px each side = 288px content width. Vertical layout fits — no overflow.
- **Keyboard visible:** 260px card height fits comfortably above mobile keyboard (typical viewport above keyboard: ~350-400px).

### Acceptance Criteria

- [x] All 5 mood options visible at once without scrolling
- [x] Single emoji per option (doubling bug fixed via prompt change)
- [x] One tap to select — no confirmation step, conversation flows immediately
- [x] Selected option has amber highlight + checkmark
- [x] Component is non-interactive after selection
- [x] Touch targets meet 44px minimum height
- [x] Works on 320px minimum viewport width

---

## Ticket C: Calendar Widget on Day Plan Page

### Problem

The `/day` page has zero calendar references. The Home screen shows `CalendarCard` (if events) or `CalendarConnectCard` (if not connected), but the Day Plan page — where calendar context matters most — shows nothing.

### Approach

1. Move `CalendarCard`, `CalendarConnectCard`, and `InfoCard` from `/components/home/` to `/components/ui/`
2. Fetch calendar data server-side in `/day/page.tsx` (today only — no historical dates)
3. Add calendar section to `DayPlanView` between `IntentionCard` and `MorningSnapshotCard`
4. Pass calendar data through `DayPlanSwipeContainer` to `DayPlanView`

### Key Decision

**Calendar is today-only on the Day Plan page.** When the user swipes to historical dates, no calendar section appears. This avoids extra Google Calendar API calls per swipe and keeps the implementation simple. Calendar context for past dates isn't actionable anyway.

### Changes

#### 1. Move shared components to `/components/ui/`

Move these files:
- `components/home/info-card.tsx` → `components/ui/info-card.tsx`
- `components/home/calendar-card.tsx` → `components/ui/calendar-card.tsx`
- `components/home/calendar-connect-card.tsx` → `components/ui/calendar-connect-card.tsx`

Update all imports in:
- `components/home/home-screen.tsx`
- Any other files importing `InfoCard` from `./info-card`

#### 2. `app/(main)/day/page.tsx` — Fetch calendar data server-side

```typescript
import { getCalendarEvents, hasCalendarIntegration } from '@/lib/calendar/google-calendar'
import { getLocalDateString } from '@/lib/dates'

// Inside the page component, after existing data fetch:
const todayStr = getLocalDateString(tz)
const [hasCalendar, calendarEvents] = await Promise.all([
  hasCalendarIntegration(user.id),
  getCalendarEvents(user.id, todayStr, tz).catch(() => []),
])

// Pass to DayPlanSwipeContainer:
<DayPlanSwipeContainer
  // ... existing props
  calendarEvents={calendarEvents}
  hasCalendarIntegration={hasCalendar}
  todayStr={todayStr}
/>
```

#### 3. `components/day-plan/day-plan-swipe-container.tsx` — Thread calendar props

Add new props to the container and pass them to `DayPlanView` only when displaying today's date:

```typescript
interface DayPlanSwipeContainerProps {
  // ... existing props
  calendarEvents?: CalendarEvent[]
  hasCalendarIntegration?: boolean
  todayStr?: string
}

// In render, when currentDate === todayStr, pass calendar data:
<DayPlanView
  data={data}
  date={currentDate}
  calendarEvents={currentDate === todayStr ? calendarEvents : undefined}
  hasCalendarIntegration={currentDate === todayStr ? hasCalendarIntegration : undefined}
/>
```

#### 4. `components/day-plan/day-plan-view.tsx` — Add calendar section

```typescript
import { CalendarCard } from '@/components/ui/calendar-card'
import { CalendarConnectCard } from '@/components/ui/calendar-connect-card'
import type { CalendarEvent } from '@/lib/calendar/types'

interface DayPlanViewProps {
  data: DayPlanWithCaptures
  date?: string
  calendarEvents?: CalendarEvent[]
  hasCalendarIntegration?: boolean
}

// In the JSX, between IntentionCard and MorningSnapshotCard:
{/* Calendar section — today only */}
{calendarEvents && calendarEvents.length > 0 ? (
  <CalendarCard
    summary={`${calendarEvents.length} event${calendarEvents.length === 1 ? '' : 's'} today`}
    events={calendarEvents}
  />
) : hasCalendarIntegration === false ? (
  <CalendarConnectCard />
) : null}
```

**Placement rationale:** Calendar sits between IntentionCard (the user's focus) and MorningSnapshotCard (the Sage briefing). This puts today's schedule directly below the intention — "here's what you're focused on, and here's what's on your calendar."

**Zero-events state:** If calendar is connected but no events today, show nothing. The empty calendar isn't useful information.

### Edge Cases

- **Calendar fetch fails (expired token):** `.catch(() => [])` returns empty array — no calendar section renders. Silent degradation.
- **Historical dates (swipe):** `currentDate !== todayStr` → no calendar props passed → no calendar section. Clean.
- **Empty state (no plan, no captures):** If `hasAnyContent` is false, the page shows "No plan for this day." Calendar connect card could still appear below this — add it outside the `hasAnyContent` guard.
- **OAuth redirect:** `CalendarConnectCard` links to `/api/calendar/connect` which redirects back to `/home?calendar=connected` after OAuth. This is acceptable — the user sees the home screen toast and can navigate back to `/day`.

### Acceptance Criteria

- [x] Day Plan page renders calendar section for today's date
- [x] If connected with events: `CalendarCard` shows event list
- [x] If not connected: `CalendarConnectCard` shows connection prompt
- [x] Historical dates (swipe) show no calendar section
- [x] Calendar fetch failure does not break the page
- [x] `CalendarCard` and `CalendarConnectCard` moved to `/components/ui/`
- [x] All existing imports in `home-screen.tsx` updated

---

## Files Changed (Complete List)

| File | Ticket | Change |
|------|--------|--------|
| `app/api/chat/route.ts` | A | Relax `.min(1)` to allow empty messages for `open_day` |
| `components/chat/chat-view.tsx` | A, B | Remove hard-coded opening for `open_day`, show typing indicator immediately, update energy check import |
| `skills/open-day.md` | A, B | Add opening message guidance to Step 1, strip emoji from SUGGESTED_REPLIES labels |
| `components/chat/energy-check-chips.tsx` | B | Delete (replaced by `energy-check-card.tsx`) |
| `components/chat/energy-check-card.tsx` | B | New — vertical card component with selected state |
| `components/home/info-card.tsx` | C | Move to `components/ui/info-card.tsx` |
| `components/home/calendar-card.tsx` | C | Move to `components/ui/calendar-card.tsx` |
| `components/home/calendar-connect-card.tsx` | C | Move to `components/ui/calendar-connect-card.tsx` |
| `components/home/home-screen.tsx` | C | Update imports for moved components |
| `app/(main)/day/page.tsx` | C | Add calendar data fetch, pass to swipe container |
| `components/day-plan/day-plan-swipe-container.tsx` | C | Thread calendar props to DayPlanView |
| `components/day-plan/day-plan-view.tsx` | C | Add calendar section between IntentionCard and MorningSnapshotCard |

## Institutional Learnings Applied

- **Emoji decoration is cosmetic** — use lookup table with graceful degradation (from `docs/solutions/code-review-fixes/20260221-multi-agent-review-p1-p2-p3-fixes.md`)
- **Timezone-aware dates** — use `getLocalDateString(tz)` for calendar fetch, never server UTC (from `docs/solutions/logic-errors/2026-02-21-server-side-utc-date-context-injection-bug.md`)
- **AbortController for swipe navigation** — existing pattern in day-plan-swipe-container.tsx, no change needed since calendar is today-only (from same review doc)
- **CSS Grid height constraints** — if touching chat layout, maintain `grid-rows-[1fr]` + `min-h-0` pattern (from `docs/solutions/ui-bugs/chat-input-pushed-offscreen-css-grid-height.md`)

## References

- Playtest 6 feedback: `Docs/feedback/20260222_Playtest_6.md`
- Current open-day skill: `skills/open-day.md`
- Energy check component: `components/chat/energy-check-chips.tsx`
- Home calendar implementation: `components/home/calendar-card.tsx`, `home-screen.tsx`
- Day plan view: `components/day-plan/day-plan-view.tsx`
