---
status: pending
priority: p1
issue_id: "098"
tags: [code-review, security, authentication]
dependencies: []
---

# Unauthenticated `/api/session/generate-summary` Endpoint

## Problem Statement

The new `/api/session/generate-summary` endpoint has **no authentication check**. Every other API route in the codebase calls `supabase.auth.getUser()` and returns 401 if unauthenticated. This endpoint skips that entirely, creating an open API that can trigger Claude API calls and write to any session's summary fields.

## Findings

- **Source**: security-sentinel, kieran-typescript-reviewer, architecture-strategist, agent-native-reviewer, performance-oracle (all 5 reviewers flagged this)
- **Location**: `app/api/session/generate-summary/route.ts` lines 34-48
- **Known Pattern**: The project's own security docs (`docs/solutions/react-hooks/supabase-client-in-usecallback-deps.md`) warn: "RLS is a single point of failure"
- **OWASP**: A07:2021 Broken Authentication

## Proposed Solutions

### Option A: Add standard auth pattern (Recommended)

Add `supabase.auth.getUser()` check and `.eq('user_id', user.id)` on session queries:

```typescript
const { data: { user } } = await supabase.auth.getUser()
if (!user) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
}
// Add to session query:
.eq('user_id', user.id)
```

- **Effort**: Small
- **Risk**: Low — but requires fixing Finding 099 (self-call auth) simultaneously

### Option B: Eliminate endpoint, use shared function

Extract summary generation into `lib/ai/generate-session-summary.ts` called directly from the chat route with the already-authenticated Supabase client. Remove the standalone endpoint entirely.

- **Effort**: Medium
- **Risk**: Low — cleaner architecture, eliminates auth propagation problem

## Acceptance Criteria

- [ ] Endpoint returns 401 for unauthenticated requests
- [ ] Session queries filter by `user_id`
- [ ] Summary generation still works end-to-end after auth is added
