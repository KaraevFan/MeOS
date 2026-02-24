---
title: "feat: Conversation Architecture — Open Conversation + Dynamic Mode Transitions"
type: feat
date: 2026-02-24
brainstorm: Docs/brainstorms/2026-02-24-conversation-architecture-brainstorm.md
source: Docs/feedback/20260224_conversation_architecture_spec.md
---

# feat: Conversation Architecture — Open Conversation + Dynamic Mode Transitions

## Overview

Transform MeOS from discrete, typed sessions into a two-layer conversation architecture:

1. **Open conversation** (base layer) — always available, context-rich, no locked arc
2. **Structured sessions** (modes within conversation) — entered/exited fluidly via `[ENTER_MODE]` signals

The bottom-tab orb becomes a universal "Talk to Sage" entry point. Sage generates context-aware openings and transitions into structured flows when appropriate, loading full skill files dynamically. HeroCard and SessionChips remain as opinionated shortcuts to structured flows.

## Problem Statement

Playtest 7 exposed three issues with the current session-type-first architecture:

1. **Orb routing is fragile** — time-of-day routing risks overwrites and creates confusing behavior
2. **No "just talk" option** — every conversation requires picking a typed session
3. **Structured flows are rigid** — no graceful pivoting mid-session

## Proposed Solution

Rename `ad_hoc` → `open_conversation` as the universal session type. The orb always opens this type. Sage's system prompt is context-rich and handles routing through conversation. When the user (or Sage) initiates a structured flow, Sage emits `[ENTER_MODE: open_day]`, the system stores the active mode in session metadata, and subsequent API calls load the full dedicated skill file. On arc completion, the system returns to open conversation mode with a "Keep talking" option.

## Technical Approach

### Architecture

```
                    ┌─────────────────────────────────────────┐
                    │          Session: open_conversation       │
                    │                                          │
                    │  ┌──────────────────────────────────┐   │
                    │  │  Prompt: open-conversation.md     │   │
                    │  │  (context-aware, no locked arc)   │   │
                    │  └──────────┬───────────────────────┘   │
                    │             │                             │
                    │   [ENTER_MODE: open_day]                 │
                    │             │                             │
                    │  ┌──────────▼───────────────────────┐   │
                    │  │  Prompt: open-day.md (full skill) │   │
                    │  │  metadata.active_mode = 'open_day'│   │
                    │  └──────────┬───────────────────────┘   │
                    │             │                             │
                    │   Terminal artifact detected              │
                    │   + "Keep talking" card                   │
                    │             │                             │
                    │  ┌──────────▼───────────────────────┐   │
                    │  │  Prompt: open-conversation.md     │   │
                    │  │  metadata.active_mode = null      │   │
                    │  │  metadata.completed_arcs += [...]  │   │
                    │  └──────────────────────────────────┘   │
                    └─────────────────────────────────────────┘
```

### Implementation Phases

---

#### Phase 1: Foundation — Rename + Schema + Types

Rename `ad_hoc` to `open_conversation` across the full stack and add typed session metadata.

##### Task 1.1: Database migration

Create `supabase/migrations/015_open_conversation.sql`:

```sql
-- Rename ad_hoc → open_conversation in existing rows
UPDATE sessions SET session_type = 'open_conversation' WHERE session_type = 'ad_hoc';

-- Drop old constraint and add new one with open_conversation
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_session_type_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_session_type_check
  CHECK (session_type IN (
    'life_mapping', 'weekly_checkin', 'monthly_review',
    'quarterly_review', 'open_conversation', 'close_day', 'open_day', 'quick_capture'
  ));
```

##### Task 1.2: TypeScript types

Update `types/chat.ts`:
```typescript
export type SessionType = 'life_mapping' | 'weekly_checkin' | 'open_conversation' | 'close_day' | 'open_day' | 'quick_capture'
```

Add metadata typing to `types/chat.ts`:
```typescript
export interface CompletedArc {
  type: SessionType
  completed_at: string  // ISO timestamp
}

export interface SessionMetadata {
  active_mode?: SessionType | null
  completed_arcs?: CompletedArc[]
  ad_hoc_context?: string  // legacy field
  [key: string]: unknown
}
```

Update `types/database.ts` Session interface to include `open_conversation` in the union.

##### Task 1.3: Rename all `ad_hoc` references

Files to update (complete list from repo scan):

| File | Change |
|------|--------|
| `types/chat.ts:5` | Type union: `ad_hoc` → `open_conversation` |
| `types/database.ts:44` | Type union: `ad_hoc` → `open_conversation` |
| `app/api/chat/route.ts:49` | Zod enum |
| `app/(main)/chat/page.tsx:92-99` | Session type resolution |
| `lib/ai/context.ts` | `buildConversationContext()` branches |
| `lib/ai/prompts.ts` | `getAdHocPrompt()` → rename or redirect |
| `lib/ai/completion-detection.ts` | Switch cases |
| `lib/markdown/constants.ts` | `SESSION_WRITE_PERMISSIONS` keys |
| `lib/session-labels.ts` | Label maps |
| `components/chat/session-header.tsx` | `SESSION_LABELS` |
| `components/home/home-screen.tsx` | Any `ad_hoc` references |
| `components/home/session-chips.tsx` | Chip href |
| `components/home/active-session-card.tsx` | Active session display |
| `components/ui/bottom-tab-bar.tsx:11-13` | `getOrbHref()` |
| `app/api/session/abandon/route.ts` | If it references ad_hoc |

**Gotcha (from learnings):** Update ALL code paths together. Test with the new enum value in all API routes before removing the old value from the DB constraint. Consider a two-phase migration if needed.

##### Task 1.4: Update write permissions

In `lib/markdown/constants.ts`, add `open_conversation` with full permissions:

```typescript
open_conversation: [
  'day-plans/',
  'daily-logs/',
  'check-ins/',
  'life-map/',
  'life-plan/current.md',
  'life-plan/weekly.md',
  'sage/',
  'captures/',
],
```

**Acceptance criteria:**
- [ ] All existing `ad_hoc` sessions migrated to `open_conversation` in DB
- [ ] TypeScript compiles with zero `ad_hoc` references
- [ ] All existing tests pass
- [ ] Session metadata has typed interface
- [ ] `npm run type-check` passes

---

#### Phase 2: Open Conversation Core

Build the open conversation prompt, context injection, orb routing, and session management.

##### Task 2.1: Create `skills/open-conversation.md` skill file

This is the most important new file. Frontmatter:

```yaml
---
name: Open Conversation
session_type: open_conversation
write_paths:
  - day-plans/
  - daily-logs/
  - check-ins/
  - life-map/
  - life-plan/
  - sage/
  - captures/
read_context:
  - life-map
  - life-plan
  - sage-context
  - sage-patterns
  - recent-check-ins
  - calendar
  - day-plan
  - daily-log
  - captures
duration: open
tone: warm, present, unhurried
---
```

Prompt body must cover:
- **Context-aware opening generation** — time of day, day plan status, recent activity, pending items
- **Structured flow suggestion triggers** — when to suggest morning/evening flow (gently, not forcefully)
- **`[ENTER_MODE]` emission rules** — emit only when user engages with a structured flow suggestion (not on Sage's initiative alone). Sage suggests → user responds affirmatively → Sage emits `[ENTER_MODE: {type}]` in its next response
- **Open conversation behavior** — just talk, handle lightweight requests, surface patterns proactively
- **Returning from arc** — after a completed arc, don't re-greet, acknowledge what just happened, stay available
- **Artifact rules** — may produce captures, day plan edits, or nothing. No terminal artifact required
- All standard Sage personality rules

##### Task 2.2: Update context injection for `open_conversation`

In `lib/ai/context.ts`, `fetchAndInjectFileContext()`:

Add an `open_conversation` branch that injects the **superset** of all context:
- Calendar events (currently only `open_day`)
- Yesterday's day plan + journal cross-reference (currently only `open_day`)
- Today's day plan + intention (currently only `close_day`)
- Today's captures (currently only `close_day`)
- Yesterday's uncompleted priorities (currently only `open_day`)
- All universal context (life map, life plan, sage context, patterns, check-ins)

**Gotcha (from learnings):** Resolve timezone once at entry, thread explicitly. Wrap all user data in `<user_data>` tags via `stripBlockTags()`.

**Token budget concern:** The superset context may be large. Consider a tiered injection:
- Always: sage context, life map overview, life plan, last check-in
- Morning: + calendar, yesterday's plan/journal, carryover priorities
- Evening: + today's plan/intention, today's captures
- Any time: + active patterns, flagged domains

##### Task 2.3: Update orb routing

In `components/ui/bottom-tab-bar.tsx`:

Replace the time-based routing:

```typescript
// BEFORE
function getOrbHref(hour: number): string {
  if (hour < 11) return '/chat?type=open_day'
  if (hour < 18) return '/home?capture=1'
  return '/chat?type=close_day'
}

// AFTER
function getOrbHref(): string {
  return '/chat?type=open_conversation'
}

function getOrbLabel(): string {
  return 'Talk to Sage'
}
```

Remove the `hour` state and `useEffect` — no longer needed for the orb.

##### Task 2.4: Session deduplication (orb resume)

In `app/(main)/chat/page.tsx`, when `requestedType === 'open_conversation'`:

Before creating a new session, check for an existing active `open_conversation` session:

```typescript
// Check for resumable open conversation (active, with user messages, within 30 min)
const { data: existingSession } = await supabase
  .from('sessions')
  .select('id, updated_at')
  .eq('user_id', userId)
  .eq('session_type', 'open_conversation')
  .eq('status', 'active')
  .order('updated_at', { ascending: false })
  .limit(1)
  .maybeSingle()

if (existingSession) {
  const lastActivity = new Date(existingSession.updated_at)
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000)
  if (lastActivity > thirtyMinAgo) {
    // Resume existing session
    resumeSessionId = existingSession.id
  }
}
```

If stale (>30 min), expire the old session and create a new one.

##### Task 2.5: LLM-generated opening message

Follow the `open_day` pattern — inject a synthetic user message so Claude generates the opening:

In `app/api/chat/route.ts`, add handling for `open_conversation`:

```typescript
if (sessionType === 'open_conversation' && messages.length === 1 && messages[0].role === 'user') {
  // Synthetic message pattern — Sage speaks first
  // The open-conversation skill file handles opening generation
}
```

In `ChatView`, auto-trigger Sage when session is created with no user messages (similar to `open_day` without briefing data).

**Gotcha (from learnings):** Don't unconditionally set `isStreaming = true` — condition it on actual state. Show a loading skeleton or the breathing orb animation while the opening generates.

##### Task 2.6: Session expiry for open conversations

Add expiry logic similar to `expireStaleOpenDaySessions()`:

```typescript
export async function expireStaleOpenConversations(
  supabase: SupabaseClient,
  userId: string,
  timezone: string
): Promise<void> {
  // Expire open_conversation sessions older than 30 minutes with no recent messages
  // Also generate summaries for expired sessions before expiring them
}
```

Call this in the session initialization flow (before creating a new session) and in `getHomeData()`.

**Acceptance criteria:**
- [ ] `skills/open-conversation.md` exists with full prompt
- [ ] Orb always opens open conversation
- [ ] Context injection includes superset of all context for open_conversation
- [ ] Tapping orb resumes recent active session (within 30 min)
- [ ] Sage generates context-aware opening message
- [ ] Stale sessions are expired
- [ ] Opening message latency is acceptable (skeleton/loading state shown)

---

#### Phase 3: Dynamic Mode Transitions

Implement `[ENTER_MODE]` detection, skill switching, and arc completion handling.

##### Task 3.1: Add `[ENTER_MODE]` signal detection

**Server-side detection** (simplest approach — no parser changes needed):

In `app/api/chat/route.ts`, post-stream handler (after the streaming completes):

```typescript
// Detect [ENTER_MODE] signal
const enterModeMatch = accumulated.match(/\[ENTER_MODE:\s*(\w+)\]/)
if (enterModeMatch) {
  const newMode = enterModeMatch[1] as SessionType
  // Validate the mode is a known structured type
  const validModes = ['open_day', 'close_day', 'weekly_checkin', 'life_mapping']
  if (validModes.includes(newMode)) {
    await supabase
      .from('sessions')
      .update({ metadata: { ...session.metadata, active_mode: newMode } })
      .eq('id', sessionId)

    // Send SSE event to client
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
      type: 'mode_change',
      active_mode: newMode
    })}\n\n`))
  }
}
```

Also add `[ENTER_MODE]` to `stripBlockTags()` in `lib/ai/sanitize.ts` for prompt injection defense.

##### Task 3.2: Override skill loading based on `active_mode`

In `lib/ai/context.ts`, `buildConversationContext()`:

```typescript
// Resolve effective session type for prompt loading
const effectiveType = sessionMetadata?.active_mode ?? sessionType

// Load skill file based on effective type
const skill = await loadSkill(effectiveType)
```

**Gotcha (from learnings):** Resolve once at request boundary. Pass `sessionMetadata` into `buildConversationContext()` from the API route. Don't re-fetch metadata inside nested functions.

The API route already loads the session — add metadata to what it passes:

```typescript
const session = await supabase.from('sessions').select('*').eq('id', sessionId).single()
const sessionMetadata = session.data?.metadata as SessionMetadata | null
const context = await buildConversationContext(sessionType, userId, {
  timezone,
  sessionMetadata,  // NEW
})
```

##### Task 3.3: Update `detectTerminalArtifact()` for active modes

In `lib/ai/completion-detection.ts`:

```typescript
export function detectTerminalArtifact(
  responseText: string,
  sessionType: SessionType,
  activeMode?: SessionType | null  // NEW
): CompletionSignal {
  const effectiveType = activeMode ?? sessionType
  // ... existing switch on effectiveType
}
```

Call site in API route:

```typescript
const signal = detectTerminalArtifact(accumulated, sessionType, sessionMetadata?.active_mode)
```

**Gotcha (from learnings):** Use `useRef` for the completion guard on the client side. The existing `sessionCompletedRef` pattern should be extended to handle the "Keep talking" scenario where completion is acknowledged but the session continues.

##### Task 3.4: Arc completion → return to open conversation

When a terminal artifact is detected within an `open_conversation` session:

**Server-side** (API route post-stream):

```typescript
if (signal !== 'none' && sessionType === 'open_conversation' && sessionMetadata?.active_mode) {
  // Record completed arc
  const completedArcs = sessionMetadata.completed_arcs ?? []
  completedArcs.push({
    type: sessionMetadata.active_mode,
    completed_at: new Date().toISOString()
  })

  // Clear active mode, store completed arc
  await supabase
    .from('sessions')
    .update({
      metadata: {
        ...sessionMetadata,
        active_mode: null,
        completed_arcs: completedArcs
      }
    })
    .eq('id', sessionId)

  // Do NOT mark session as completed — it continues
  // But DO process the artifact (file writes, day plan data, etc.)

  // Send SSE events
  controller.enqueue(encoder.encode(`data: ${JSON.stringify({
    type: 'arc_completed',
    arc_type: sessionMetadata.active_mode,
    keep_talking: true
  })}\n\n`))
}
```

**Client-side** (ChatView):

When `arc_completed` SSE event is received:
- Show the completion card (day plan card, journal card, etc.) — same as today
- Add a "Keep talking" button to the completion card
- If user taps "Keep talking": dismiss the card, reset completion state, allow continued messaging
- If user taps "Back to Home" or navigates away: expire the session normally

##### Task 3.5: Update `open-conversation.md` for post-arc state

Add a section to the skill file for "returning from arc" mode. When the system reloads the open conversation prompt after an arc completes, inject a context note:

```
[You just helped the user complete their {arc_type}. They chose to keep talking.
Don't re-greet them. Don't suggest the same flow again. Be present for whatever
they want to discuss next.]
```

This could be a small addition in `buildConversationContext()` that checks `completed_arcs` and injects a brief note.

**Acceptance criteria:**
- [x] `[ENTER_MODE: open_day]` detected server-side and stored in metadata
- [x] Next API call loads the correct skill file based on `active_mode`
- [x] Terminal artifact detection works within open_conversation sessions
- [x] Arc completion records to `completed_arcs`, clears `active_mode`
- [x] Session stays active after arc completion (not marked completed)
- [ ] "Keep talking" card variant works
- [x] Artifact processing (file writes, day plan data) works regardless of session type

---

#### Phase 4: Home Screen + History Integration

Update the home screen and history to reflect open conversation and completed arcs.

##### Task 4.1: Update home screen status checks

In `lib/supabase/home-data.ts`, `getHomeData()`:

Currently checks `session_type = 'open_day'` for `openDayCompleted`. Extend to also check `open_conversation` sessions with completed arcs:

```typescript
// Check for completed open_day — either direct or within open_conversation
const { data: openDayDirect } = await supabase
  .from('sessions')
  .select('id')
  .eq('session_type', 'open_day')
  .eq('status', 'completed')
  .gte('completed_at', todayMidnight)
  .limit(1)
  .maybeSingle()

const { data: openDayViaConversation } = await supabase
  .from('sessions')
  .select('id, metadata')
  .eq('session_type', 'open_conversation')
  .gte('updated_at', todayMidnight)
  .not('metadata', 'is', null)
  .limit(10)

const openDayCompleted = !!openDayDirect || openDayViaConversation?.some(s => {
  const meta = s.metadata as SessionMetadata
  return meta?.completed_arcs?.some(arc => arc.type === 'open_day')
}) || false
```

Same pattern for `todayClosed` (check for `close_day` arc within open_conversation).

##### Task 4.2: Update history display

In `lib/session-labels.ts`:

Add logic to derive the display label from metadata:

```typescript
export function getSessionDisplayLabel(session: Session): string {
  if (session.session_type === 'open_conversation') {
    const meta = session.metadata as SessionMetadata
    const arcs = meta?.completed_arcs ?? []
    if (arcs.length > 0) {
      // Show the primary (last) completed arc type
      const primaryArc = arcs[arcs.length - 1]
      return SESSION_LABELS[primaryArc.type] ?? 'Conversation with Sage'
    }
    return 'Conversation with Sage'
  }
  return SESSION_LABELS[session.session_type] ?? session.session_type
}
```

Update history page to use this function instead of direct `SESSION_LABELS` lookup.

##### Task 4.3: Update session header for mode transitions

In `components/chat/session-header.tsx`:

Listen for `mode_change` SSE events and update the header:

```typescript
// When active_mode changes:
// null → "Conversation with Sage"
// 'open_day' → "Morning Session · ~2 min"
// 'close_day' → "Evening Reflection · ~2 min"
```

**Acceptance criteria:**
- [x] Home screen shows "Day Plan Set" when morning flow completed via open conversation
- [x] Home screen shows "Day Logged" when evening flow completed via open conversation
- [x] History shows primary arc type for open conversation sessions with arcs
- [x] History shows "Conversation with Sage" for open conversation sessions without arcs
- [x] Session header updates when mode transitions occur

---

## Alternative Approaches Considered

1. **Single Rich Prompt (Approach A)** — One prompt with condensed arc knowledge. Simpler but lower arc quality. Rejected because structured arc quality matters — the 270-line open-day.md skill is specifically tuned.

2. **No In-Conversation Transitions (Approach C)** — Open conversation is purely open, structured flows require chips. Rejected because it doesn't deliver the spec's core promise.

3. **New session type alongside ad_hoc** — Keep ad_hoc, add open_conversation. Rejected to avoid session type proliferation.

## Acceptance Criteria

### Functional Requirements

- [x] Orb always opens open conversation (no time-based routing)
- [x] Sage generates context-aware opening message
- [x] User can "just talk" without triggering structured flows
- [x] Sage can suggest and transition into structured flows mid-conversation
- [x] `[ENTER_MODE]` signal detected and stored in metadata
- [x] Full skill files load during structured arcs
- [x] Terminal artifacts generated correctly within open conversation
- [x] "Keep talking" option after arc completion
- [x] Multiple arcs can be completed in one session
- [x] Home screen reflects arc completions from open conversation
- [x] History shows appropriate labels

### Non-Functional Requirements

- [ ] Opening message generates in < 3 seconds
- [x] Mode transition is seamless (no visible loading between turns)
- [x] No race conditions in metadata writes (use `useRef` guards)
- [x] All user data sanitized with `<user_data>` tags
- [x] Stale sessions expired properly

### Quality Gates

- [x] `npm run type-check` passes (zero `ad_hoc` references)
- [x] `npm run build` succeeds
- [x] `npm run lint` passes
- [x] All existing session flows still work (HeroCard, chips, direct URL)
- [ ] Manual test: orb → open conversation → morning flow → day plan generated → keep talking → close conversation

## Dependencies & Prerequisites

- None external. All changes are within the existing stack.
- Supabase migration must be applied before deploying code changes.

## Risk Analysis & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| `[ENTER_MODE]` hallucination by LLM | Unexpected mode switch | Validate against whitelist of known modes; prompt engineering to constrain emission |
| Completion detection race condition | Duplicate completion, lost data | Use `useRef` guards (proven pattern from prior fix) |
| Large context window for open_conversation | Token limit, cost increase | Tiered injection by time-of-day; monitor token usage |
| Session metadata write race | Wrong skill loaded on next call | Metadata write completes before SSE close; client echoes `active_mode` as hint |
| Stale sessions piling up | DB bloat, confusing History | Idle timeout (30 min) + expiry function |
| Morning/evening flow quality drops in open_conversation | Ritual erosion | Full skill files loaded during arcs (same quality); monitor completion rates |

## Institutional Learnings to Apply

These are from `docs/solutions/` — proven patterns from prior bugs in this codebase:

1. **Use `useRef` for completion guards** — `useState` creates race conditions with batched updates. See `Docs/solutions/logic-errors/2026-02-24-react-state-guard-race-condition-stale-batching.md`

2. **Never self-fetch API routes** — Use shared functions with authenticated Supabase clients. See `Docs/solutions/security-issues/2026-02-24-server-side-self-fetch-missing-auth-check.md`

3. **Resolve context once, thread explicitly** — Don't re-fetch timezone, metadata, or session state in nested functions. Resolve at the API route entry point and pass through. See `Docs/solutions/logic-errors/2026-02-21-server-side-utc-date-context-injection-bug.md`

4. **Don't gate multiple paths with one boolean** — Use explicit state enums or finite state machines. See `Docs/solutions/runtime-errors/2026-02-24-open-day-flow-isstreaming-deadlock.md`

5. **Sanitize all injected data** — Wrap in `<user_data>` tags, use `stripBlockTags()`. See `Docs/solutions/security-issues/2026-02-23-context-injection-sanitization-hardening.md`

## Edge Cases to Handle

1. **User says "morning session" at 10pm** — Sage acknowledges unusual timing but proceeds
2. **User taps "Open Day" chip while in an open conversation** — Creates a separate open_day session (parallel session). Consider abandoning the open_conversation session or warning the user.
3. **App close mid-arc, return hours later** — Session has `active_mode` set but context is stale. On resume, detect staleness and inject a note: "We were starting your morning session earlier. Want to continue or start fresh?"
4. **`[ENTER_MODE]` and terminal artifact in same response** — Process sequentially: set active_mode, then detect artifact, then clear active_mode. The arc was entered and completed in one turn.
5. **User types message before opening message finishes streaming** — Queue the user message; it will be sent after the stream completes (existing behavior).

## What's NOT in Scope

- Phase 3 (spec): Smart defaults, behavior learning, configurable time thresholds
- Analytics/ratio tracking for structured flow cannibalization
- New structured session types (monthly review, quarterly review)
- Calendar integration
- Proactive Sage nudges outside of opening messages
- TTS/voice changes

## References & Research

### Internal References

- Brainstorm: `Docs/brainstorms/2026-02-24-conversation-architecture-brainstorm.md`
- Source spec: `Docs/feedback/20260224_conversation_architecture_spec.md`
- Bottom tab bar: `components/ui/bottom-tab-bar.tsx`
- Chat page routing: `app/(main)/chat/page.tsx:83-100`
- Context builder: `lib/ai/context.ts:476+`
- Skill loader: `lib/ai/skill-loader.ts`
- Completion detection: `lib/ai/completion-detection.ts`
- Write permissions: `lib/markdown/constants.ts`
- Session labels: `lib/session-labels.ts`
- Home data: `lib/supabase/home-data.ts:88-122`
- Parser: `lib/ai/parser.ts`
- Sanitizer: `lib/ai/sanitize.ts`

### Institutional Learnings

- `Docs/solutions/logic-errors/2026-02-24-react-state-guard-race-condition-stale-batching.md`
- `Docs/solutions/security-issues/2026-02-24-server-side-self-fetch-missing-auth-check.md`
- `Docs/solutions/logic-errors/2026-02-21-server-side-utc-date-context-injection-bug.md`
- `Docs/solutions/runtime-errors/2026-02-24-open-day-flow-isstreaming-deadlock.md`
- `Docs/solutions/security-issues/2026-02-23-context-injection-sanitization-hardening.md`
