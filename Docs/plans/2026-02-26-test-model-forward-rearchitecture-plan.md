---
title: "Test Plan: Model-Forward Rearchitecture"
type: test
date: 2026-02-26
branch: feat/tool-use-foundation
---

# Test Plan: Model-Forward Rearchitecture

## Overview

This test plan covers the server-side architecture migration from regex-parsed text blocks (`[FILE_UPDATE]`, `[DAY_PLAN_DATA]`, `[SUGGESTED_REPLIES]`, `[ENTER_MODE]`) to Claude's native tool use API. The migration touches the core conversation loop — every session type is affected.

**Changed files (11):**

| File | What changed |
|------|-------------|
| `app/api/chat/route.ts` | Agentic loop, SSE events, tool execution, lifecycle tracking |
| `lib/ai/tool-definitions.ts` | 5 tool schemas (`save_file`, `complete_session`, `enter_structured_arc`, `show_pulse_check`, `show_options`) |
| `lib/ai/tool-executor.ts` | Server-side tool execution, permission checks, day plan Postgres dual write |
| `lib/ai/context.ts` | Removed legacy format instructions, added `TOOL_USE_GUIDANCE` |
| `lib/supabase/sessions.ts` | `completeSession` accepts optional `userId` for defense-in-depth |
| `skills/open-day.md` | Rewritten: removed rigid script, references `save_file` + `show_options` tools |
| `skills/close-day.md` | Rewritten: removed `[FILE_UPDATE]` instructions, references `save_file` tool |
| `skills/open-conversation.md` | Rewritten: removed `[ENTER_MODE]`/`[SUGGESTED_REPLIES]`, references tools |
| `skills/life-mapping.md` | New skill file (was inline in prompts.ts) |
| `skills/weekly-checkin.md` | New skill file (was inline in prompts.ts) |
| `Docs/STEERING.md` | Updated roadmap |

## Pre-Test Setup

```bash
# 1. Confirm branch is clean and builds
git checkout feat/tool-use-foundation
npm run build          # Must succeed
npm run type-check     # Must pass (currently clean)
npm run test           # Must pass (currently 159/159)

# 2. Start dev server
npm run dev

# 3. Open browser to localhost:3000
# 4. Sign in with test account
```

**Environment notes:**
- Test against local Supabase or dev environment (not production)
- Have Supabase Studio open to inspect `sessions`, `day_plans`, `messages` tables
- Have browser DevTools Network tab open to inspect SSE events

---

## Test Suite 1: Onboarding + Life Mapping (Critical Path)

**Why critical:** This is the first-run experience. Onboarding creates a `life_mapping` session, redirects to chat, and Sage builds the entire life map from scratch using `save_file` tool calls. If this breaks, no new user can complete setup.

**Flow:** Onboarding screens (name → intent → mini-conversation → pulse check ratings) → creates `life_mapping` session → redirects to `/chat` → Sage conducts life mapping conversation → saves domain files, overview, life plan, sage context → session completes → user lands on home.

### T1.1 — Full new-user onboarding → life mapping → home

**Steps:**
1. Create a fresh test account (or clear `onboarding_completed` flag)
2. Walk through onboarding screens: name, intent, quick replies, domain ratings
3. Tap "Start" on summary screen → redirected to `/chat`
4. Sage should open with a welcome referencing pulse check data
5. Walk through 2-3 domain explorations (follow Sage's lead)
6. Sage should call `save_file(type="domain")` after each domain
7. Sage synthesizes → saves overview + life plan + sage context
8. Sage calls `complete_session`

**Verify:**
- [ ] Onboarding screens work (not affected by backend changes — but confirm redirect works)
- [ ] `sessions` table: `life_mapping` session created with `status: 'active'` and metadata containing `onboarding_intent`, `onboarding_name`
- [ ] Sage acknowledges pulse check data in opening message
- [ ] Sage explores domains naturally (not a rigid script)
- [ ] **Supabase Storage — domain files:** `users/{uid}/life-map/{domain}.md` files created for explored domains (e.g., `career.md`, `health.md`)
- [ ] Domain files have frontmatter with `status`, `updated_rating`, `preview_line`
- [ ] **Supabase Storage — overview:** `users/{uid}/life-map/_overview.md` created with north star (with "because" clause), priorities, tensions, boundaries
- [ ] **Supabase Storage — life plan:** `users/{uid}/life-plan/current.md` created with quarter theme, commitment `###` headings, next steps
- [ ] **Supabase Storage — sage context:** `users/{uid}/sage/context.md` created
- [ ] SSE events: multiple `toolCall` + `roundBoundary` events (multi-round agentic loop)
- [ ] `sessionCompleted` SSE event fires
- [ ] Session status → `completed` in Postgres
- [ ] **Home page:** Shows life map summary, domain cards with correct statuses
- [ ] **Life Map page:** All explored domains appear with content, overview visible
- [ ] `users.onboarding_completed` is `true`

### T1.2 — Onboarding with only 2 domains explored

**Steps:**
1. During life mapping, after Sage explores 2 domains, say "I think that's enough for today"

**Verify:**
- [ ] Sage respects the user's pace
- [ ] Still generates overview + life plan from available data
- [ ] Unexplored domains are not fabricated
- [ ] Session completes cleanly

### T1.3 — Life mapping agentic loop depth

**Why test:** Life mapping is the longest session type (15-30 min). It calls `save_file` many times (2-4 domain files + overview + life plan + sage context = 5-8 tool calls). This exercises the agentic loop more deeply than any other session.

**Verify:**
- [ ] Agentic loop handles 5+ tool calls across multiple iterations without hitting rate limit (limit is 15)
- [ ] Wall-clock timeout (55s) is NOT hit for normal responses (each iteration should be well under)
- [ ] Token truncation works correctly — Claude sees `[saved: N chars]` for previous saves, not full content
- [ ] Claude has enough context to write coherent overview/life plan that references earlier domain explorations

### T1.4 — Returning user life mapping (non-onboarding)

**Steps:**
1. As an existing user, start a Life Mapping session from the conversation type picker

**Verify:**
- [ ] Works the same as onboarding path (same skill, same tools)
- [ ] Sage has access to existing life map data in context
- [ ] Updates existing domain files rather than creating from scratch

---

## Test Suite 2: Open Day Session

**Why critical:** Most structured session type. Exercises `save_file(day-plan)`, Postgres dual write, `complete_session`, and the full agentic loop.

### T2.1 — Happy path: Complete morning session

**Steps:**
1. Navigate to Chat, start new "Open the Day" session
2. Sage should greet with a mood question
3. Respond with a mood (e.g., "Feeling good today")
4. Sage should ask about intention
5. Provide an intention (e.g., "Ship the rearchitecture PR")
6. Sage should save the day plan and close the session

**Verify:**
- [ ] Sage's messages are concise (2-3 sentences per turn)
- [ ] Session completes without errors (no red error banners)
- [ ] Check SSE events in Network tab: expect `toolCall`, `roundBoundary`, `sessionCompleted` events
- [ ] **Supabase Storage:** `users/{uid}/day-plans/{today}.md` file exists with intention in body
- [ ] **Postgres `day_plans`:** Row exists for today with `intention`, `energy_level`, `morning_session_id`, `morning_completed_at` populated
- [ ] **Postgres `sessions`:** Session status is `completed`
- [ ] Day Plan page shows the intention (not "No plan for this day")
- [ ] Home page reflects the session was completed

### T2.2 — Open day with low/rough mood

**Steps:**
1. Start new Open Day session
2. Respond with "Rough" or "Low energy today"
3. Follow through to day plan save

**Verify:**
- [ ] Sage adapts tone (gentler framing per skill instructions)
- [ ] Day plan still saves with the expressed energy level
- [ ] Postgres `energy_level` field matches what was expressed

### T2.3 — User declines to plan

**Steps:**
1. Start new Open Day session
2. When asked about the day, respond: "I don't want to plan today"

**Verify:**
- [ ] Sage respects the decline ("No problem")
- [ ] No day plan artifact is saved
- [ ] Session completes gracefully

### T2.4 — Mid-day open day

**Steps:**
1. Start Open Day after noon

**Verify:**
- [ ] Sage adjusts framing ("Still got some day left")
- [ ] Session otherwise works normally

---

## Test Suite 3: Close Day Session

### T3.1 — Happy path: Evening reflection

**Steps:**
1. Navigate to Chat, start new "Close the Day" session
2. Sage asks about the day (should reference real context if available)
3. Respond with a brief reflection
4. Sage pulls one thread, then offers to wrap
5. Confirm wrapping up

**Verify:**
- [ ] Sage uses `save_file(type="daily-log")` — check SSE for `toolCall` event
- [ ] **Supabase Storage:** `users/{uid}/daily-logs/{today}.md` exists
- [ ] Daily log has first-person synthesis (not bullet points)
- [ ] Frontmatter attributes: `energy`, `mood_signal`, `domains_touched`
- [ ] After save, Sage asks for confirmation, then calls `complete_session`
- [ ] **Captures folding:** If there were captures today, they should be marked as folded
- [ ] Session status is `completed` in Postgres

### T3.2 — Brief "it was fine" close

**Steps:**
1. Start Close Day
2. Respond minimally: "It was fine, nothing special"

**Verify:**
- [ ] Sage doesn't push for depth
- [ ] Still produces a (brief) daily log
- [ ] Completes in 2-3 exchanges

---

## Test Suite 4: Open Conversation

### T4.1 — Basic conversation

**Steps:**
1. Start Open Conversation session
2. Chat casually for 3-4 exchanges

**Verify:**
- [ ] Opening message is context-aware (references day plan/domain/etc. if available)
- [ ] Sage follows 2-3 sentence rule
- [ ] No artifacts forced on casual chat

### T4.2 — Structured arc transition (open_day)

**Steps:**
1. Start Open Conversation in the morning
2. Say "Let's do my morning session"
3. Sage should use `enter_structured_arc(arc_type="open_day")`

**Verify:**
- [ ] SSE event `modeChange` emitted with `open_day`
- [ ] **Postgres `sessions.metadata`:** `active_mode: "open_day"`
- [ ] Sage switches to Open Day behavior (grounding, intention-setting)
- [ ] After arc completes, SSE event `arcCompleted` emitted
- [ ] Sage returns to open conversation mode ("Nice — day plan's set. Anything else?")
- [ ] `sessions.metadata.completed_arcs` array includes the arc

### T4.3 — Structured arc transition (close_day)

**Steps:**
1. Start Open Conversation in the evening
2. Say "Let's reflect on today"
3. Walk through Close Day flow

**Verify:**
- [ ] Same lifecycle as T4.2 but with `close_day` arc type
- [ ] Daily log saved, captures folded
- [ ] Returns to open conversation after

### T4.4 — Domain exploration from Life Map

**Steps:**
1. Navigate to Life Map
2. Tap "Talk to Sage about this" on a domain
3. Have a conversation about the domain

**Verify:**
- [ ] Sage references the specific domain data
- [ ] After conversation, saves domain file via `save_file(type="domain")`
- [ ] Domain card on Life Map reflects updated content

---

## Test Suite 5: Weekly Check-in

### T5.1 — Weekly check-in flow

**Steps:**
1. Start Weekly Check-in session
2. Walk through reflections

**Verify:**
- [ ] Sage references commitments from `life-plan/current.md`
- [ ] `save_file` called for check-in file
- [ ] `show_pulse_check` tool available (stub — client continues past it)
- [ ] Write permissions: `check-ins/*`, `life-plan/current.md`, `life-map/*`, `sage/*`
- [ ] Session completes

---

## Test Suite 6: Agentic Loop Mechanics

### T6.1 — Multi-round tool use

**Verify during any session that saves artifacts:**
- [ ] Claude calls `save_file`, receives result, then calls `complete_session` in a later round
- [ ] SSE events show `toolCall` → `roundBoundary` → `toolCall` pattern
- [ ] `loopMessages` accumulates correctly (no duplicate messages)

### T6.2 — Max iterations guard

**Verify (inspect route.ts logs):**
- [ ] Agentic loop exits after MAX_TOOL_ITERATIONS (5) if Claude keeps calling tools
- [ ] User sees final text, not an error

### T6.3 — Wall-clock timeout

**Verify:**
- [ ] If a response takes >55s, the loop breaks with a graceful message
- [ ] No Vercel 500 timeout error

### T6.4 — Tool rate limiting

**Verify (code review / edge case):**
- [ ] If Claude calls >15 tools in one request, rate limit error is returned
- [ ] Claude receives the error and produces text instead

### T6.5 — Consecutive failure circuit breaker

**Verify:**
- [ ] If 2 consecutive tool iterations ALL error, the loop breaks with an error message

---

## Test Suite 7: Permission Enforcement

### T7.1 — Cross-session write denial

**Verify by inspection (or force via Supabase function editor):**
- [ ] `close_day` session cannot write to `life-map/` paths
- [ ] `open_day` session cannot write to `check-ins/` paths
- [ ] `weekly_checkin` cannot write to `day-plans/` paths
- [ ] Error message is clear: "Write to X not permitted during Y session"

### T7.2 — File validation

**Verify:**
- [ ] Path traversal blocked: `file_name` containing `..` or `/` is rejected
- [ ] Invalid `file_type` is rejected with clear error
- [ ] Content >100KB is rejected
- [ ] Empty content is rejected

---

## Test Suite 8: SSE Protocol

### T8.1 — Event stream structure

**Open Network tab → filter SSE events:**
- [ ] `text` events stream token-by-token (partial content)
- [ ] `toolCall` events include `{ id, name }` for each tool
- [ ] `roundBoundary` events mark iteration boundaries
- [ ] `sessionCompleted` fires exactly once on session end
- [ ] `modeChange` fires when entering an arc
- [ ] `arcCompleted` fires when completing an arc

### T8.2 — Split-conversation stubs

**Verify:**
- [ ] If Claude calls `show_pulse_check`, SSE emits `showPulseCheck` event
- [ ] If Claude calls `show_options`, SSE emits `showOptions` event
- [ ] Client `continue`s past these without error (no conversation death)
- [ ] Loop breaks after split-conversation tool (by design)

---

## Test Suite 9: Legacy Coexistence

### T9.1 — Legacy `[FILE_UPDATE]` fallback

**Verify:**
- [ ] If Claude somehow outputs `[FILE_UPDATE]` text (unlikely but possible), the legacy parser still catches it
- [ ] The `!enteredArcViaTool` guard prevents double-processing

### T9.2 — Legacy `[ENTER_MODE]` fallback

**Verify:**
- [ ] Legacy `detectTerminalArtifact` still runs when no tool lifecycle events occurred
- [ ] Does NOT run when tools handled the lifecycle (guard: `!completedViaToolSession && !completedViaToolArc && !enteredArcViaTool`)

---

## Test Suite 10: Data Integrity

### T10.1 — Day plan Postgres dual write

**After completing an Open Day session:**
- [ ] `day_plans` row: `date` = today, `intention` matches what user said, `energy_level` valid enum value
- [ ] `morning_session_id` points to the session that just completed
- [ ] `morning_completed_at` is recent timestamp
- [ ] Supabase Storage markdown file content is consistent with Postgres fields

### T10.2 — Session metadata consistency

**After arc transitions:**
- [ ] `sessions.metadata.active_mode` is set when entering an arc
- [ ] `sessions.metadata.active_mode` is null after completing an arc
- [ ] `sessions.metadata.completed_arcs` array tracks all completed arcs

### T10.3 — Session completion idempotency

**Verify:**
- [ ] Calling `complete_session` on an already-completed session returns error (not crash)
- [ ] Error message: "Session is completed. Cannot complete."

---

## Test Suite 11: Token Management

### T11.1 — Tool result truncation

**Verify in SSE / route.ts behavior:**
- [ ] `save_file` content is truncated to `[saved: N chars]` before being re-sent to Claude
- [ ] All tool results are truncated to `{ success: true/false }` in re-sent messages
- [ ] Claude still has enough context to proceed (calls `complete_session` after truncated save)

### T11.2 — Dynamic max_tokens

**Verify:**
- [ ] First iteration: `max_tokens: 4096`
- [ ] Subsequent iterations: `max_tokens: 2048` (saves token budget for multi-round)

---

## Automated Test Checklist

```bash
# Type-check
npx tsc --noEmit                    # ✅ Must pass

# Unit/integration tests
npm run test                         # ✅ 159/159 must pass

# Skill-tool coupling
npx vitest run lib/ai/skill-tool-coupling.test.ts  # ✅ Validates skill frontmatter tools

# Lint
npm run lint                         # ✅ Must pass
```

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Claude ignores tools and outputs `[FILE_UPDATE]` text | Medium | Legacy parser still active as fallback |
| Agentic loop runs 5 iterations without completing | Low | Wall-clock timeout + max iterations guard |
| Postgres dual write fails silently | Low | Sentry monitoring + non-fatal catch |
| Split-conversation tools cause conversation death | Medium | Currently stubs — client `continue`s past them |
| Permissions too restrictive (blocking legitimate writes) | Low | `SESSION_WRITE_PERMISSIONS` whitelist is already defined |
| Token budget exceeded on long conversations | Medium | Truncation + dynamic max_tokens |

---

## Test Priority

**Tier 1 — Must pass before merge (blocks new users + daily usage):**

1. **T1.1** — Full onboarding → life mapping (new user critical path — if this breaks, nobody can sign up)
2. **T2.1** — Open Day happy path (daily usage — save_file + Postgres dual write + complete_session)
3. **T3.1** — Close Day happy path (daily usage — daily-log + captures folding)

**Tier 2 — High confidence (exercises key new mechanics):**

4. **T4.2** — Arc transition in open conversation (enter_structured_arc + mode change)
5. **T8.1** — SSE event stream (verify client receives correct events)
6. **T10.1** — Day plan data integrity check
7. **T1.3** — Life mapping agentic loop depth (multi-round tool calls)

**Tier 3 — Coverage (lower risk but worth verifying):**

8. T6.1 — Multi-round tool use verification
9. T7.1 — Permission enforcement spot check
10. T4.1 — Basic open conversation
11. T5.1 — Weekly check-in
12. T9.1 / T9.2 — Legacy fallback verification
