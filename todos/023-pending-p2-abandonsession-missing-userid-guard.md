---
status: pending
priority: p2
issue_id: "023"
tags: [code-review, security, supabase, sessions]
dependencies: []
---

# 023 — `abandonSession()` has no app-layer `user_id` ownership guard

## Problem Statement

`abandonSession()` in `lib/supabase/sessions.ts` filters only by `sessionId`, relying entirely on Supabase RLS for ownership enforcement. The RLS `UPDATE` policy on `sessions` enforces `auth.uid() = user_id`, so cross-user abandonment will silently no-op today. However, RLS is a single point of failure — if it is ever accidentally disabled (dashboard click, migration error, service-role key used), any session can be abandoned by ID with no application-layer resistance. Four sibling functions share the same pattern (pre-existing issue): `completeSession`, `updateDomainsExplored`, `updateSessionSummary`, and `saveMessage`.

## Findings

- **File:** `lib/supabase/sessions.ts:104–114`
- **Evidence:**
  ```ts
  supabase.from('sessions').update({ status: 'abandoned' }).eq('id', sessionId)
  // ← no .eq('user_id', userId)
  ```
- `completeSession` (line 89), `updateDomainsExplored` (line 122), `updateSessionSummary` (line 140) share the same gap
- Reported by: Security sentinel (MEDIUM)

## Proposed Solutions

### Option A — Add `.eq('user_id', userId)` to all session mutators (Recommended)

```ts
export async function abandonSession(
  supabase: SupabaseClient,
  sessionId: string,
  userId: string  // ← add param
): Promise<void> {
  const { error } = await supabase
    .from('sessions')
    .update({ status: 'abandoned' })
    .eq('id', sessionId)
    .eq('user_id', userId)  // ← defense in depth

  if (error) throw error
}
```

Thread `userId` through from `ChatView` (already available as a prop).

**Pros:** Defense-in-depth, consistent with layout.tsx query which already filters by `user.id`, eliminates single point of failure
**Cons:** Requires updating 4+ function signatures; callsites need `userId` parameter — pre-existing callers of `completeSession` etc. need updating too
**Effort:** Small-Medium
**Risk:** Low (breaking change to function signatures, but only internal callers)

### Option B — Fix only `abandonSession` in this PR, create follow-up for siblings

Fix the new function now; create a separate cleanup PR for the pre-existing sibling functions.

**Pros:** Minimal scope for this PR
**Cons:** Technical debt remains
**Effort:** Tiny
**Risk:** None

## Recommended Action

Option B for this PR — fix `abandonSession` only. Raise a separate issue for the sibling functions (`completeSession`, `updateDomainsExplored`, `updateSessionSummary`).

## Technical Details

- **Affected file:** `lib/supabase/sessions.ts` line 111
- **Callsite:** `components/chat/chat-view.tsx` line 214 — `userId` is available as a `ChatView` prop (line 150)
- **PR:** #20

## Acceptance Criteria

- [ ] `abandonSession` signature includes `userId: string`
- [ ] Query includes `.eq('user_id', userId)`
- [ ] `ChatView` callsite passes `userId` prop to `abandonSession`
- [ ] A follow-up issue exists for sibling functions

## Work Log

- 2026-02-19: Created from PR #20 code review (Security sentinel MEDIUM)
