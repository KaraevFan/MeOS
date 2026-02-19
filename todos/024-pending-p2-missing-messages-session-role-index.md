---
status: pending
priority: p2
issue_id: "024"
tags: [code-review, performance, database, supabase]
dependencies: []
---

# 024 — Missing `idx_messages_session_role` DB index — layout JOIN degrades at scale

## Problem Statement

The new active session query in `layout.tsx` does an `INNER JOIN` between `sessions` and `messages`, filtering `messages.role = 'user'`. There is no index on `messages(session_id, role)`. The query relies on the FK index (`messages.session_id`) to find messages per session, then filters `role = 'user'` in memory. For a returning user with hundreds of messages per session, this is an O(n) scan per active session, run on **every page navigation**. The existing `idx_sessions_user_type_status_completed` on sessions partially covers the outer query but does not help with the messages JOIN.

## Findings

- **File:** `app/(main)/layout.tsx:29`
- **Query:** `supabase.from('sessions').select('id, messages!inner(id)').eq('messages.role', 'user')`
- No migration for `messages(session_id, role)` exists in any migration file
- Same JOIN pattern used in `lib/supabase/home-data.ts:88–95` (pre-existing)
- Reported by: Performance oracle (MEDIUM)

## Proposed Solutions

### Option A — Add migration for composite messages index (Recommended)

```sql
-- supabase/migrations/0XX_messages_session_role_index.sql
CREATE INDEX IF NOT EXISTS idx_messages_session_role
  ON messages(session_id, role);
```

**Pros:** One-time migration, covers all current and future queries that filter by `session_id + role`, including `home-data.ts` query (pre-existing benefit)
**Cons:** Index build time on existing data (negligible at MVP scale); adds index maintenance overhead on inserts (messages are frequent — monitor write latency)
**Effort:** Small (one migration file)
**Risk:** Low

### Option B — Restructure query to avoid JOIN

Instead of `messages!inner(id)`, query `sessions` for `status=active`, then separately check if a message with `role=user` exists for that session.

**Pros:** No schema change
**Cons:** Two queries instead of one; more complex code; same O(n) problem in the second query unless indexed
**Effort:** Small
**Risk:** Low

## Recommended Action

Option A — add the migration. This is correct-by-construction and benefits the pre-existing `home-data.ts` query as well.

## Technical Details

- **Affected query:** `app/(main)/layout.tsx:27–35`
- **Also benefits:** `lib/supabase/home-data.ts:88–95`
- **Migration to create:** `supabase/migrations/0XX_messages_session_role_index.sql`

## Acceptance Criteria

- [ ] Migration file created with `CREATE INDEX IF NOT EXISTS idx_messages_session_role ON messages(session_id, role)`
- [ ] `npx supabase db push` applied successfully
- [ ] EXPLAIN ANALYZE on the layout query shows index scan on messages (not seq scan)

## Work Log

- 2026-02-19: Created from PR #20 code review (Performance oracle MEDIUM)
