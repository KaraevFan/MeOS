---
title: "fix: Playtest 9 tool-use migration bug fixes"
type: fix
date: 2026-02-28
source: Docs/feedback/20260228_playtest_9.md
branch: feat/tool-use-foundation
---

# fix: Playtest 9 Tool-Use Migration Bug Fixes

## Overview

Playtest 9 tested the model-forward rearchitecture (`feat/tool-use-foundation`) across 4 flows: onboarding + life mapping, Open Day, Close Day, and Open Conversation. The critical path (T1.1) passed end-to-end. However, 15 bugs were found — 2 P0s, 11 P1s, and 3 P2s.

The **root cause** across most bugs is the **dual-path transition problem**: the codebase has two parallel systems for handling Claude's output — legacy text-block parsing (client-side `[FILE_UPDATE]` detection) and new tool-use API (server-side `save_file` execution). Several client-side behaviors still depend on text markers that no longer appear in tool-use responses.

**Key insight from research**: 6 of the 15 bugs cascade from just 2 root causes (P0-1 and P1-9). Fixing those 2 resolves 6 bugs total.

## Problem Statement

| Bug | Priority | Summary | Root Cause |
|-----|----------|---------|------------|
| P0-1 | P0 | `open_conversation` blocked by DB constraint | Migration 019 not pushed |
| P0-2 | P0 | No weekly check-in entry point | `CheckinDueCard` only renders when overdue |
| P1-9 | P1 | `close_day` session stuck active | Sage never calls `complete_session` tool; Phase B never fires (no user message after goodbye) |
| P1-7 | P1 | No exit button after Close Day | Downstream of P1-9 — `SessionCompleteCard` requires `sessionCompleted=true` |
| P1-11 | P1 | No Sage opening in open conversation | Downstream of P0-1 — session INSERT fails, auto-trigger skipped |
| P1-10 | P1 | Tab bar visible during open conversation | Downstream of P0-1 — `sessionId` null, `hasActiveSession` false |
| P1-4 | P1 | Synthesis loading gap | `toolCall` SSE events ignored (`continue`), no loading indicator |
| P1-5 | P1 | Raw markdown in cards | Insights panel, synthesis card, journal card don't parse markdown |
| P1-8 | P1 | Day view missing evening journal | No Postgres dual-write for close_day; no journal section in `DayPlanView` |
| P1-6 | P1 | Day tab stale after session | Server component, no revalidation on navigation |
| P1-2 | P1 | Spider chart stale ratings | `updated_rating` from tool-use not communicated to client |
| P1-3 | P1 | Storage read race condition | Client reads file before Storage write propagates |
| P2-1 | P2 | Sage response length | Prompt tuning needed |
| P2-2 | P2 | Quick reply layout change | Confirm intentional |
| P2-3 | P2 | 406 PostgREST error | Investigate |

## Dependency Chain

```
P0-1 (DB constraint) ──┬── P1-10 (tab bar) ← auto-fixed
                        └── P1-11 (opening msg) ← auto-fixed

P1-9 (close_day stuck) ──── P1-7 (exit button) ← auto-fixed

P1-8 (day view journal) ← requires P1-9 + independent component work
P1-6 (day tab stale) ← independent
P1-4 (loading gap) ← independent
P1-5 (raw markdown) ← independent
P1-2 (spider chart) ← independent
P1-3 (storage race) ← independent
P0-2 (check-in entry) ← independent (but needs P0-1 to test)
```

**"Auto-fixed" = no code change needed once parent bug is resolved.**

## Proposed Solution

### Phase 0: Unblock — Push Migration (5 min)

**Fixes: P0-1, P1-10, P1-11**

Migration `019_open_conversation.sql` already exists and correctly includes all session types (`open_conversation`, `close_day`, `open_day`, `quick_capture`). It was never pushed to the remote Supabase instance.

```bash
npx supabase db push
```

**Do NOT run ad-hoc SQL** — the feedback doc suggests raw SQL, but that would create drift between migration history and live schema.

**Verify:**
- [ ] Constraint includes all session types in Supabase dashboard
- [ ] `open_conversation` session creates successfully
- [ ] Tab bar hides on `/chat` (P1-10 auto-fixed)
- [ ] Sage opening message appears (P1-11 auto-fixed)

**Institutional learning applied:** [Postgres CHECK constraint mismatch](Docs/solutions/database-issues/2026-02-25-postgres-status-constraint-mismatch-expired-value.md) — same class of bug. TS types included the value, DB constraint didn't. Always push migrations before testing new enum values.

---

### Phase 1: Close Day Completion (30 min)

**Fixes: P1-9, P1-7**

#### Root Cause Analysis

The close_day session has a two-phase legacy completion model:
- **Phase A:** `detectTerminalArtifact()` sees `[FILE_UPDATE type="daily-log"` in response text → sets `pending_completion` metadata
- **Phase B:** On next user message, checks `isPendingCloseDay` + no new journal → completes session

**Why it fails with tool use:** Sage saves the journal via `save_file` tool, says "Enjoy your evening," and the conversation naturally ends. No user message follows, so Phase B never fires. The session stays `active` forever.

**Why life_mapping and open_day work:** Their skill files instruct Sage to call `complete_session` tool explicitly. The close_day skill does NOT.

#### Fix

Update [skills/close-day.md](skills/close-day.md) to instruct Sage to call `complete_session(type="session")` after the user confirms the journal (or after the closing message if no confirmation needed). This aligns close_day with open_day and life_mapping — all three end with an explicit `complete_session` tool call.

**Key design decision:** The close_day skill currently asks for user confirmation after the journal card ("Anything you'd change?"). Keep this — but after the user confirms (or Sage delivers the closing message), Sage must call `complete_session`. The tool definition already supports this.

```markdown
# In skills/close-day.md, add to the completion section:

After saving the journal and delivering your closing message, call `complete_session` with `type: "session"`.
Do NOT wait for another user message — the closing message IS the end of the session.
```

**P1-7 auto-fixes:** Once `complete_session` fires, `sessionCompleted` SSE event reaches the client, `SessionCompleteCard` renders with "Day logged. Sleep well." + "Back to Home" button.

**Verify:**
- [ ] `close_day` session transitions to `completed` in Postgres
- [ ] `SessionCompleteCard` renders after journal + goodbye
- [ ] "Back to Home" button navigates correctly

---

### Phase 2: Check-in Entry Point (30 min)

**Fixes: P0-2**

#### Root Cause

`CheckinDueCard` in [components/home/home-screen.tsx](components/home/home-screen.tsx) only renders when `data.checkinOverdue` is true (line 368). The user's `next_checkin_at` is March 7 — not overdue yet. There's no "due today" or "due this week" state.

#### Fix

1. **Add `checkinDue` to `HomeScreenData`** in [lib/supabase/home-data.ts](lib/supabase/home-data.ts):
   - `checkinDue: true` when `today >= next_checkin_at` (not just overdue)
   - Keep `checkinOverdue` for visual urgency styling

2. **Render `CheckinDueCard` when either `checkinDue` or `checkinOverdue`** in [components/home/home-screen.tsx](components/home/home-screen.tsx):
   ```typescript
   {(data.checkinDue || data.checkinOverdue) && data.nextCheckinDate && <CheckinDueCard />}
   ```

3. **For testing:** Add a temporary "Start check-in early" entry in `SessionChips` or similar. Can remove before beta.

**Verify:**
- [ ] Check-in CTA appears on/after `next_checkin_at` date
- [ ] Links to `/chat?type=weekly_checkin`
- [ ] Session creates with `session_type: weekly_checkin` (requires P0-1 fix)

---

### Phase 3: Loading States During Tool Execution (45 min)

**Fixes: P1-4**

#### Root Cause

In [components/chat/chat-view.tsx](components/chat/chat-view.tsx) line 644-648, `toolCall` and `roundBoundary` SSE events are received but ignored (`continue`). During tool execution (file writes, 50-500ms), no visual indicator shows. The user sees frozen text with no sign that work is happening.

#### Fix

1. **Add state for pending tool calls:**
   ```typescript
   const [pendingToolCall, setPendingToolCall] = useState<string | null>(null)
   ```

2. **Handle `toolCall` events** — set pending state:
   ```typescript
   if (parsed.toolCall) {
     setPendingToolCall(parsed.toolCall.name)
     continue
   }
   if (parsed.roundBoundary) {
     setPendingToolCall(null)
     continue
   }
   ```

3. **Clear on next text event** — first text token of next round clears the indicator.

4. **Render shimmer** — when `pendingToolCall === 'save_file'`, show `BuildingCardPlaceholder` (already exists at [components/chat/building-card-placeholder.tsx](components/chat/building-card-placeholder.tsx) but is unused).

5. **Clear in `finally` block** — ensure cleanup if stream errors.

**Verify:**
- [ ] Shimmer appears during `save_file` tool execution
- [ ] Shimmer clears when next text round begins
- [ ] Shimmer clears on stream error/completion
- [ ] No shimmer for non-save tools (e.g., `complete_session`)

---

### Phase 4: Markdown Rendering in Cards (45 min)

**Fixes: P1-5**

#### Root Cause

Three components render raw markdown text:

1. **Emerging Patterns panel** — [components/chat/life-map-pill-shelf.tsx:116](components/chat/life-map-pill-shelf.tsx) — `insightsContent` rendered as plain text in `<p>` with `whitespace-pre-line`
2. **Synthesis card narrative** — [components/chat/markdown-synthesis-card.tsx:85](components/chat/markdown-synthesis-card.tsx) — `narrative` rendered as plain `<p>` with `whitespace-pre-wrap`
3. **Journal card** — [components/chat/journal-card.tsx:55](components/chat/journal-card.tsx) — `summary` rendered as plain `<p>`

Meanwhile, `MarkdownDomainCard` and `MessageBubble` already have `renderInlineMarkdown()` that handles `**bold**` and `*italic*`.

#### Fix

1. **Extract shared utility** — move `renderInlineMarkdown()` from [components/chat/message-bubble.tsx:20-32](components/chat/message-bubble.tsx) into a shared `lib/markdown/render-inline.ts`. Extend to handle:
   - `**bold**` → `<strong>`
   - `*italic*` → `<em>`
   - `# Header` → strip or convert to styled section header
   - Bullet lists `- item` → `<li>`

2. **Apply to all three components** — replace raw `<p>` renders with `dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(escapeHtml(content)) }}`.

3. **Security:** Always `escapeHtml()` BEFORE markdown replacement (same pattern as `MarkdownDomainCard`).

**Verify:**
- [ ] Emerging patterns panel renders headings as styled sections, not raw `#`
- [ ] Synthesis card renders `**bold**` as bold
- [ ] Journal card renders inline markdown
- [ ] No XSS possible (escaped HTML)

---

### Phase 5: Day View Evening Journal (1 hour)

**Fixes: P1-8**

#### Root Cause (two independent gaps)

1. **No Postgres dual-write for close_day:** [lib/ai/tool-executor.ts](lib/ai/tool-executor.ts) only dual-writes for `fileType === 'day-plan'` (line 169). No equivalent for `fileType === 'daily-log'`.

2. **No journal section in DayPlanView:** [components/day-plan/day-plan-view.tsx](components/day-plan/day-plan-view.tsx) renders IntentionCard, CalendarCard, MorningSnapshotCard, CapturedThoughts — but no "Evening Reflection" section.

**Institutional learning applied:** [Day plan Postgres dual-write missing](Docs/solutions/logic-errors/2026-02-26-tool-executor-day-plan-storage-write-missing-postgres-dual-write.md) — exact same pattern. When migrating to tool execution, dual-write patterns must be explicitly replicated.

#### Fix

1. **Migration:** Add evening columns to `day_plans` table:
   ```sql
   ALTER TABLE day_plans
     ADD COLUMN evening_session_id uuid REFERENCES sessions(id),
     ADD COLUMN evening_completed_at timestamptz,
     ADD COLUMN evening_summary text;
   ```

2. **Dual-write in tool-executor.ts:** Add `writeJournalToPostgres()` function (parallel to `writeDayPlanToPostgres`):
   ```typescript
   if (result.success && fileType === 'daily-log') {
     await writeJournalToPostgres(attributes, context).catch((err) => {
       captureException(err, {
         tags: { tool: 'save_file', stage: 'journal_postgres_write' },
       })
     })
   }
   ```
   Writes `evening_session_id`, `evening_completed_at`, and a summary extracted from the journal content.

3. **DayPlanView component:** Add `EveningReflectionCard` section that renders when `dayPlan.evening_summary` exists. Position after CapturedThoughts.

4. **Update queries:** `getDayPlanWithCaptures` to include evening columns. Update `DayPlan` type.

5. **Regenerate types:** `npx supabase gen types typescript --local > types/database.ts`

**Verify:**
- [ ] After Close Day, `day_plans` row has `evening_session_id`, `evening_completed_at`, `evening_summary`
- [ ] Day view shows evening reflection section
- [ ] Morning-only days don't show empty evening section

---

### Phase 6: Day Tab Freshness (20 min)

**Fixes: P1-6**

#### Root Cause

[app/(main)/day/page.tsx](app/(main)/day/page.tsx) is a server component. On client-side tab navigation, Next.js may serve a cached RSC payload. After completing a session that writes to `day_plans`, the Day tab shows stale data.

#### Fix

Add `router.refresh()` on mount in the client-side `DayPlanSwipeContainer` to force server re-render on every tab visit:

```typescript
// In DayPlanSwipeContainer
useEffect(() => {
  router.refresh()
}, [router])
```

Alternatively, set `export const dynamic = 'force-dynamic'` on the Day page to prevent RSC caching entirely. The `router.refresh()` approach is more targeted.

**Verify:**
- [ ] After Open Day → tap Day tab → shows day plan immediately
- [ ] After Close Day → tap Day tab → shows evening reflection
- [ ] No flash/flicker on normal tab visits

---

### Phase 7: Spider Chart Ratings (30 min)

**Fixes: P1-2**

#### Root Cause

The spider chart reads from `pulseCheckRatings` state in `ChatView`, which is initialized from the `pulse_check_ratings` table (original onboarding snapshot). When Sage updates a domain rating via `save_file(type="domain", updated_rating=X)`, the tool executes server-side. The client has no mechanism to receive the updated rating — the `toolCall` SSE event only carries `{ id, name }`.

#### Fix

**Extend the `toolCall` SSE event** to include relevant data when available. In [app/api/chat/route.ts](app/api/chat/route.ts), after tool execution succeeds, emit domain-specific data:

```typescript
// After tool execution, if save_file for domain with updated_rating:
if (tool.name === 'save_file' && result.data?.domainUpdate) {
  encoder.encode(`data: ${JSON.stringify({ domainUpdate: result.data.domainUpdate })}\n\n`)
}
```

The tool executor returns `{ domain, updatedRating }` as part of the result data when applicable.

**Client-side:** Handle `domainUpdate` SSE events in `streamAndFinalize` to update `pulseCheckRatings` state.

**Verify:**
- [ ] Sage updates a domain rating during life mapping
- [ ] Spider chart reflects the new rating immediately (not after page refresh)
- [ ] Pulse check baseline in DB is unchanged (original snapshot preserved)

---

### Phase 8: Storage Read Race (20 min)

**Fixes: P1-3**

#### Root Cause

Server writes to Supabase Storage, client reads immediately after receiving a related event. The Storage write may not have propagated before the client reads.

#### Fix

Add retry-on-404 to Storage read calls in the client. In the `UserFileSystem` client-side read utility or in the component that reads files:

```typescript
async function readWithRetry(path: string, maxRetries = 2): Promise<string | null> {
  for (let i = 0; i <= maxRetries; i++) {
    const result = await readFile(path)
    if (result !== null) return result
    if (i < maxRetries) await new Promise(r => setTimeout(r, 300 * (i + 1)))
  }
  return null
}
```

- Max 2 retries with 300ms / 600ms delays
- Only retry on 404, not auth failures
- Bounded total wait: ~1s max

**Verify:**
- [ ] No 404 console errors after `save_file` tool calls
- [ ] Domain cards render without delay
- [ ] No infinite retry loops

---

### Phase 9: Prompt Tuning (15 min)

**Fixes: P2-1**

Add stronger length constraint to [skills/life-mapping.md](skills/life-mapping.md) exploration section:

```markdown
## Response Rules (reinforcement)

During domain exploration, keep responses to 2-3 sentences MAXIMUM. If you have a complex reframe, deliver it in one tight paragraph, not three. Only exceed this when delivering a domain synthesis or the final overview.
```

The existing "MAXIMUM 2-3 sentences" rule at line 37 is being ignored during emotionally rich exchanges. Reinforce with explicit guidance about when longer responses are permitted.

**Verify:**
- [ ] Life mapping responses during exploration stay under 4 sentences
- [ ] Synthesis/overview responses can still be longer

---

### Phase 10: Investigate & Confirm (15 min)

**P2-2:** Quick reply layout — check if horizontal pills are a CSS regression or intentional change from the tool-use branch. Compare against main branch styling.

**P2-3:** 406 PostgREST error — likely a query for `life_plans` or `life-plan/current.md` that doesn't exist yet. Confirm it's a benign "not found" by inspecting the failing request URL and filter. Add `.maybeSingle()` if using `.single()` on an optional row.

---

## Acceptance Criteria

### Must pass before merge:

- [ ] `open_conversation` session creates and functions (P0-1)
- [ ] `close_day` session completes and shows exit button (P1-9, P1-7)
- [ ] Weekly check-in entry point exists on Home (P0-2)
- [ ] Loading indicator during tool execution (P1-4)
- [ ] No raw markdown in card renders (P1-5)
- [ ] Day view shows evening journal after Close Day (P1-8)
- [ ] Day tab shows fresh data after session completion (P1-6)

### Should pass before beta:

- [ ] Spider chart updates mid-session (P1-2)
- [ ] No 404 race on Storage reads (P1-3)
- [ ] Sage response length within spec (P2-1)

## Technical Considerations

### Files Modified

| File | Changes |
|------|---------|
| `skills/close-day.md` | Add `complete_session` instruction |
| `skills/life-mapping.md` | Reinforce response length |
| `components/chat/chat-view.tsx` | Handle `toolCall`/`domainUpdate` SSE events, show shimmer |
| `components/chat/life-map-pill-shelf.tsx` | Use inline markdown renderer |
| `components/chat/markdown-synthesis-card.tsx` | Use inline markdown renderer |
| `components/chat/journal-card.tsx` | Use inline markdown renderer |
| `components/chat/message-bubble.tsx` | Extract `renderInlineMarkdown` to shared util |
| `lib/markdown/render-inline.ts` | **NEW** — shared inline markdown renderer |
| `lib/ai/tool-executor.ts` | Add `daily-log` dual-write, emit `domainUpdate` data |
| `app/api/chat/route.ts` | Emit `domainUpdate` SSE event |
| `lib/supabase/home-data.ts` | Add `checkinDue` boolean |
| `components/home/home-screen.tsx` | Render check-in CTA when due |
| `components/day-plan/day-plan-view.tsx` | Add evening reflection section |
| `components/day-plan/day-plan-swipe-container.tsx` | Add `router.refresh()` on mount |
| `supabase/migrations/02X_day_plan_evening.sql` | **NEW** — evening columns |
| `types/day-plan.ts` | Update `DayPlan` type |
| `types/database.ts` | Regenerate from schema |

### Institutional Learnings Applied

1. **[CHECK constraint mismatch](Docs/solutions/database-issues/2026-02-25-postgres-status-constraint-mismatch-expired-value.md):** Always push migrations before testing new enum values. Never run ad-hoc SQL that drifts from migration history.

2. **[Day plan dual-write missing](Docs/solutions/logic-errors/2026-02-26-tool-executor-day-plan-storage-write-missing-postgres-dual-write.md):** When migrating to tool execution, dual-write patterns must be explicitly replicated. Same pattern applies to evening journal.

3. **[React state race condition](Docs/solutions/logic-errors/2026-02-24-react-state-guard-race-condition-stale-batching.md):** Use `useRef` for synchronous guards alongside React state. Ensure new completion paths for close_day follow this pattern.

## Implementation Order

```
Phase 0: Push migration 019                    [5 min]  → unblocks P0-1, P1-10, P1-11
Phase 1: Close Day completion                   [30 min] → fixes P1-9, P1-7
Phase 2: Check-in entry point                   [30 min] → fixes P0-2
Phase 3: Loading states                         [45 min] → fixes P1-4
Phase 4: Markdown rendering                     [45 min] → fixes P1-5
Phase 5: Day view evening journal               [1 hr]   → fixes P1-8
Phase 6: Day tab freshness                      [20 min] → fixes P1-6
Phase 7: Spider chart ratings                   [30 min] → fixes P1-2
Phase 8: Storage read race                      [20 min] → fixes P1-3
Phase 9: Prompt tuning                          [15 min] → fixes P2-1
Phase 10: Investigate P2s                       [15 min] → P2-2, P2-3
```

**Total estimated independent fixes: 8** (6 bugs auto-resolve from cascading dependencies)

## References

- Playtest feedback: [Docs/feedback/20260228_playtest_9.md](Docs/feedback/20260228_playtest_9.md)
- Test plan: [Docs/plans/2026-02-26-test-model-forward-rearchitecture-plan.md](Docs/plans/2026-02-26-test-model-forward-rearchitecture-plan.md)
- Related solution (constraint): [Docs/solutions/database-issues/2026-02-25-postgres-status-constraint-mismatch-expired-value.md](Docs/solutions/database-issues/2026-02-25-postgres-status-constraint-mismatch-expired-value.md)
- Related solution (dual-write): [Docs/solutions/logic-errors/2026-02-26-tool-executor-day-plan-storage-write-missing-postgres-dual-write.md](Docs/solutions/logic-errors/2026-02-26-tool-executor-day-plan-storage-write-missing-postgres-dual-write.md)
- Related solution (race condition): [Docs/solutions/logic-errors/2026-02-24-react-state-guard-race-condition-stale-batching.md](Docs/solutions/logic-errors/2026-02-24-react-state-guard-race-condition-stale-batching.md)
