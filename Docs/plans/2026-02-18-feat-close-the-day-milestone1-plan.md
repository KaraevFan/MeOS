---
title: "feat: Close the Day + Stability — Milestone 1"
type: feat
date: 2026-02-18
---

# feat: Close the Day + Stability — Milestone 1

## Overview

Ship the evening "Close the Day" session type as the first phase of the daily rhythm, plus P0 reliability fixes, before Wave 1 external testing. This gives testers the daily cadence from day one — not life mapping in isolation.

**Design doc:** `Docs/plans/2026-02-18-milestone1-close-the-day-design.md`
**Daily rhythm spec:** `Docs/feedback/20260218_MeOS_Daily_Rhythm.md`

## Problem Statement / Motivation

The biggest retention risk is the 7-day gap between life mapping and the first weekly check-in. Without daily utility, there's no reason to open the app on a Tuesday. The evening journal is the minimum viable daily loop — it validates whether a daily habit sticks before investing in the morning flow or calendar integration.

## Proposed Solution

Add `close_day` as a new session type end-to-end: database, TypeScript types, prompt, context injection, file infrastructure, inline card, home screen CTA, and weekly check-in integration. Plus P0 reliability fixes from the fresh-eyes audit.

## Technical Approach

### Architecture

The `close_day` session type follows the exact pattern of existing session types (`life_mapping`, `weekly_checkin`, `ad_hoc`). No new architectural patterns — it's an extension of the FILE_UPDATE pipeline:

```
User taps "Close your day"
  → /chat?type=close_day
  → New session created (DB: session_type='close_day')
  → buildConversationContext() calls getCloseDayPrompt()
  → fetchAndInjectFileContext() reads life-map, sage context, yesterday's journal
  → Claude streams response with [FILE_UPDATE type="daily-log" ...]
  → Parser extracts block → resolveFileUpdatePath() → daily-logs/{date}-journal.md
  → isWritePermitted() checks close_day permissions → write to storage
  → JournalCard renders inline → session completes
```

### Design Decisions Resolved (from SpecFlow analysis)

1. **Frontmatter: system-generated, not Sage-generated.** Sage writes markdown body only. Metadata (`energy`, `mood_signal`, `domains_touched`) passed as FILE_UPDATE tag attributes — same pattern as `status` and `preview_line` for domain cards. Example: `[FILE_UPDATE type="daily-log" name="2026-02-18" energy="moderate" mood_signal="productive-but-grinding" domains_touched="career,health"]`

2. **Date handling: server-side, not LLM-generated.** The `name` attribute from Sage provides a date hint, but `resolveFileUpdatePath()` uses a server-determined date (session creation date). Prevents clock/timezone drift from LLM hallucination.

3. **Duplicate prevention:** Allow the session to proceed. If `daily-logs/{date}-journal.md` already exists, overwrite it (upsert). Home screen CTA changes to "Update tonight's journal" if one exists for today. Derive `today_closed` at runtime from sessions table query.

4. **Evening CTA timing: 5pm local time.** Detected client-side via `new Date().getHours()`. Wrapped in a client component. Hardcoded for Milestone 1; configurable later.

5. **Voice orb conflict: check-in takes priority.** If `checkin_due` or `checkin_overdue`, voice orb routes to `weekly_checkin`. "Close your day" CTA still visible below.

6. **Pre-mapping users: hide CTA.** Only show after `onboarding_completed` is true and at least one `life_mapping` session exists. The close_day prompt requires life context.

7. **Session completion: auto-complete on FILE_UPDATE write.** When `daily-log` type FILE_UPDATE is detected and successfully written, mark session as `completed`.

8. **Abandoned sessions: restart after 2 hours.** If a `close_day` session is active but >2 hours old, mark as `abandoned` and allow a fresh one.

9. **File type identifier: `daily-log`.** Matches the design doc. Maps to `daily-logs/{date}-journal.md`.

10. **History view: show close_day sessions.** Type label "Evening Reflection." Lower prominence than check-ins.

## Implementation Phases

**Revised timeline: ~12 days** (expanded from 10 due to full home screen redesign)

### Phase 1: Infrastructure & Types (Days 1-2)

Foundation layer. Everything else depends on this.

#### 1.1 Database Migration

**New file:** `supabase/migrations/011_close_day_session.sql`

```sql
-- Add close_day to session_type CHECK constraint
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_session_type_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_session_type_check
  CHECK (session_type IN (
    'life_mapping', 'weekly_checkin', 'monthly_review',
    'quarterly_review', 'ad_hoc', 'close_day'
  ));

-- Add daily-logs to file_index path patterns (if any CHECK exists)
-- No file_index constraint change needed (accepts any string)
```

#### 1.2 TypeScript Type Updates

**File:** `types/chat.ts` (line 5)
```typescript
// Before:
export type SessionType = 'life_mapping' | 'weekly_checkin' | 'ad_hoc'
// After:
export type SessionType = 'life_mapping' | 'weekly_checkin' | 'ad_hoc' | 'close_day'
```

**File:** `types/markdown-files.ts`
Add `DailyLogFrontmatterSchema`:
```typescript
export const DailyLogFrontmatterSchema = z.object({
  date: z.string(),
  type: z.literal('daily-journal'),
  energy: z.enum(['high', 'moderate', 'low']).optional(),
  mood_signal: z.string().optional(),
  domains_touched: z.array(z.string()).optional(),
  intention_fulfilled: z.enum(['yes', 'partial', 'no', 'not-applicable']).optional(),
  session_depth: z.enum(['quick-checkin', 'standard', 'deep-processing']).optional(),
  created_at: z.string().optional(),
})
export type DailyLogFrontmatter = z.infer<typeof DailyLogFrontmatterSchema>
```

Also define (for Phase 2/3 — created now for schema completeness):
- `DayPlanFrontmatterSchema`
- `CaptureFrontmatterSchema`

#### 1.3 Markdown Constants

**File:** `lib/markdown/constants.ts`

Add to `FILE_TYPES` (lines 35-43):
```typescript
DAILY_LOG: 'daily-log',
```

Add to `ALLOWED_PATH_PREFIXES` (lines 7-12):
```typescript
'daily-logs/',
'day-plans/',   // For Phase 2 — safe to add now
'captures/',    // For Phase 3 — safe to add now
```

Add to `SESSION_WRITE_PERMISSIONS` (lines 48-68):
```typescript
close_day: ['daily-logs/', 'sage/context.md'],
```

#### 1.4 Frontmatter Generator

**File:** `lib/markdown/frontmatter.ts`

Add `generateDailyLogFrontmatter()` following the pattern of `generateCheckInFrontmatter()`:
```typescript
export function generateDailyLogFrontmatter(
  date: string,
  overrides?: Partial<DailyLogFrontmatter>
): string {
  const fm: DailyLogFrontmatter = {
    date,
    type: 'daily-journal',
    created_at: new Date().toISOString(),
    ...overrides,
  }
  return stringifyFrontmatter(fm)
}
```

Overrides allow the system to pass extracted metadata from FILE_UPDATE tag attributes (energy, mood_signal, etc.).

#### 1.5 Path Resolution

**File:** `lib/markdown/file-write-handler.ts`

Add case to `resolveFileUpdatePath()` (lines 21-52):
```typescript
case FILE_TYPES.DAILY_LOG: {
  // Use session creation date, not LLM-provided name
  const date = update.name ?? new Date().toISOString().split('T')[0]
  return `daily-logs/${date}-journal.md`
}
```

Add case to `handleFileUpdate()` switch (lines 98-139):
```typescript
case FILE_TYPES.DAILY_LOG: {
  const date = update.name ?? new Date().toISOString().split('T')[0]
  const overrides: Partial<DailyLogFrontmatter> = {}
  // Extract metadata from FILE_UPDATE tag attributes
  if (update.attributes?.energy) overrides.energy = update.attributes.energy
  if (update.attributes?.mood_signal) overrides.mood_signal = update.attributes.mood_signal
  if (update.attributes?.domains_touched) {
    overrides.domains_touched = update.attributes.domains_touched.split(',').map(s => s.trim())
  }
  await ufs.writeDailyLog(date, update.content, overrides)
  break
}
```

#### 1.6 UserFileSystem Methods

**File:** `lib/markdown/user-file-system.ts`

Add three methods following existing patterns:

- `readDailyLog(date: string)` — reads `daily-logs/{date}-journal.md`, validates frontmatter with `DailyLogFrontmatterSchema`
- `writeDailyLog(date: string, content: string, overrides?: Partial<DailyLogFrontmatter>)` — generates frontmatter via `generateDailyLogFrontmatter()`, writes to storage, updates file_index
- `listDailyLogs(limit?: number)` — lists files in `daily-logs/` directory, sorted by date descending

Update `inferFileType()` to include `'daily-logs/'` prefix.

#### 1.7 Parser: Tag Attribute Extraction

**File:** `lib/ai/parser.ts`

The parser already extracts `type` and `name` from `[FILE_UPDATE]` tags. Extend it to extract additional named attributes (`energy`, `mood_signal`, `domains_touched`) and include them in the parsed `FileUpdateData`. Check if the existing regex at line 15 captures arbitrary attributes — if not, extend it.

The parsed result should include an `attributes` map:
```typescript
interface FileUpdateData {
  fileType: string
  name?: string
  content: string
  attributes?: Record<string, string>  // New: energy, mood_signal, etc.
}
```

**Tests:** `lib/ai/parser.test.ts` — add tests for:
- `[FILE_UPDATE type="daily-log" name="2026-02-18" energy="moderate"]` parses correctly
- `[FILE_UPDATE type="daily-log" name="2026-02-18" energy="moderate" mood_signal="productive" domains_touched="career,health"]` extracts all attributes
- Missing attributes are handled gracefully
- `daily-log` type is in `VALID_FILE_TYPES`

---

### Phase 2: Prompt & Context (Days 3-4)

The conversation engine — what Sage says and what context it has.

#### 2.1 Close Day Prompt

**File:** `lib/ai/prompts.ts`

Add `getCloseDayPrompt()` exported function. Follow existing prompt structure:
1. Sage persona (shared with other prompts — warm, empathetic, opinionated)
2. Session-specific instructions (evening reflection, release not review)
3. Response format rules (2-3 sentences, max 2-3 exchanges)
4. FILE_UPDATE format instructions (append `FILE_UPDATE_FORMAT` constant)
5. Critical rules (no action items, no ratings, accept quick responses)

Key prompt elements per the design doc:
- Open with ONE question from priorities/recent context
- Max 1 follow-up if significant sharing
- Never suggest action items (morning territory)
- Close with warmth
- Emit `[FILE_UPDATE type="daily-log" name="{date}" energy="{}" mood_signal="{}" domains_touched="{}"]` with metadata as tag attributes

Instruct Sage to NOT include YAML frontmatter in the body — only markdown content.

#### 2.2 Context Injection Branch

**File:** `lib/ai/context.ts`

Add `close_day` branch in `buildConversationContext()` (lines 146-153):
```typescript
} else if (sessionType === 'close_day') {
  basePrompt = getCloseDayPrompt()
}
```

Add daily-log reading to `fetchAndInjectFileContext()`:
- For `close_day` sessions: read the last `daily-logs/*.md` entry (yesterday's journal, for continuity)
- For `weekly_checkin` sessions: read ALL `daily-logs/*.md` since the last check-in date

Use `ufs.listDailyLogs()` to discover files, then `Promise.allSettled()` for parallel reads (per learnings — never sequential await in a loop).

The context string for `close_day` includes:
```
=== YOUR WORKING MODEL ===
{sage/context.md content}

=== LIFE MAP OVERVIEW ===
{life-map/_overview.md content}

=== CURRENT LIFE PLAN ===
{life-plan/current.md content}

=== YESTERDAY'S JOURNAL ===
{daily-logs/{yesterday}-journal.md content, or "No previous journal entries."}

=== LAST CHECK-IN ===
{Most recent check-ins/*.md content}
```

#### 2.3 Check-In Context Enhancement

**File:** `lib/ai/context.ts`

For `weekly_checkin` sessions, add a new context section:
```
=== DAILY JOURNALS THIS WEEK ===
{Concatenated daily-logs since last check-in, date-ordered}
```

Update the weekly check-in prompt (`lib/ai/prompts.ts`, `getWeeklyCheckinBasePrompt()`) to reference this data:
Add an instruction like: "If daily journal entries are available, use them as the week's narrative. Reference specific observations the user made in their evening reflections rather than asking 'how was your week?' cold."

---

### Phase 3: Chat Components & Flow (Days 4-5)

The user-facing conversation flow — routing, rendering, completion.

#### 3.1 Chat Page Routing

**File:** `app/(main)/chat/page.tsx` (lines 76-88)

Add routing branch:
```typescript
} else if (requestedType === 'close_day') {
  sessionType = 'close_day'
}
```

#### 3.2 API Route Validation

**File:** `app/api/chat/route.ts` (line 242)

Add `'close_day'` to `VALID_SESSION_TYPES`:
```typescript
const VALID_SESSION_TYPES: ReadonlySet<SessionType> = new Set<SessionType>([
  'life_mapping', 'weekly_checkin', 'ad_hoc', 'close_day'
])
```

#### 3.3 Session Header Labels

**File:** `components/chat/session-header.tsx` (lines 3-7)

```typescript
SESSION_LABELS: { close_day: 'Close the Day' }
SESSION_DURATIONS: { close_day: '~ 3 min' }
```

#### 3.4 JournalCard Component

**New file:** `components/chat/journal-card.tsx`

A `'use client'` component receiving `FileUpdateData` with `fileType === 'daily-log'`. Lighter than domain cards:

```typescript
interface JournalCardProps {
  data: FileUpdateData
}
```

**Contents:**
- Date + time header (extracted from `name` attribute)
- 1-2 sentence summary (first paragraph of markdown body)
- Energy indicator — subtle colored dot: green (high), amber (moderate), muted (low). Derived from `attributes.energy`.
- Domain tags — small pills from `attributes.domains_touched`
- Footer: "This feeds into your next check-in" in `text-text-secondary`

**Visual style:** Warm background (`bg-bg-card` or similar), rounded corners (`rounded-2xl`), compact padding. Use the warm palette from MeOS design system. NOT a domain card — visually distinct, lighter, more of a "receipt."

#### 3.5 Wire JournalCard into SegmentRenderer

**File:** `components/chat/message-bubble.tsx` (lines 63-79)

Add rendering branch:
```typescript
if (segment.data.fileType === 'daily-log') {
  return <JournalCard data={segment.data} />
}
```

#### 3.6 Session Completion Trigger

**File:** `components/chat/chat-view.tsx` (lines 815-848)

Add `daily-log` detection alongside existing `overview` and `check-in` triggers:
```typescript
const hasDailyLog = updates.some((u) => u.fileType === 'daily-log')
if (hasDailyLog) {
  await completeSession()
}
```

#### 3.7 Session Complete Card

**File:** `components/chat/session-complete-card.tsx` (lines 12-20)

Add `close_day` branch:
```typescript
if (sessionType === 'close_day') {
  return (
    // "Day logged. Sleep well." with "Back to Home" CTA
  )
}
```

---

### Phase 4: Home Screen Redesign (Days 5-8)

Full home screen redesign: time-aware contextual card stack. Source of truth: `Docs/feedback/20260218_Home_page_design.md` with design reference code at `inspiration/20260218_Homescreen_design/src/App.tsx`.

**This replaces the existing home screen entirely.** The current page (`app/(main)/home/page.tsx`) is rewritten as a time-aware card stack with three states: Morning (before ~11am), Mid-Day (~11am-6pm), Evening (after ~6pm).

#### 4.1 Layout Skeleton & Shared Components

**Rewrite:** `app/(main)/home/page.tsx` — becomes a server component that fetches data, passes it to a client wrapper for time-aware rendering.

**New file:** `components/home/home-screen.tsx` — `'use client'` wrapper that:
1. Detects time state from `new Date().getHours()` (morning < 11, midday 11-18, evening >= 18)
2. Renders the appropriate card stack based on time state
3. Receives server-fetched data as props (onboarding status, session data, check-in state)

**Layout structure** (from spec, top to bottom):
```
Status Bar (native)
Greeting + Date
Session Chips [Open Day] [Capture] [Close Day]
Hero Card (Tier 1) — changes per time state
Capture Bar (morning/evening only)
Content Cards (Tier 2) — conditional, data-dependent
Ambient Card (Tier 3) — optional, below fold
[80px safe zone for tab bar]
Tab Bar with Voice Orb
```

#### 4.2 Greeting Component

**New file:** `components/home/greeting.tsx`

- Time-aware greeting: "Good morning/afternoon/evening, {name}"
- Subtext: day of week + date
- Font: Large heading weight, warm dark gray
- Thresholds: morning < 11am, afternoon 11am-6pm, evening >= 6pm

#### 4.3 Session Chips Component

**New file:** `components/home/session-chips.tsx`

Horizontal row of three pill-shaped buttons:
- `[Sun] Open Day` — links to `/chat?type=open_day` (grayed out / non-functional for M1 — session type doesn't exist yet)
- `[Mic] Capture` — links to quick capture (non-functional for M1)
- `[Moon] Close Day` — links to `/chat?type=close_day`

Active chip (matching current time state): filled amber background, white text.
Inactive chips: outline/light gray fill, warm gray text.
Tapping any chip opens that session — regardless of time of day.

**Sizing:** ~32-36px tall, centered row. Per the design reference:
```tsx
className={`flex items-center gap-1.5 px-3.5 h-[34px] rounded-full text-[13px] font-semibold
  ${isActive ? 'bg-amber-500 text-white shadow-sm' : 'bg-warm-dark/[0.04] text-warm-gray'}`}
```

**M1 behavior:** Open Day and Capture chips are visible but route to ad_hoc or show a "coming soon" state. Close Day chip works end-to-end.

#### 4.4 Hero Card Component

**New file:** `components/home/hero-card.tsx`

The primary CTA card. One per screen state. Parameterized by:
- `icon` — Sun / Mic / Sunset
- `title` — "Open Your Day" / "Quick Capture" / "Close Your Day"
- `sageText` — contextual line (see 4.7 for logic)
- `ctaText` — button label
- `onCtaClick` — navigation handler

**Visual (from design reference):**
```tsx
className="rounded-3xl p-6 bg-gradient-to-br from-amber-100/60 via-amber-50/40 to-orange-50/20
  border border-amber-200/30 relative overflow-hidden"
```

CTA button: full-width amber/gold, white text, rounded-xl, 48px height, subtle shadow.

#### 4.5 InfoCard Component (Tier 2 Wrapper)

**New file:** `components/home/info-card.tsx`

Reusable wrapper for all Tier 2 content cards. Left-border accent colored by type:
- `amber` — calendar, check-in, next event
- `sage` — captures, breadcrumbs, yesterday's synthesis
- `blue-gray` — yesterday's intention, morning intention recall

**Visual (from design reference):**
```tsx
className={`mx-5 mt-4 bg-white rounded-2xl p-5 shadow-[0_1px_4px_rgba(61,56,50,0.04)]
  border border-warm-dark/[0.04] border-l-[4px] ${borderColors[borderColor]}`}
```

#### 4.6 Evening Card Stack (M1 Primary)

Build the evening-specific cards that render when time state is `evening`:

**Hero: "Close Your Day"**
- Icon: Sunset
- Title: "Close Your Day"
- Contextual line: see 4.8 for cascade logic
- CTA: "Close your day" → navigates to `/chat?type=close_day`

**Capture Bar** (below hero)
- Slim tappable strip: mic icon + "Drop a thought"
- For M1: routes to `/chat?type=ad_hoc` (capture session type not built yet)

**Breadcrumbs Card** (Tier 2, sage green border)
- Header: "TODAY'S BREADCRUMBS"
- Content: list of today's quick captures as blockquote-style items
- **M1 behavior:** Card won't render (no captures directory has content yet). Graceful absence — no empty state.

**Morning Intention Recall** (Tier 2, blue-gray border)
- Header: "MORNING INTENTION" with sun icon
- Content: "You set out to: *{intention}*"
- **M1 behavior:** Card won't render (no day-plans exist yet). Graceful absence.

**"Something to Sit With"** (Tier 3 ambient)
- Reflective question in italic. Static pool for MVP.
- Rotating selection from a hardcoded array.

#### 4.7 Morning & Mid-Day Card Stacks (M1 Scaffold)

Build the morning and mid-day states as scaffolds. Most conditional cards won't render yet (no calendar integration, no day plans, no captures). The layout skeleton and hero cards work — content fills in as features land.

**Morning hero:** "Open Your Day" — CTA routes to `/chat?type=ad_hoc` for M1 (open_day session type not built yet). Contextual line uses fallback: "A fresh start. What matters most to you today?"

**Mid-day hero:** "Quick Capture" — CTA routes to `/chat?type=ad_hoc` for M1. Static line: "Got a thought worth holding onto? Drop it here — it'll be waiting tonight."

**Morning conditional cards (won't render in M1):**
- Yesterday's Synthesis (needs journal data)
- Calendar (needs Google Calendar integration)
- Yesterday's Intention (needs day plan data)

**Mid-day conditional cards (won't render in M1):**
- Check-In (needs day plan data)
- Next Event (needs calendar integration)
- Captures Today (needs captures data)

#### 4.8 Hero Contextual Line Logic

**Evening contextual line — priority cascade:**
1. If quick captures exist today: "You dropped {N} thoughts today. Let's make sense of them before you rest."
2. If morning intention exists (no captures): "This morning you set out to {intention}. How did it land?"
3. Fallback: "Take a moment to notice what today held. Even two minutes counts."

**Morning contextual line — priority cascade:**
1. If yesterday's intention AND journal exist: Reference both.
2. If yesterday's intention only: Reference intention.
3. If calendar has events: Reference calendar.
4. Fallback: "A fresh start. What matters most to you today?"

**For M1:** Most contextual lines will hit fallbacks (no day plans, no captures, no calendar). That's fine — the cascade fills in naturally as features land.

**Implementation:** Template-based for M1 (string interpolation, not LLM call). The data is passed from server to client component as props.

#### 4.9 Tab Bar with Voice Orb

**Modify:** The existing tab bar / bottom navigation to match the design spec.

**Orb spec:**
- 48-56px diameter, protruding ~20px above tab bar edge
- Amber/gold radial gradient with subtle idle pulse animation
- No text label (other tabs have labels)
- Contextual tap behavior:
  - Morning → opens "Open the Day" (ad_hoc for M1)
  - Mid-Day → opens Quick Capture (ad_hoc for M1)
  - Evening → opens "Close the Day" session
  - If `checkin_due`/`checkin_overdue` → prioritize weekly check-in
  - Default/fallback → general chat

**Tab bar background:** Curves gently around the orb. Standard iOS height + orb protrusion. Background mask for blending (per design reference).

**Visual reference (from design reference):**
```tsx
<button className="w-[64px] h-[64px] rounded-full flex items-center justify-center
  shadow-[0_6px_24px_rgba(245,158,11,0.3),0_2px_8px_rgba(245,158,11,0.15)]"
  style={{ backgroundImage: 'radial-gradient(circle at 35% 30%, #fbbf24 0%, #f59e0b 45%, #d97706 100%)' }}>
```

#### 4.10 Home Data Fetcher Updates

**File:** `lib/supabase/home-data.ts`

Expand to return data needed by the new home screen:

```typescript
interface HomeData {
  // Existing
  userName: string
  onboardingCompleted: boolean
  checkinState: 'due' | 'overdue' | 'upcoming' | 'not_due'
  // New
  todayClosed: boolean
  closeDaySessionId: string | null
  todayDayPlan: { intention: string } | null   // null for M1
  yesterdayJournal: { summary: string } | null  // null until user has journal data
  todayCaptureCount: number                     // 0 for M1
  yesterdayIntention: string | null             // null for M1
}
```

For M1, most new fields return null/0. The home screen gracefully degrades — conditional cards simply don't render.

#### 4.11 Session State Awareness

**File:** `lib/supabase/session-state.ts`

Update `detectSessionState()` to handle active `close_day` sessions:
- If a `close_day` session is active and <2 hours old → treat as `mid_conversation` with a "Resume evening reflection?" prompt
- If >2 hours old → auto-abandon and allow a fresh session

#### 4.12 Design Tokens

Ensure the Tailwind config includes the colors from the design spec:

| Token | Value |
|---|---|
| `warm-bg` | Off-white / warm cream (#FAF8F5) |
| `warm-dark` | Dark warm gray (for text, borders) |
| `warm-gray` | Medium warm gray (labels, secondary text) |
| `sage` | Muted sage green (journal/capture borders) |
| `blue-gray` | Soft blue-gray (intention borders) |
| `terracotta` | Earth tone accent |

Check `tailwind.config.ts` for existing tokens. Add any missing ones. The design reference file (`inspiration/20260218_Homescreen_design/tailwind.config.js`) has the exact values.

---

### Phase 5: P0 Reliability Fixes (Days 9-10)

From the fresh-eyes audit. These prevent embarrassing failures during external testing.

#### 5.1 Server-Side Pulse Context

**File:** `app/api/chat/route.ts`

Remove any client-provided system-prompt append paths. The pulse check context must be constructed server-side to close the prompt-injection surface. Look for the TODO comment and any `pulseContext` parameter being passed from the client.

Read pulse check data from the database server-side and inject it into the system prompt within `buildConversationContext()`.

#### 5.2 Durable File-Index Updates

**File:** `lib/markdown/user-file-system.ts` (or wherever `updateFileIndex` is called)

Currently `updateFileIndex` is fire-and-forget. Make it:
1. Awaited (not fire-and-forget)
2. Wrapped in retry with exponential backoff (2 retries max)
3. Failures logged with structured error (file path, session id, error message)
4. Non-blocking: if retry exhausts, log and continue (don't crash the session)

#### 5.3 Request Validation

**File:** `app/api/chat/route.ts`, `app/api/transcribe/route.ts`, `app/api/push/subscribe/route.ts`

Add Zod schemas for request body validation on each API route:
- Chat: validate `sessionId` (uuid), `sessionType` (enum), `messages` (array with role + content)
- Transcribe: validate file presence, size limit, content-type
- Push subscribe: validate subscription object shape

Return 400 with clear error message on validation failure.

---

### Phase 6: Testing & Verification (Days 11-12)

#### 6.1 Parser Tests

**File:** `lib/ai/parser.test.ts`

Add tests for:
- `[FILE_UPDATE type="daily-log" name="2026-02-18"]` → parsed with correct fileType and name
- `[FILE_UPDATE type="daily-log" name="2026-02-18" energy="moderate" mood_signal="productive"]` → attributes extracted
- `[FILE_UPDATE type="daily-log"]` with no name → handled gracefully (fallback to today's date)
- Streaming chunks with `daily-log` blocks
- Malformed `daily-log` blocks (missing closing tag, nested blocks)

#### 6.2 Path Resolution Tests

Add tests to verify:
- `resolveFileUpdatePath()` maps `daily-log` + `name="2026-02-18"` → `daily-logs/2026-02-18-journal.md`
- `isWritePermitted()` allows `close_day` to write to `daily-logs/`
- `isWritePermitted()` denies `close_day` writing to `life-map/`

#### 6.3 Frontmatter Tests

Add tests for:
- `generateDailyLogFrontmatter()` produces valid YAML
- Overrides (energy, mood_signal) are included when provided
- Missing overrides produce valid frontmatter with defaults

#### 6.4 End-to-End Self-Test

Manual testing checklist (becomes the exit criteria):

- [ ] Navigate to home screen after 5pm → "Close your day" CTA visible
- [ ] Tap CTA → navigates to `/chat?type=close_day`
- [ ] Session header shows "Close the Day ~ 3 min"
- [ ] Sage asks one contextual question (referencing life map data)
- [ ] Respond via voice → transcription works → message appears
- [ ] Sage asks one follow-up → respond
- [ ] Sage emits closing + `[FILE_UPDATE type="daily-log"]` block
- [ ] JournalCard appears inline (date, summary, energy dot, domain tags)
- [ ] Session completes → "Day logged. Sleep well." card appears
- [ ] Check storage: `daily-logs/{date}-journal.md` exists with correct frontmatter
- [ ] Check file_index: entry exists for the daily log
- [ ] Return to home → CTA now says "Update tonight's journal"
- [ ] Start a weekly check-in → Sage references journal data
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npx vitest run` passes (all existing + new tests)
- [ ] No regressions: life mapping flow works, check-in flow works

---

## Acceptance Criteria

### Functional Requirements

- [ ] `close_day` session type works end-to-end: create session → conversation → FILE_UPDATE → file written → card rendered → session completed
- [ ] Journal artifact stored at `daily-logs/{date}-journal.md` with auto-generated frontmatter including energy, mood_signal, domains_touched
- [ ] JournalCard renders inline in chat with date, summary, energy indicator, domain tags, footer
- [ ] Home screen shows "Close your day" CTA after 5pm local time for users who have completed onboarding
- [ ] Voice input works for close_day sessions (record → transcribe → send)
- [ ] Weekly check-in context injection includes daily journal data since last check-in
- [ ] Write permissions enforced: close_day can write to `daily-logs/` and `sage/context.md` only
- [ ] Duplicate handling: second close_day session for same day overwrites journal file; CTA reflects "Update" state

### Non-Functional Requirements

- [ ] Session duration target: 2-3 minutes (prompt keeps Sage concise)
- [ ] No client-side prompt injection paths (server-side pulse context)
- [ ] File-index updates are durable (awaited with retry)
- [ ] API routes validate request bodies with Zod schemas

### Quality Gates

- [ ] All existing vitest tests pass
- [ ] New parser tests for `daily-log` type
- [ ] New path resolution and permission tests
- [ ] `npm run type-check` clean
- [ ] `npm run lint` clean
- [ ] Manual end-to-end test passes all checklist items

## Dependencies & Prerequisites

- Supabase migration must be pushed before testing (`npx supabase db push`)
- No external dependencies (no calendar OAuth, no new npm packages)
- Builds on existing FILE_UPDATE infrastructure — no new architectural patterns

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Parser doesn't extract FILE_UPDATE tag attributes | Medium | High (no metadata in frontmatter) | Check existing regex; extend if needed. Write tests first. |
| Evening CTA time detection fails on SSR | Medium | Medium (CTA doesn't appear) | Use client component with `useEffect` for time check |
| Sage outputs frontmatter inside body despite prompt | Low | Medium (corrupted file) | Strip YAML delimiters in write handler; test with real Claude output |
| Voice transcription fails during close_day | Low | Low (text fallback exists) | Existing voice flow handles this; no new risk |
| File-index lag after write | Medium | Low (sidebar briefly stale) | Durable writes with retry (Phase 5 fix) |

## File Change Summary

### New Files
| File | Purpose |
|---|---|
| `supabase/migrations/011_close_day_session.sql` | DB migration for session type |
| `components/chat/journal-card.tsx` | JournalCard inline component |
| `components/home/home-screen.tsx` | Time-aware card stack client wrapper |
| `components/home/greeting.tsx` | Time-aware greeting component |
| `components/home/session-chips.tsx` | Open Day / Capture / Close Day pills |
| `components/home/hero-card.tsx` | Primary CTA card (parameterized by time state) |
| `components/home/info-card.tsx` | Tier 2 content card wrapper with left-border accent |
| `components/home/capture-bar.tsx` | Quick capture text input strip |
| `components/home/ambient-card.tsx` | Tier 3 reflective content card |

### Modified Files (by phase)

**Phase 1 — Infrastructure:**
| File | Change |
|---|---|
| `types/chat.ts` | Add `'close_day'` to SessionType union |
| `types/markdown-files.ts` | Add `DailyLogFrontmatterSchema` + type |
| `lib/markdown/constants.ts` | Add `DAILY_LOG` to FILE_TYPES, `daily-logs/` to ALLOWED_PATH_PREFIXES, `close_day` to SESSION_WRITE_PERMISSIONS |
| `lib/markdown/frontmatter.ts` | Add `generateDailyLogFrontmatter()` |
| `lib/markdown/file-write-handler.ts` | Add `daily-log` case to `resolveFileUpdatePath()` and `handleFileUpdate()` |
| `lib/markdown/user-file-system.ts` | Add `readDailyLog()`, `writeDailyLog()`, `listDailyLogs()`, update `inferFileType()` |
| `lib/ai/parser.ts` | Extend attribute extraction for FILE_UPDATE tags (if needed) |

**Phase 2 — Prompt & Context:**
| File | Change |
|---|---|
| `lib/ai/prompts.ts` | Add `getCloseDayPrompt()` |
| `lib/ai/context.ts` | Add `close_day` branch in `buildConversationContext()`, daily-log reading in `fetchAndInjectFileContext()`, weekly check-in daily-log integration |

**Phase 3 — Chat Components:**
| File | Change |
|---|---|
| `app/(main)/chat/page.tsx` | Add `close_day` routing branch |
| `app/api/chat/route.ts` | Add `'close_day'` to VALID_SESSION_TYPES |
| `components/chat/message-bubble.tsx` | Add `daily-log` branch in SegmentRenderer |
| `components/chat/session-header.tsx` | Add `close_day` labels and duration |
| `components/chat/session-complete-card.tsx` | Add `close_day` completion card |
| `components/chat/chat-view.tsx` | Add `daily-log` detection for session completion trigger |

**Phase 4 — Home Screen Redesign:**
| File | Change |
|---|---|
| `app/(main)/home/page.tsx` | Full rewrite: server component fetching data, passing to client wrapper |
| `lib/supabase/home-data.ts` | Expanded data fetcher (todayClosed, captures, intentions, journal) |
| `lib/supabase/session-state.ts` | Handle active close_day sessions (2hr timeout) |
| `tailwind.config.ts` | Add missing design tokens (sage, blue-gray, warm-bg, warm-dark) |
| Bottom nav / tab bar component | Redesign with centered voice orb, contextual tap routing |

**Phase 5 — Reliability:**
| File | Change |
|---|---|
| `app/api/chat/route.ts` | Server-side pulse context, Zod validation |
| `app/api/transcribe/route.ts` | Zod request validation |
| `app/api/push/subscribe/route.ts` | Zod request validation |
| `lib/markdown/user-file-system.ts` | Durable file-index updates (await + retry) |

**Phase 6 — Tests:**
| File | Change |
|---|---|
| `lib/ai/parser.test.ts` | Add `daily-log` parsing and attribute extraction tests |

## Success Metrics

**Quantitative (measured in Wave 1):**
- 4/5 testers complete life mapping AND express "this gets me"
- 3/5 testers use "Close the Day" at least twice in the first week
- Zero critical crashes during testing sessions

**Qualitative:**
- "I liked checking in at the end of the day"
- "It remembered what I said yesterday"
- "The check-in felt richer because of the daily journals"

## References & Research

### Internal References
- Design doc: `Docs/plans/2026-02-18-milestone1-close-the-day-design.md`
- Daily rhythm spec: `Docs/feedback/20260218_MeOS_Daily_Rhythm.md`
- Home screen spec: `Docs/feedback/20260218_Home_page_design.md`
- Home screen design reference: `inspiration/20260218_Homescreen_design/src/App.tsx`
- Fresh-eyes audit: `Docs/feedback/20260217_fresh-eyes-project-audit.md`
- POS strategy: `Docs/plans/2026-02-16-pos-vision-strategy-design.md`
- Existing session types: `types/chat.ts:5`, `lib/ai/context.ts:146-153`
- FILE_UPDATE pipeline: `lib/ai/parser.ts`, `lib/markdown/file-write-handler.ts`, `lib/markdown/constants.ts`
- Inline cards: `components/chat/message-bubble.tsx:63-79`
- Home screen: `app/(main)/home/page.tsx`

### Documented Learnings Applied
- Markdown heading extraction boundary issue → avoid h3 boundaries in journal files (`Docs/solutions/logic-errors/markdown-section-extraction-heading-boundary.md`)
- Session-scoped write permissions deny-by-default → add close_day to whitelist (`Docs/solutions/security-issues/markdown-storage-security-review-fixes.md`)
- Parallel reads with Promise.allSettled → use for daily-log context injection (`Docs/solutions/security-issues/markdown-storage-security-review-fixes.md`)
- RLS policies → no new tables needed, storage-level RLS covers daily-logs (`Docs/solutions/security-issues/rls-auth-data-leak-fix.md`)
