---
title: "fix: Playtest 7 — session lifecycle, history, and UX polish"
type: fix
date: 2026-02-24
source: Docs/brainstorms/2026-02-24-playtest-7-fixes-brainstorm.md
feedback: Docs/feedback/202624_playtest_7.md
---

# fix: Playtest 7 — Session Lifecycle, History, and UX Polish

## Overview

Batch of P0 + P1 fixes from playtest 7 to unblock external user testing. The root issue is that session completion detection — currently client-side in ChatView — fails silently, causing cascading problems: stale home screen cards, broken exit modals, and a history screen full of "Incomplete" entries.

The fix moves completion detection server-side into the API route, adds fallback UI behaviors, and fills in missing History screen features.

## Problem Statement

Sessions that complete conversationally (Sage delivers a closing message + terminal artifact like a JournalCard or DayPlanConfirmationCard) are not having their `status` updated from `active` to `completed`. This causes:

1. Home screen shows stale "Continue your evening reflection" cards
2. Exit modal shows "Pause & Exit" instead of "Close Session"
3. History screen shows nearly all sessions as "Incomplete"
4. `open_day`/`close_day` sessions missing from History labels entirely
5. Duplicate send-off text in Open the Day flow

## Proposed Solution

Five fixes, ordered by dependency:

| # | Fix | Scope | Depends on |
|---|-----|-------|------------|
| 1 | Server-side session completion detection | API route + DB | — |
| 2 | Exit modal artifact detection fallback | ChatView + ExitConfirmationSheet | — |
| 3 | History screen labels + LLM summaries | History components + new API route | Fix 1 |
| 4 | Duplicate send-off stripping | MessageBubble parser | — |
| 5 | Energy level enum reconciliation | 3 components + parser types | — |

## Technical Approach

### Fix 1: Server-Side Session Completion Detection

**Problem:** The API route (`app/api/chat/route.ts`) is a pure streaming proxy — it pipes Claude tokens to the client via SSE with zero post-stream logic. All completion detection lives in `chat-view.tsx` (lines 956-1067) but fails silently due to streaming race conditions.

**Approach:** Add text accumulation and post-stream parsing to the API route. After the stream completes, detect terminal artifacts and update session status server-side.

#### 1a. Accumulate response text server-side

```typescript
// app/api/chat/route.ts — inside the ReadableStream start() callback
let accumulated = ''

messageStream.on('text', (text) => {
  accumulated += text
  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
})
```

Currently the route just forwards chunks. Add accumulation without changing streaming behavior.

#### 1b. Post-stream completion detection

After `messageStream.finalMessage()` (line 341), add terminal artifact detection:

```typescript
// After finalMessage(), before sending [DONE]
const sessionType = body.sessionType  // Already validated by ChatRequestSchema
const sessionId = body.sessionId      // Need to add to request schema

if (sessionId && sessionType) {
  const isTerminal = detectTerminalArtifact(accumulated, sessionType)

  if (isTerminal === 'complete') {
    await completeSession(supabaseServer, sessionId)
    // Signal to client
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ sessionCompleted: true })}\n\n`))
  } else if (isTerminal === 'pending_completion') {
    // close_day Phase A: journal emitted, awaiting user confirmation
    await supabaseServer.from('sessions')
      .update({ metadata: { ...existingMetadata, pending_completion: true } })
      .eq('id', sessionId)
  }
}
```

#### 1c. Terminal artifact detection function

New file: `lib/ai/completion-detection.ts`

```typescript
export type CompletionSignal = 'complete' | 'pending_completion' | 'none'

export function detectTerminalArtifact(
  responseText: string,
  sessionType: SessionType
): CompletionSignal {
  switch (sessionType) {
    case 'open_day':
      // Day plan file update OR day_plan_data block = session complete
      if (responseText.includes('[FILE_UPDATE type="day-plan"') ||
          responseText.includes('[DAY_PLAN_DATA]')) {
        return 'complete'
      }
      return 'none'

    case 'close_day':
      // Daily log = Phase A (pending), not yet complete
      if (responseText.includes('[FILE_UPDATE type="daily-log"')) {
        return 'pending_completion'
      }
      return 'none'

    case 'life_mapping':
      if (responseText.includes('[FILE_UPDATE type="overview"') ||
          responseText.includes('[LIFE_MAP_SYNTHESIS]')) {
        return 'complete'
      }
      return 'none'

    case 'weekly_checkin':
      if (responseText.includes('[FILE_UPDATE type="check-in"') ||
          responseText.includes('[SESSION_SUMMARY]')) {
        return 'complete'
      }
      return 'none'

    default:
      return 'none'
  }
}
```

#### 1d. close_day two-phase completion

close_day requires two API calls to complete. Phase A: Sage emits journal card. Phase B: user confirms, Sage gives closing message without another journal block.

**On the API route's next request for a close_day session with `pending_completion` flag:**

```typescript
// At the start of the API route, before streaming
if (sessionType === 'close_day' && sessionId) {
  const { data: session } = await supabaseServer
    .from('sessions')
    .select('metadata')
    .eq('id', sessionId)
    .single()

  if (session?.metadata?.pending_completion) {
    // This is Phase B — check AFTER streaming if the response completes the session
    // Set a flag to check post-stream
    pendingCloseDay = true
  }
}

// After stream completes:
if (pendingCloseDay) {
  const hasNewJournal = accumulated.includes('[FILE_UPDATE type="daily-log"')
  const hasSuggestedReplies = accumulated.includes('[SUGGESTED_REPLIES]')

  if (!hasNewJournal && !hasSuggestedReplies) {
    // Phase B complete — no new journal, no more questions
    await completeSession(supabaseServer, sessionId)
    // Clear the pending flag
    await supabaseServer.from('sessions')
      .update({ metadata: { ...session.metadata, pending_completion: undefined } })
      .eq('id', sessionId)
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ sessionCompleted: true })}\n\n`))
  }
}
```

#### 1e. Add sessionId to chat request schema

The API route needs `sessionId` to update session status. Currently the schema (`ChatRequestSchema` at line 45-55) doesn't include it.

```typescript
// app/api/chat/route.ts — extend ChatRequestSchema
const ChatRequestSchema = z.object({
  messages: z.array(...),
  sessionType: z.enum([...]),
  sessionId: z.string().uuid().optional(),  // NEW
  // ... existing fields
})
```

The client already has `sessionId` — just needs to pass it in the request body.

#### 1f. Client-side: handle server completion signal

In `chat-view.tsx`'s `streamAndFinalize()`, detect the `sessionCompleted` SSE event:

```typescript
// Inside the streaming loop, when parsing SSE data
const parsed = JSON.parse(jsonStr)
if (parsed.sessionCompleted) {
  setSessionCompleted(true)
  // Don't need to call completeSession() client-side — server already did it
}
if (parsed.text) {
  accumulated += parsed.text
  // ... existing text handling
}
```

#### 1g. Keep client-side completion as fallback

Don't remove the existing client-side `completeSession()` calls. Add a guard to avoid double-completion:

```typescript
// Before any client-side completeSession() call
if (sessionCompleted) return  // Server already handled it
```

**Files changed:**
- `app/api/chat/route.ts` — accumulate text, post-stream detection, sessionId in schema
- `lib/ai/completion-detection.ts` — NEW: terminal artifact detection
- `components/chat/chat-view.tsx` — handle server completion signal, guard client-side calls
- `lib/supabase/sessions.ts` — no changes (completeSession already works server-side)

---

### Fix 2: Exit Modal Artifact Detection Fallback

**Problem:** When the X button is tapped on a completed-but-not-marked session, the modal shows "Pause this session?" instead of "Close Session."

**Approach:** Track whether a terminal artifact card has rendered. Use this as a fallback signal alongside `sessionCompleted`.

#### 2a. Track terminal artifact rendering

```typescript
// chat-view.tsx — new state
const [hasTerminalArtifact, setHasTerminalArtifact] = useState(false)
```

Set `true` when the parser detects a terminal block in a rendered message. The existing detection in `sendMessage()` already identifies these blocks — just need to set the flag:

```typescript
// After hasDailyLog, hasDayPlan, hasOverview, hasCheckIn detection (line 956-959)
if (hasDailyLog || hasDayPlan || hasOverview || hasCheckIn) {
  setHasTerminalArtifact(true)
}
```

Also set on `[SESSION_SUMMARY]` and `[LIFE_MAP_SYNTHESIS]` detection (lines 789, 822).

#### 2b. Update handleExit logic

```typescript
// chat-view.tsx — handleExit callback
const handleExit = useCallback(() => {
  const client = createClient()

  // If session is functionally complete (artifact rendered), close directly
  if (hasTerminalArtifact || sessionCompleted) {
    router.push('/home')
    return
  }

  // ... existing onboarding / message count logic
}, [hasTerminalArtifact, sessionCompleted, /* existing deps */])
```

#### 2c. Update exit confirmation sheet

Add a third variant for "session looks complete":

```typescript
// exit-confirmation-sheet.tsx — add isComplete prop
interface ExitConfirmationSheetProps {
  open: boolean
  isOnboarding: boolean
  isComplete?: boolean  // NEW
  onPause: () => void
  onContinue: () => void
}

// Inside the component:
if (isComplete) {
  // Title: "Session complete"
  // Body: "Your session is saved."
  // Primary: "Back to Home"
  // No secondary "Keep Going" — or optionally "Review conversation"
}
```

**Note:** With fix 2b routing directly to `/home` for complete sessions, the sheet may not even be needed for this case. But it's good to have the variant for edge cases where the user somehow sees it.

**Files changed:**
- `components/chat/chat-view.tsx` — `hasTerminalArtifact` state, updated `handleExit`
- `components/chat/exit-confirmation-sheet.tsx` — `isComplete` variant (optional, may not be needed)

---

### Fix 3: History Screen Labels + LLM Summaries

#### 3a. Add missing session type labels

```typescript
// components/history/session-card.tsx — update SESSION_TYPE_LABELS
const SESSION_TYPE_LABELS: Record<string, string> = {
  life_mapping: 'Life Mapping',
  weekly_checkin: 'Weekly Check-In',
  monthly_review: 'Monthly Review',
  quarterly_review: 'Quarterly Review',
  ad_hoc: 'Conversation',
  close_day: 'Evening Reflection',   // NEW
  open_day: 'Morning Session',       // NEW
  quick_capture: 'Quick Capture',    // NEW
}
```

Same change needed in:
- `app/(main)/history/[sessionId]/page.tsx` (lines 37-43)

#### 3b. Update stale Session type in database.ts

```typescript
// types/database.ts — line 44
export interface Session {
  // ...
  session_type: 'life_mapping' | 'weekly_checkin' | 'monthly_review' | 'quarterly_review' | 'ad_hoc' | 'close_day' | 'open_day' | 'quick_capture'
  status: 'active' | 'completed' | 'abandoned' | 'expired'
  // ...
}
```

#### 3c. Post-session summary generation API route

New API route: `app/api/session/generate-summary/route.ts`

Called fire-and-forget from the chat API route after `completeSession()`. Generates `ai_summary`, `key_themes`, `sentiment`, `energy_level` using a focused Claude call.

```typescript
// app/api/session/generate-summary/route.ts
export async function POST(request: Request) {
  const { sessionId } = await request.json()

  // Load recent messages (last 20, enough for context)
  const { data: messages } = await supabase
    .from('messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(20)

  // Load session for type context
  const { data: session } = await supabase
    .from('sessions')
    .select('session_type')
    .eq('id', sessionId)
    .single()

  // Generate summary via Claude (small, fast call)
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system: `You are summarizing a ${session.session_type} session. Return JSON only:
{
  "summary": "1-2 sentence summary of what was discussed",
  "themes": ["theme1", "theme2"],
  "sentiment": "positive|neutral|mixed|negative",
  "energy_level": 1-5
}`,
    messages: messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: stripBlockTags(m.content)  // Sanitize!
    }))
  })

  // Parse and save
  const result = JSON.parse(response.content[0].text)
  await updateSessionSummary(
    supabase, sessionId,
    result.summary, result.themes, [],
    result.sentiment, result.energy_level
  )

  return Response.json({ ok: true })
}
```

#### 3d. Trigger summary generation from chat API route

After `completeSession()` in the chat route (Fix 1b), fire-and-forget:

```typescript
// Fire-and-forget — don't await, don't block the stream
fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/session/generate-summary`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ sessionId }),
}).catch(() => console.error('Failed to trigger summary generation'))
```

**Security note:** The summary generation route needs auth validation. Use service-role or validate the session belongs to the authenticated user.

**Files changed:**
- `components/history/session-card.tsx` — add missing labels
- `app/(main)/history/[sessionId]/page.tsx` — add missing labels
- `types/database.ts` — update Session type
- `app/api/session/generate-summary/route.ts` — NEW: LLM summary generation
- `app/api/chat/route.ts` — trigger summary after completion

---

### Fix 4: Duplicate Send-Off Stripping

**Problem:** In `MessageBubble`, the parsed message has both text segments ("You're set. Go make it happen.") and block segments (`day_plan_data` / `file_update`). The `SessionCompleteCard` renders the same send-off text.

**Approach:** In the segment renderer, suppress text segments that appear AFTER a terminal block in the same message.

#### 4a. Filter trailing text after terminal blocks

```typescript
// components/chat/message-bubble.tsx — in the rendering logic

// Determine if this message contains a terminal block
const hasTerminalBlock = parsedContent.segments.some(
  (s) => s.type === 'block' && (
    s.blockType === 'day_plan_data' ||
    (s.blockType === 'file_update' && ['daily-log', 'overview', 'check-in'].includes(s.data.fileType))
  )
)

// Find the index of the last terminal block
const lastTerminalIdx = hasTerminalBlock
  ? parsedContent.segments.reduce((last, s, i) =>
      s.type === 'block' && (s.blockType === 'day_plan_data' ||
        (s.blockType === 'file_update' && ['daily-log', 'overview', 'check-in'].includes(s.data.fileType)))
        ? i : last, -1)
  : -1

// When rendering segments, skip text segments after the last terminal block
{parsedContent.segments.map((segment, i) => {
  // Suppress trailing text after terminal blocks
  if (hasTerminalBlock && segment.type === 'text' && i > lastTerminalIdx) {
    return null
  }
  return <SegmentRenderer key={i} segment={segment} />
})}
```

This keeps all text BEFORE the terminal block (Sage's conversational responses) but strips text AFTER (the duplicate send-off).

**Files changed:**
- `components/chat/message-bubble.tsx` — filter trailing text segments

---

### Fix 5: Energy Level Enum Reconciliation

**Problem:** Three separate energy level systems with different labels:

| Component | Values |
|-----------|--------|
| `EnergyCheckCard` (open_day input) | energized, good, neutral, low, rough |
| `DayPlanDataSchema` (parser) | fired_up, focused, neutral, low, stressed |
| `JournalCard` (close_day display) | high, moderate, low |

#### 5a. Establish canonical mapping

Create a shared energy level mapping:

```typescript
// lib/utils/energy-levels.ts — NEW

/** Canonical energy levels used across the app */
export type EnergyLevel = 'energized' | 'good' | 'neutral' | 'low' | 'rough'

/** Display labels with emoji */
export const ENERGY_DISPLAY: Record<EnergyLevel, { label: string; emoji: string }> = {
  energized: { label: 'Energized', emoji: '\uD83D\uDD25' },
  good: { label: 'Good', emoji: '\uD83D\uDE0A' },
  neutral: { label: 'Neutral', emoji: '\uD83D\uDE10' },
  low: { label: 'Low', emoji: '\uD83D\uDE14' },
  rough: { label: 'Rough', emoji: '\uD83D\uDE23' },
}

/** Map DayPlanData energy levels to canonical */
export const DAY_PLAN_ENERGY_MAP: Record<string, EnergyLevel> = {
  fired_up: 'energized',
  focused: 'good',
  neutral: 'neutral',
  low: 'low',
  stressed: 'rough',
}

/** Map JournalCard energy levels to canonical */
export const JOURNAL_ENERGY_MAP: Record<string, EnergyLevel> = {
  high: 'energized',
  moderate: 'good',
  low: 'low',
}
```

#### 5b. Update components to use canonical mapping

- `EnergyCheckCard` — already uses canonical labels, no change needed
- `DayPlanConfirmationCard` — use `DAY_PLAN_ENERGY_MAP` to display canonical labels
- `JournalCard` — use `JOURNAL_ENERGY_MAP` to display canonical labels
- `DayPlanDataSchema` in `parser.ts` — keep existing enum for backward compat, map at display layer

**Files changed:**
- `lib/utils/energy-levels.ts` — NEW: canonical mapping
- `components/chat/day-plan-confirmation-card.tsx` — use canonical display
- `components/chat/journal-card.tsx` — use canonical display

---

## Acceptance Criteria

### Functional Requirements

- [ ] Complete a Close the Day session → home screen does NOT show "Continue" card
- [ ] Complete an Open the Day session → home screen does NOT show "Continue" card
- [ ] History screen shows completed sessions as "Completed"
- [ ] History screen shows "Morning Session" / "Evening Reflection" labels (not raw enum values)
- [ ] History screen shows AI-generated summaries for completed sessions
- [ ] Tapping X on a completed session navigates home (not "Pause" modal)
- [ ] Open the Day send-off text appears only once (via SessionCompleteCard)
- [ ] Energy labels are consistent across EnergyCheckCard, DayPlanConfirmationCard, JournalCard

### Non-Functional Requirements

- [ ] Server-side completion detection does not add noticeable latency to streaming
- [ ] Summary generation happens async (does not block the chat)
- [ ] All date operations use timezone-aware `getLocalDateString()` (not `new Date()`)
- [ ] User text in summary prompts uses `stripBlockTags()` sanitization

### Quality Gates

- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` succeeds
- [ ] Manual test: full open_day + close_day cycle with verification of all acceptance criteria

---

## Implementation Phases

### Phase 1: Server-Side Completion Detection (Fix 1)

**Tasks:**
1. [x] Add `sessionId` to `ChatRequestSchema` in `app/api/chat/route.ts`
2. [x] Create `lib/ai/completion-detection.ts` with `detectTerminalArtifact()`
3. [x] Add text accumulation to the streaming handler in the API route
4. [x] Add post-stream completion detection and `completeSession()` call
5. [x] Add `pending_completion` metadata flag handling for close_day two-phase
6. [x] Send `sessionCompleted` SSE event to client
7. [x] Update `chat-view.tsx` to handle `sessionCompleted` SSE event
8. [x] Guard existing client-side `completeSession()` calls with `if (!sessionCompleted)`
9. [x] Pass `sessionId` in the fetch body from `chat-view.tsx`

**Verification:** Complete an open_day session, check DB for `status='completed'`. Complete a close_day session (both phases), check DB. Check that home screen no longer shows stale "Continue" card.

### Phase 2: Exit Modal + History + Send-off + Energy (Fixes 2-5)

Fixes 2-5 are independent and can be done in parallel or any order.

**Fix 2 tasks:**
10. [x] Add `hasTerminalArtifact` state to `chat-view.tsx`
11. [x] Set flag when terminal blocks detected in parsed response
12. [x] Update `handleExit` to route directly to `/home` when artifact detected
13. [x] (Skipped) `isComplete` variant to `ExitConfirmationSheet` — not needed, direct nav suffices

**Fix 3 tasks:**
14. [x] Add missing session type labels to `session-card.tsx`
15. [x] Add missing session type labels to `history/[sessionId]/page.tsx`
16. [x] Update `Session` type in `types/database.ts`
17. [x] Create `app/api/session/generate-summary/route.ts`
18. [x] Trigger summary generation from chat API route after completion
19. [x] Add auth validation to summary generation route

**Fix 4 tasks:**
20. [x] In `message-bubble.tsx`, detect terminal blocks in segment list
21. [x] Suppress text segments that appear after the last terminal block

**Fix 5 tasks:**
22. [x] Create `lib/energy-levels.ts` with canonical mapping
23. [x] Update `DayPlanConfirmationCard` to use canonical display labels
24. [x] Update `JournalCard` to use canonical display labels

---

## Dependencies & Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Server-side completion adds latency | Stream feels slower | Completion detection runs AFTER finalMessage(), not during streaming. Client already has the full response. |
| close_day two-phase race condition | Session stuck as pending | Add timeout: if `pending_completion` flag is >30 min old, auto-complete on next API call |
| Summary generation Claude call fails | History shows no summary | Fire-and-forget with error logging. Summary is enhancement, not critical. |
| Double completion (server + client both fire) | DB error or state inconsistency | `completeSession()` should be idempotent (UPDATE ... WHERE status='active') |
| Existing sessions stuck as 'active' | Old sessions never appear in History | One-time cleanup: mark very old active sessions as 'expired' |

---

## References & Research

### Internal References

- Brainstorm: `Docs/brainstorms/2026-02-24-playtest-7-fixes-brainstorm.md`
- Feedback: `Docs/feedback/202624_playtest_7.md`
- API route: `app/api/chat/route.ts` (streaming handler: lines 310-364)
- Chat view completion: `components/chat/chat-view.tsx` (lines 956-1067)
- Exit handler: `components/chat/chat-view.tsx` (lines 230-253)
- Exit sheet: `components/chat/exit-confirmation-sheet.tsx`
- Session card: `components/history/session-card.tsx` (labels: lines 5-11)
- Parser: `lib/ai/parser.ts`
- Sessions CRUD: `lib/supabase/sessions.ts` (completeSession: lines 78-102)
- Session complete card: `components/chat/session-complete-card.tsx`
- Energy check card: `components/chat/energy-check-card.tsx`
- Journal card: `components/chat/journal-card.tsx`
- Day plan confirmation card: `components/chat/day-plan-confirmation-card.tsx`
- Database types: `types/database.ts` (stale Session type: line 44)

### Institutional Learnings (from docs/solutions/)

- `docs/solutions/runtime-errors/2026-02-24-open-day-flow-isstreaming-deadlock.md` — State management in ChatView, conditional mutations
- `docs/solutions/logic-errors/2026-02-21-server-side-utc-date-context-injection-bug.md` — MUST use `getLocalDateString(timezone)` for all date operations
- `docs/solutions/react-hooks/supabase-client-in-usecallback-deps.md` — Move `createClient()` inside handlers, derive state once
- `docs/solutions/security-issues/2026-02-23-context-injection-sanitization-hardening.md` — Apply `stripBlockTags()` to all user text in prompts
