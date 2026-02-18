---
title: "feat: Milestone 2 & 3 — Full Daily Rhythm Experience"
type: feat
date: 2026-02-18
---

# Milestone 2 & 3: Full Daily Rhythm Experience

## Overview

Build the complete daily rhythm: morning "Open the Day" session with Google Calendar, full time-aware home screen redesign, Life Map tab enrichment, quick capture with AI classification, and mid-day nudge. This plan covers M2a (infrastructure + open_day), M2b (home screen redesign), M2c (Life Map enrichment), and M3 (quick capture + mid-day).

**Brainstorm:** `docs/brainstorms/2026-02-18-milestone2-3-scoping-brainstorm.md`

## Problem Statement / Motivation

M1 delivers the evening "Close the Day" session — one half of the bookend model. Without the morning session, calendar integration, quick captures, and the full home screen, users experience MeOS as a single evening ritual rather than a daily operating system. The daily rhythm is the primary retention mechanism; shipping it completes the post-onboarding path from Day 1 to Day 7.

## Proposed Solution

Sequential layers: M2a (plumbing) → M2b (surface) → M2c (enrichment) → M3 (captures + mid-day). Each sub-phase produces a shippable increment. Calendar OAuth blockers don't gate the home screen redesign.

---

## Technical Approach

### Architecture

**New session types:** `open_day`, `quick_capture`

**New file paths:**
- `day-plans/{date}.md` — living document, accumulates through the day
- `captures/{date}-{timestamp}.md` — individual capture files

**New integrations:**
- Google Calendar read-only OAuth via Supabase's provider token
- LLM contextual line generation endpoint

**New UI patterns:**
- `[SUGGESTED_REPLIES]` parser block for AI-driven quick-reply buttons
- `[INLINE_CARD]` parser block for inline calendar mini-cards
- Inline expansion capture bar
- Pre-chat briefing card

---

### Implementation Phases

#### Phase M2a: Infrastructure + Open the Day

##### Task 1: Google Calendar OAuth Integration

**Files to create/modify:**
- `app/(auth)/login/page.tsx` — add calendar scope + offline access params
- `app/(auth)/auth/callback/route.ts` — extract and store provider tokens
- `supabase/migrations/013_calendar_integration.sql` — `integrations` table
- `lib/calendar/google-calendar.ts` — Calendar API service
- `lib/calendar/types.ts` — CalendarEvent type
- `app/api/calendar/events/route.ts` — API route for fetching events

**Implementation details:**

1. **Extend Google OAuth** in `login/page.tsx:14-28`:
```typescript
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
```

2. **Extract provider tokens** in `auth/callback/route.ts:8-10`:
```typescript
const { data, error } = await supabase.auth.exchangeCodeForSession(code)
if (!error && data.session) {
  const providerToken = data.session.provider_token
  const providerRefreshToken = data.session.provider_refresh_token
  // Store in integrations table
}
```

3. **Create `integrations` table** (migration 013):
```sql
CREATE TABLE integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider text NOT NULL, -- 'google_calendar'
  access_token text NOT NULL,
  refresh_token text,
  token_expires_at timestamptz,
  scopes text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, provider)
);
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own integrations"
  ON integrations FOR ALL USING (auth.uid() = user_id);
```

4. **Calendar API service** `lib/calendar/google-calendar.ts`:
- `getCalendarEvents(userId: string, date: string)` — fetches today's events
- Token refresh logic using `googleapis` npm package
- Fallback: returns empty array if no integration or token expired
- Return type: `CalendarEvent[]` with `{ title, startTime, endTime, attendees? }`

5. **Calendar events API route** `app/api/calendar/events/route.ts`:
- GET endpoint, authenticated
- Returns today's events as JSON
- Zod-validated response

**Gotchas:**
- Google only sends refresh token on first consent. Must use `prompt: 'consent'` + `access_type: 'offline'`
- Supabase PKCE flow: extract tokens from `exchangeCodeForSession` return data, not from session event
- Google Cloud console: need OAuth consent screen configured; for dev, use "Testing" mode (limited to test users)

##### Task 2: Agent-Native Skill Architecture (Foundation)

**Files to create/modify:**
- `skills/close-day.md` — migrate existing prompt from `prompts.ts`
- `skills/open-day.md` — new morning session skill definition
- `lib/ai/skill-loader.ts` — reads skill files, extracts structured config
- `lib/ai/context.ts` — integrate skill loader into context builder
- `lib/ai/prompts.ts` — fallback role during migration

**Implementation details:**

1. **Skill file format** (markdown with YAML frontmatter):
```markdown
---
session_type: open_day
tools: [read_file, write_file, list_files, read_calendar, update_context]
write_paths: [day-plans/*, sage/context.md]
read_context:
  - calendar/today
  - life-plan/current.md
  - daily-logs/yesterday
  - captures/yesterday-unprocessed
  - sage/context.md
  - day-plans/yesterday
duration: 3-5 minutes
tone: directive, warm, efficient
---

# Open the Day — Morning Session

## Conversational Arc

### Beat 1: The Briefing (~30 seconds)
Open with a compact summary...
[Full prompt content]
```

2. **Skill loader** `lib/ai/skill-loader.ts`:
- `loadSkill(sessionType: SessionType): SkillConfig | null`
- Reads from `skills/{session-type}.md`
- Parses YAML frontmatter for config, markdown body for prompt
- Returns `{ prompt, writePermissions, readContext, tools, metadata }`
- Returns `null` if skill file doesn't exist (fallback to prompts.ts)

3. **Integration in context.ts** `buildConversationContext()`:
- Try `loadSkill(sessionType)` first
- If skill exists, use its prompt and config
- If not, fall back to existing `getXxxPrompt()` functions in prompts.ts
- This keeps backwards compatibility during migration

4. **Migrate `close_day`** — create `skills/close-day.md` from existing `getCloseDayPrompt()` content. Verify behavior is identical.

##### Task 3: `open_day` Session Type

**Files to modify:**
- `types/chat.ts` — add `open_day` to SessionType union
- `lib/markdown/constants.ts` — add write permissions, file type mapping
- `lib/ai/context.ts` — add context injection for `open_day`
- `lib/ai/parser.ts` — handle `day-plan` FILE_UPDATE type
- `lib/markdown/user-file-system.ts` — wire `writeDayPlan()`, `readDayPlan()`, `readLatestDayPlan()`
- `lib/markdown/file-write-handler.ts` — path resolution for day-plan type
- `app/(main)/chat/page.tsx` — route `?type=open_day`
- `components/chat/session-complete-card.tsx` — add open_day completion state

**Implementation details:**

1. **Session type enum** — add `open_day` alongside existing `close_day`

2. **Write permissions** in `constants.ts`:
```typescript
open_day: ['day-plans/', 'sage/context.md'],
```

3. **Context injection** for `open_day` reads:
- Today's Google Calendar events (from integration)
- `life-plan/current.md` (active commitments)
- Last `daily-logs/*.md` (yesterday's journal)
- Yesterday's `day-plans/*.md` (for carry-forward logic)
- Unprocessed `captures/` from yesterday
- `sage/context.md`

4. **3-beat morning prompt** (in `skills/open-day.md`):
- Beat 1 (Briefing): Present calendar + carried-forward intentions + yesterday summary. NOT a question — Sage demonstrates awareness.
- Beat 2 (Focus Question): One targeted question based on observation. Never ask "what do you want to do?" — make a specific suggestion and ask user to react. Emit `[SUGGESTED_REPLIES]` with 2-3 intention options.
- Beat 3 (Commit): Confirm intention, generate day plan artifact. Emit `[SUGGESTED_REPLIES]` with "Lock it in" / "Add something" / "Change my focus".

5. **Day plan artifact output**:
```
[FILE_UPDATE type="day-plan" name="2026-02-19"]
## Intention
"Finish the proposal draft and protect creative time"

## Calendar
- 10:00  Team standup (30m)
- 11:00  Design review with Sarah (45m)
- 14:00  Client call (30m)

## Focus Blocks
- 11:45–13:45  Proposal draft (carried forward)
- 15:00–16:30  Creative project exploration

## Quick Capture
(empty — accumulates through the day)

## Carried Forward
- ~~Finish proposal draft~~ → focus block today
[/FILE_UPDATE]
```

6. **Parser handling** — add `day-plan` to the file type resolver in `file-write-handler.ts` following the `daily-log` pattern.

7. **Day plan frontmatter** (auto-generated):
```yaml
type: day-plan
date: 2026-02-19
intention: "Finish the proposal draft and protect creative time"
status: active
created_from: open_day
```

8. **Session interruption handling** — if user starts `open_day` but abandons before Beat 3 (day plan artifact never written):
   - Session stays `active` in DB. Existing `ActiveSessionCard` handles resume on home screen.
   - If the user returns same morning: resume card shown, tapping it continues the conversation.
   - If the user returns in evening (never finished morning): session auto-expires. Evening `close_day` sees no day plan for today — it runs with the no-day-plan fallback (no intention reference, just "How was your day?"). The abandoned morning session is marked `expired` during `close_day` context building.
   - Edge case: if user taps "Open Your Day" hero again with an active session, redirect to resume card (don't create a second session).

9. **Session expiry logic** — add to `lib/ai/context.ts`: when building `close_day` context, check for any `open_day` sessions from today that are still `active`. Mark them as `expired` in the sessions table. This prevents stale resume cards the next morning.

##### Task 4: Carry Forward Logic

**Files to modify:**
- `lib/ai/context.ts` — carry-forward context construction
- `lib/supabase/home-data.ts` — yesterday's intention data

**Implementation details:**

1. When building `open_day` context, check yesterday's day plan:
   - Read `day-plans/{yesterday}.md`
   - Extract intention from frontmatter
   - Check if yesterday's journal references intention fulfillment
   - If intention was not fulfilled, include it as "carried forward" in context

2. Sage's Beat 1 surfaces carried intention via `[INTENTION_CARD]` block (see Task 5) — rendered as an interactive card with Keep/Change buttons. This replaces plain text carry-forward references in the conversation.

3. **Keep flow**: User taps "Keep" → sends "I'll keep that focus" → Sage skips intention discovery in Beat 2, proceeds directly to confirming the focus and generating the day plan.

4. **Change flow**: User taps "Change" → sends "I want to change my focus" → Sage asks a targeted follow-up in Beat 2 (e.g., "What's pulling your attention instead?") and generates a fresh intention.

5. "Carry forward" action from Yesterday's Intention home card writes intention into today's context (creates a lightweight context entry that the morning session reads).

##### Task 5: Parser Extensions — Suggested Replies + Inline Cards + Intention Card

**Files to create/modify:**
- `types/chat.ts` — add `SuggestedReply` type, `suggested_replies` block type, `inline_card` block type, `intention_card` block type
- `lib/ai/parser.ts` — parse `[SUGGESTED_REPLIES]`, `[INLINE_CARD]`, and `[INTENTION_CARD]` blocks
- `components/chat/suggested-reply-buttons.tsx` — new component
- `components/chat/inline-card.tsx` — inline structured card component (calendar events, intention)
- `components/chat/intention-card.tsx` — interactive Keep/Change card for carried intention
- `components/chat/chat-view.tsx` — integrate all new block renderers

**Implementation details:**

1. **`[SUGGESTED_REPLIES]` parser block**:
```
[SUGGESTED_REPLIES]
Focus on proposal
Prep day
Creative exploration
Something else
[/SUGGESTED_REPLIES]
```

2. **`[INLINE_CARD type="calendar"]` parser block** — structured calendar mini-cards inline in Beat 1:
```
[INLINE_CARD type="calendar"]
10:00  Team standup (30m)
11:00  Design review with Sarah (45m)
14:00  Client call (30m)
[/INLINE_CARD]
```
Renders as tappable mini-cards with time badges (not raw text). Each event is a compact pill with time on the left and title on the right. Warm amber left-border accent, consistent with home screen calendar card styling.

3. **`[INTENTION_CARD]` parser block** — interactive carried intention in Beat 1:
```
[INTENTION_CARD]
Finish the proposal draft
[/INTENTION_CARD]
```
Renders as a card with yesterday's intention text + two action buttons: "Keep" (filled) and "Change" (outline). Tapping "Keep" sends "I'll keep that focus" as the user's message. Tapping "Change" sends "I want to change my focus" and Sage adjusts Beat 2 accordingly.

4. **Types** in `types/chat.ts`:
```typescript
export interface SuggestedReply {
  label: string
  sendText?: string  // defaults to label
  variant?: 'primary' | 'secondary'
}

export interface InlineCard {
  type: 'calendar' | 'intention'
  items?: string[]      // calendar events
  intention?: string    // carried intention text
}
```

5. **Rendering logic** in `chat-view.tsx`:
- `suggested_replies`: After last assistant message, check parsed segments. If found: render AI-driven suggestions (overrides defaults). If not found: fall back to existing `StateQuickReplies`. Buttons hidden during streaming, appear with `animate-fade-up` after stream completes.
- `inline_card`: Rendered inline within message body as structured elements (not below the message). Calendar cards show as a compact stack of event pills. Intention card shows as an interactive card with Keep/Change buttons.
- When user taps Keep/Change on intention card, the button state updates immediately and the card becomes non-interactive.

6. **Hybrid approach**: Frontend-driven defaults + AI override. Session closing actions ("Lock it in") are frontend-driven, triggered by detecting FILE_UPDATE blocks. Contextual intention suggestions are AI-driven via markers.

7. **Prompt instructions**: The `open-day.md` skill file must instruct Sage to emit `[INLINE_CARD type="calendar"]` with today's events and `[INTENTION_CARD]` with yesterday's carried intention (when applicable) during Beat 1.

##### Task 6: Morning Briefing Pre-Chat Card

**Files to create:**
- `components/chat/briefing-card.tsx` — pre-chat teaser card

**Files to modify:**
- `components/chat/chat-view.tsx` — render briefing card before first message
- `lib/supabase/home-data.ts` — fetch briefing data

**Implementation details:**

1. Card shows before first Sage message in `open_day` sessions:
   - Time-aware greeting: "Good morning, Tom"
   - One-line LLM-generated contextual hook: "You've got 3 meetings and an intention carried from yesterday"
   - "Open Your Day" CTA button that triggers Sage's first message

2. Day 1 fallback: greeting + "Let's plan your day together" + CTA

3. The card disappears once Sage's first message starts streaming.

---

#### Phase M2b: Home Screen Card-Stack Redesign

##### Task 7: Home Screen Layout Skeleton

**Files to modify:**
- `components/home/home-screen.tsx` — full redesign
- `lib/supabase/home-data.ts` — expand data fetching

**Implementation details:**

1. Replace current home screen content with card-stack layout:
   - Greeting + Date (time-aware)
   - Session Chips row (already exists in `session-chips.tsx`)
   - Hero Card slot (changes by time state)
   - Capture Bar (inline, morning + evening only)
   - Tier 2 card slots (conditional, ordered by time state)
   - Tier 3 ambient card slot (below fold)
   - Bottom safe zone (80px)

2. **Time state detection** — already exists from M1. Reuse `getTimeOfDay()` logic.

3. **Card ordering by time state** — follow the card stack tables from the brainstorm doc.

4. **Important gotcha from M1 learning**: When redesigning, trim `getHomeData()` to match the new UI. Remove fields the new UI doesn't consume. Don't leave phantom queries (see `docs/solutions/logic-errors/dead-code-accumulation-post-redesign.md`).

##### Task 8: Hero Card with LLM Contextual Line

**Files to create:**
- `app/api/home/contextual-line/route.ts` — lightweight Claude call
- `components/home/hero-card.tsx` — hero card component

**Files to modify:**
- `lib/supabase/home-data.ts` — add contextual line data

**Implementation details:**

1. **API endpoint** `/api/home/contextual-line`:
   - POST, authenticated
   - Input: time state, available context (yesterday's intention, journal summary, captures count, calendar summary)
   - Uses Claude Haiku for speed + low cost (similar to existing `pulse-blurb/route.ts:52-61` pattern)
   - Returns 1-2 sentence contextual line
   - Fallback lines for Day 1

2. **Tone guidance** (from brainstorm):
   - Personal, warm, signals system intelligence
   - References user's own data and patterns
   - NOT generic motivational quotes

3. **Caching**: Cache per page load in component state. Don't re-fetch on every render. Consider `stale-while-revalidate` if performance matters.

##### Task 9: Tier 2 Content Cards

**Files to create:**
- `components/home/calendar-card.tsx`
- `components/home/yesterday-intention-card.tsx`
- `components/home/yesterday-synthesis-card.tsx`
- `components/home/checkin-card.tsx`
- `components/home/next-event-card.tsx`
- `components/home/breadcrumbs-card.tsx`
- `components/home/captures-today-card.tsx`
- `components/home/morning-intention-recall-card.tsx`

**Implementation details:**

Each card follows the design tokens from the brainstorm:
- Card background: white to light cream
- Left-border accent: 3-4px, rounded, colored by card type
- Card padding: 16-20px internal
- Card gap: 16-20px vertical
- All cards conditional — only render when data exists

**Card-specific notes:**

1. **Yesterday's Intention Card** — "Completed" writes to yesterday's day plan frontmatter. "Carry forward" creates context entry for morning session. Both actions use server actions or API calls, not silent operations.

2. **Calendar Card** — compact one-liner from `getCalendarEvents()`. Tap action TBD (inline expand or calendar deep link).

3. **Breadcrumbs Card** — evening only, reads from `captures/` directory. Each capture displayed as blockquote with inner left-border.

4. **Check-In Card** — mid-day only, references morning intention. Quick-tap buttons: Yes / Not yet / Snooze.

##### Task 10: Tier 3 Ambient Card

**Files to create:**
- `components/home/ambient-card.tsx`
- `lib/data/reflective-prompts.ts` — static prompt pool

**Implementation details:**

- "Something to Sit With" — rotating reflective prompt
- Static pool of 10-15 prompts, randomly selected per day (seeded by date)
- Morning + evening only

##### Task 11: Home Data API Enhancement

**Files to modify:**
- `lib/supabase/home-data.ts` — full rewrite for new card data

**Implementation details:**

Expand to fetch:
- Today's day plan (intention, status)
- Yesterday's day plan (intention, completion status)
- Yesterday's journal (first paragraph summary)
- Today's captures (count + list)
- Calendar events (from integration)
- Active session (for resume card)
- Check-in status

**Graceful degradation**: Day 1 renders hero + capture bar + ambient only. Each data source is independently optional.

##### Task 12: Tab Bar & Voice Orb Updates

**Files to modify:**
- `components/ui/bottom-tab-bar.tsx` — extend orb routing

**Implementation details:**

Orb contextual routing:
- Morning → `open_day`
- Mid-day → `quick_capture` (M3; for now, route to `ad_hoc`)
- Evening → `close_day` (already built)

##### Task 13: Capture Bar Component

**Files to create:**
- `components/home/capture-bar.tsx`

**Implementation details:**

- Slim inline strip: text cursor icon + "Drop a thought"
- Tap triggers inline expansion: text field grows in place, mic button appears
- User types or speaks, hits send, bar collapses
- No navigation, no context switch
- Captures write to `captures/{date}-{timestamp}.md` (M3 wires storage; M2b builds UI only)
- Morning + evening only

---

#### Phase M2c: Life Map Tab Enrichment

##### Task 14: Life Map Tab Redesign

**Files to modify:**
- `app/(main)/life-map/page.tsx` — absorb content from home
- `components/life-map/` — new/modified components

**Implementation details:**

- Absorb from Home: north star narrative, active commitments, boundaries, quarterly focus
- Keep: radar chart, domain cards with status
- Layout: radar chart at top → narrative sections (north star, commitments, boundaries) → domain cards
- Single scrollable page (simplest; can add sections later)

##### Task 15: Home Screen Content Cleanup

**Files to modify:**
- `components/home/home-screen.tsx` — remove migrated content

**Implementation details:**

- Remove identity content that moved to Life Map tab
- Verify no broken references or empty states
- Run through all time states to confirm clean rendering

---

#### Phase M3: Quick Capture + Mid-Day + Full Daily Rhythm

##### Task 16: Quick Capture Input Surface

**Files to create:**
- `app/api/capture/route.ts` — capture write endpoint
- `components/capture/capture-input.tsx` — capture UI component

**Files to modify:**
- `components/home/capture-bar.tsx` — wire to actual storage
- `components/ui/bottom-tab-bar.tsx` — mid-day orb → quick_capture

**Implementation details:**

1. Dedicated capture flow: tap → record/type → save → done (no AI conversation)
2. Voice input via existing MediaRecorder + transcription pipeline
3. Text input fallback
4. Entry points: capture bar (inline expansion), mid-day voice orb, session chips "Capture" button
5. `quick_capture` is NOT a real session — just a write operation. No messages table entry, no streaming.
6. All captures also append to today's day plan Quick Capture section (if day plan exists)

##### Task 17: Simple AI Classification

**Files to create:**
- `lib/ai/classify-capture.ts` — lightweight classification

**Implementation details:**

1. After capture is saved, make lightweight Claude Haiku call:
   - Input: capture text + user's life map domain list
   - Output: `{ classification: 'thought' | 'task' | 'idea' | 'tension', tags: string[] }`
2. Update capture frontmatter with classification + tags
3. No routing logic — just classify and store
4. Fire-and-forget: classification happens async after save confirmation. User sees "Captured" immediately.

##### Task 18: Capture File System

**Files to modify:**
- `lib/markdown/user-file-system.ts` — wire capture methods
- `lib/markdown/constants.ts` — capture write permissions
- `lib/markdown/file-write-handler.ts` — capture path resolution

**Implementation details:**

1. `writeCapture(date, timestamp, content, overrides)` — writes to `captures/{date}-{timestamp}.md`
2. `listCaptures(date)` — lists captures for a given date, sorted by timestamp
3. `readCapture(path)` — reads a specific capture
4. Auto-generated frontmatter:
```yaml
date: 2026-02-19
type: capture
timestamp: "2026-02-19T14:14:00+09:00"
input_mode: voice
classification: thought
auto_tags: [career, meos]
folded_into_journal: false
```

5. Write permissions:
```typescript
quick_capture: ['captures/'],
```

##### Task 19: Capture → Evening Synthesis Integration

**Files to modify:**
- `lib/ai/context.ts` — add captures to close_day context
- `skills/close-day.md` — update prompt to reference captures

**Implementation details:**

1. `close_day` context injection now reads today's captures:
   - `listCaptures(today)` → inject as context block
   - Include count + content of each capture

2. Update close-day prompt/skill: "You dropped N thoughts today. Let's make sense of them."

3. Journal artifact includes captures:
```markdown
**Quick captures folded in:**
- 2:14pm: "Feeling stuck on onboarding flow"
- 4:30pm: "Good convo with Claude on agent-native arch"
```

4. After synthesis, update capture frontmatter: `folded_into_journal: true`

##### Task 20: Mid-Day Nudge

**Files to create:**
- `app/api/nudge/trigger/route.ts` — nudge generation endpoint
- `lib/notifications/nudge.ts` — nudge content generator

**Files to modify:**
- `lib/notifications/push.ts` — extend for nudge payloads
- `components/home/checkin-card.tsx` — wire nudge response actions

**Implementation details:**

1. Push notification referencing morning intention:
   - "You set an intention to focus on the proposal. Still on track?"
   - One-tap response: Yes / Not yet / Snooze

2. Trigger: cron job or scheduled function, mid-afternoon (~2-3pm)
   - Requires today's day plan exists (user completed Open the Day)
   - Use existing push notification infrastructure (`lib/notifications/push.ts`)

3. Response handling:
   - "Yes" → creates lightweight capture: "On track with [intention]"
   - "Not yet" → creates capture: "Not on track with [intention] — [optional note]"
   - "Snooze" → dismisses, no action

4. Home screen Check-In card mirrors the push notification content

##### Task 21: Home Screen Mid-Day Polish

**Files to modify:**
- `components/home/home-screen.tsx` — wire mid-day cards to real data

**Implementation details:**

- Check-In card: reads from today's day plan, shows intention + quick response buttons
- Next Event card: reads from calendar, shows next event within ~2 hours
- Captures Today card: reads from `captures/` directory, shows today's captures
- These card components were built in M2b; M3 connects them to live data from captures + nudge responses

---

## Acceptance Criteria

### Functional Requirements

#### M2a
- [x] Google Calendar connected via OAuth; today's events visible
- [x] `open_day` session completes with 3-beat arc: briefing → focus question → commit
- [x] Day plan artifact written to `day-plans/{date}.md` with correct frontmatter
- [x] Quick-reply buttons appear after Sage's focus question (AI-driven via `[SUGGESTED_REPLIES]`)
- [x] If Sage's message contains no `[SUGGESTED_REPLIES]` block, existing StateQuickReplies render as fallback
- [x] Skill files load for `open_day` and `close_day`; prompts.ts fallback works
- [x] Carry-forward logic surfaces yesterday's incomplete intention in morning briefing
- [x] If yesterday had no day plan, carry-forward section is absent (not "No intention found")
- [x] Pre-chat briefing card renders before first Sage message
- [x] `[INLINE_CARD type="calendar"]` renders calendar events as tappable mini-cards in Beat 1 (not raw text)
- [x] `[INTENTION_CARD]` renders carried intention with Keep/Change buttons; Keep skips Beat 2 discovery, Change triggers follow-up
- [x] Session interruption: abandoned `open_day` shows resume card; tapping hero again redirects to resume (no duplicate sessions)
- [x] Session expiry: `close_day` context build marks stale `open_day` sessions as `expired`
- [x] Day 1 open_day: Sage handles zero-context gracefully (no calendar, no yesterday data), produces a day plan with just an intention
- [x] Calendar not connected: Beat 1 skips calendar line and `[INLINE_CARD]` entirely (no "connect your calendar" nag), day plan Calendar section omitted
- [x] Calendar token refresh: after initial OAuth, expired tokens refresh automatically without re-consent
- [x] `open_day` is single-use per day: after completion, morning hero card changes to "View Day Plan"
- [x] Both `open_day` and `quick_capture` added to `SessionType` union

#### M2b
- [x] Home screen shows correct time-aware card stack (morning/mid-day/evening)
- [x] Hero card displays LLM-generated contextual line (personal, warm, not generic)
- [x] All conditional Tier 2 cards render when data exists, absent when it doesn't
- [x] Session chips route to correct session types; morning hero CTA routes to `?type=open_day` (not `ad_hoc`)
- [x] Capture bar renders inline, expands on tap (UI only — storage wired in M3)
- [x] Day 1 experience: clean hero + capture bar + ambient, no empty states
- [x] Bottom safe zone: no content clipped by tab bar orb
- [x] Existing check-in overdue nudge card survives redesign across all states
- [x] `ad_hoc` session type remains accessible via Chat tab (not orphaned by home screen route changes)

#### M2c
- [x] Life Map tab shows north star, commitments, boundaries, quarterly focus (single scrollable page, no tabs)
- [x] Home screen no longer shows identity content
- [x] No broken references between home and life map

#### M3
- [ ] Quick capture: tap → type/speak → save → done (under 10 seconds)
- [ ] Captures classified (thought/task/idea/tension) with auto-tags
- [ ] If classification fails (LLM error/timeout), capture saved with `classification: null` and no tags; user sees "Captured" confirmation regardless
- [ ] `close_day` references today's captures in evening synthesis
- [ ] Journal artifact lists folded-in captures
- [ ] Mid-day nudge notification references morning intention
- [ ] Mid-day nudge is NOT sent if the user did not complete Open the Day
- [ ] Mid-day home screen cards show live data (captures, check-in, next event)

### Non-Functional Requirements

- [ ] Calendar OAuth token refresh works without re-consent; permanent revocation degrades gracefully (remove integration row, treat as "not connected")
- [ ] LLM contextual line loads in <2s (Haiku model)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npx vitest run` passes (all existing + new tests)
- [ ] No regressions on life mapping, check-in, or close_day flows
- [ ] Dates use consistent local-date strategy (not UTC) for file paths and display

### Quality Gates

- [ ] Each phase (M2a, M2b, M2c, M3) self-tested end-to-end before moving to next
- [ ] Home screen tested in all 3 time states + Day 1 empty state
- [ ] Calendar integration tested with real Google account
- [ ] Calendar-not-connected path tested: all calendar-dependent flows degrade gracefully

---

## SpecFlow Analysis — Resolved Gaps

The following gaps were identified by automated spec-flow analysis and resolved inline:

### Critical (incorporated into tasks above)

1. **`DayPlanFrontmatter` Zod schema missing** — Task 3 must add Zod schema + frontmatter generator matching the artifact structure. Finalize fields: `{ type: 'day-plan', date, intention, status: 'active'|'closed', created_from: 'open_day'|'carry_forward' }`.
2. **`DAY_PLAN` and `CAPTURE` missing from `FILE_TYPES` constant** — Task 3 must add both to `lib/markdown/constants.ts` so the parser accepts `[FILE_UPDATE type="day-plan"]` blocks. Without this, parser rejects them as unknown types.
3. **`quick_capture` missing from `SessionType` union** — Task 3 adds `open_day`; Task 16 must also add `quick_capture` to `types/chat.ts`.
4. **`captures/` missing from `close_day` write permissions** — If `close_day` marks captures as `folded_into_journal: true`, it needs write access to `captures/`. Add in Task 19 when wiring capture → synthesis.
5. **`rebuildIndex()` in UserFileSystem doesn't include `day-plans/` or `captures/`** — Update the rebuild list in `lib/markdown/user-file-system.ts:448` when adding these path prefixes.
6. **Day 1 empty state for `open_day`** — Skill file must include explicit Day 1 instructions: skip calendar line, skip carry-forward, fall back to "What matters most to you today?" focus question.

### Important (acceptance criteria updated)

7. **Capture bar M2b gap behavior** — Resolved: shows "Coming soon" toast on send. Storage wired in M3.
8. **Calendar-not-connected degradation** — Resolved: Beat 1 skips calendar line, day plan omits Calendar section, no nag cards (per Home Page Design spec line 315).
9. **Concurrent day plan writes** — Captures go to separate files (`captures/{date}-{timestamp}.md`). Day plan's Quick Capture section is populated during evening synthesis only, not by real-time appends. No file-level locking needed.
10. **`open_day` re-entry** — Resolved: single-use per day. After completion, hero card becomes "View Day Plan" with "Redo" secondary action.
11. **Task 8 depends on Task 11** — Task 8 (hero contextual line) needs data from Task 11 (home data API). Implementation note: stub the data first or implement Tasks 8+11 together.

### Explicitly Deferred

12. **Context-aware mid-day card** ("Your 1:1 just ended. Anything worth capturing?") — Deferred beyond M3. Requires deep calendar event correlation.
13. **Voice orb long-press for generic "Talk to Sage"** — Deferred. Current orb tap routes contextually; long-press is a future enhancement.
14. **Timezone/DST edge cases** — Added acceptance criterion for consistent local-date strategy. Implementation: use `new Date().toLocaleDateString('en-CA')` (YYYY-MM-DD format in local time) instead of `toISOString().split('T')[0]`.

---

## Dependencies & Risks

| Dependency | Risk | Mitigation |
|---|---|---|
| Google Cloud OAuth consent screen | Can take days for verification in production | Use "Testing" mode for dev; add test users manually |
| Google Calendar API quotas | Unlikely to hit in MVP scale | Monitor; cache events per page load |
| Supabase provider token storage | PKCE flow gotcha: refresh token only sent with `prompt: 'consent'` | Enforce `access_type: 'offline'` + `prompt: 'consent'` in OAuth call |
| Calendar token permanent revocation | User revokes access from Google settings | Catch refresh failure → delete integration row → degrade to "not connected" state |
| `[SUGGESTED_REPLIES]` parser reliability | Claude might not emit markers consistently | Frontend-driven fallback always exists; AI markers are enhancement, not requirement |
| Home screen data layer bloat | Dead code accumulation (documented learning from M1) | Trim `getHomeData()` to match new UI; delete unused fields immediately |
| Day plan "living document" writes | Multiple write sources could race | Captures write to separate files; day plan only written by `open_day` session and carry-forward. No concurrent write risk. |
| Migration numbering conflict | `013_calendar_integration.sql` may collide | Verify `supabase/migrations/` numbering before creating |

---

## References & Research

### Internal References
- Brainstorm: `docs/brainstorms/2026-02-18-milestone2-3-scoping-brainstorm.md`
- M1 Design: `Docs/plans/2026-02-18-milestone1-close-the-day-design.md`
- Daily Rhythm Spec: `Docs/feedback/20260218_MeOS_Daily_Rhythm.md`
- Home Page Design Spec: `Docs/feedback/20260218_Home_page_design.md`
- Dead Code Learning: `docs/solutions/logic-errors/dead-code-accumulation-post-redesign.md`
- Session type pattern: `lib/ai/context.ts`, `lib/ai/prompts.ts`
- File system pattern: `lib/markdown/user-file-system.ts`, `lib/markdown/constants.ts`
- Parser pattern: `lib/ai/parser.ts`
- Existing OAuth: `app/(auth)/login/page.tsx`, `app/(auth)/auth/callback/route.ts`
- Existing push notifications: `lib/notifications/push.ts`, `app/api/push/subscribe/route.ts`
- LLM one-shot pattern: `app/api/pulse-blurb/route.ts`
- Existing quick-reply buttons: `components/chat/quick-reply-buttons.tsx`
- Existing state quick-replies: `components/chat/chat-view.tsx:46-105`

### External References
- [Supabase Google OAuth with extra scopes](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase PKCE flow + provider token](https://supabase.com/docs/guides/auth/sessions/pkce-flow)
- [Google Calendar API v3](https://developers.google.com/calendar/api/v3/reference)
- [Supabase provider refresh token gotcha](https://github.com/supabase/auth/issues/1450)

### Design Inspiration
- Magic Patterns mockups: `inspiration/20260218_Homescreen_design/`
