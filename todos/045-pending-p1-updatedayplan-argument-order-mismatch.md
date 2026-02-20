---
status: pending
priority: p1
issue_id: "045"
tags: [code-review, typescript, day-plan, data-persistence]
dependencies: []
---

# 045 — `updateDayPlan` called with wrong argument order — morning session data never persists

## Problem Statement

The `updateDayPlan` call in `chat-view.tsx:988` passes arguments in the wrong order. The function expects `(supabase, userId, date, updates)` but receives `(supabase, dayPlan.id, userId, updateData)`. This means `dayPlan.id` (a UUID) is used as `userId` and `userId` is used as `date`. The `.eq('user_id', dayPlan.id).eq('date', userId)` query will never match any row, so the update silently returns `null`. Morning session data (intention, energy level, priorities, open threads) is **never persisted to Postgres**.

Additionally, `updateData` is typed as `Record<string, unknown>` which bypasses the `Partial<Pick<DayPlan, ...>>` constraint. TypeScript cannot catch the argument mismatch because the loose type is assignable to the narrower parameter.

This was flagged by all 6 review agents. It is the single most critical bug in this feature — the Day Plan view will always show empty priorities and threads.

## Findings

- **File:** `components/chat/chat-view.tsx:979-988`
- **Evidence:**
  ```typescript
  // Line 979: loose type defeats compile-time safety
  const updateData: Record<string, unknown> = {
    morning_session_id: sessionId,
    morning_completed_at: new Date().toISOString(),
  }
  // ...
  // Line 988: arguments in wrong order
  updateDayPlan(supabase, dayPlan.id, userId, updateData)
  //                      ^^^^^^^^^  ^^^^^^
  //                      dayPlan.id passed as userId (expects userId)
  //                      userId passed as date (expects YYYY-MM-DD string)
  ```
- **Function signature** at `lib/supabase/day-plan-queries.ts:67-76`:
  ```typescript
  export async function updateDayPlan(
    supabase: SupabaseClient,
    userId: string,   // 2nd param
    date: string,     // 3rd param
    updates: Partial<Pick<DayPlan, ...>>
  )
  ```
- The `.catch(console.error)` on the fire-and-forget call means the silent no-op failure is never surfaced.

## Proposed Solutions

### Option A: Fix call site arguments + proper typing (Recommended)
- Change `Record<string, unknown>` to `Partial<Pick<DayPlan, ...>>`
- Fix call to `updateDayPlan(supabase, userId, today, updateData)` using `new Date().toLocaleDateString('en-CA')` for `today`
- **Pros:** Minimal change, fixes both the bug and type safety
- **Effort:** Small
- **Risk:** Low

### Option B: Add `updateDayPlanById` function
- Add a new function that accepts `dayPlanId` instead of `userId + date` since `getOrCreateTodayDayPlan` already returns the plan
- **Pros:** More natural API when you already have the plan object
- **Effort:** Small
- **Risk:** Low — adds one simple function

## Acceptance Criteria

- [ ] `updateDayPlan` call passes correct argument order
- [ ] `updateData` uses `Partial<Pick<DayPlan, ...>>` not `Record<string, unknown>`
- [ ] After morning session, day plan row has populated `morning_session_id`, `morning_completed_at`, `intention`, `energy_level`, `priorities`, `open_threads`
- [ ] Build passes with no type errors

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-20 | Identified by code review | All 6 agents flagged this independently |
