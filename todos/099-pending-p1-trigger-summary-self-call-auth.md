---
status: pending
priority: p1
issue_id: "099"
tags: [code-review, security, architecture]
dependencies: ["098"]
---

# `triggerSummaryGeneration()` Self-Call Lacks Auth Context — Summary Generation Silently Fails

## Problem Statement

`triggerSummaryGeneration()` in `app/api/chat/route.ts` makes a server-to-server HTTP fetch to `/api/session/generate-summary` but does **not forward cookies or auth headers**. The `createClient()` in the summary endpoint reads cookies from `next/headers` — since no cookies are sent, the Supabase client is unauthenticated. RLS policies (`auth.uid() = user_id`) cause the session query to return zero rows, so summary generation **silently fails on every invocation**.

This is a catch-22: either the endpoint is unauthenticated (insecure, Finding 098) or the self-call fails (broken feature).

## Findings

- **Source**: architecture-strategist, security-sentinel, agent-native-reviewer, performance-oracle
- **Location**: `app/api/chat/route.ts` lines 207-215
- **Additional concerns**: Vercel serverless lifetime — after `controller.close()`, the function may terminate and kill the in-flight HTTP request

## Proposed Solutions

### Option A: Inline as shared function (Recommended)

Extract summary generation into a shared async function called directly from the chat route with the already-authenticated Supabase client. Eliminates the HTTP round-trip, auth propagation, and serverless lifetime issues.

```typescript
// lib/ai/generate-session-summary.ts
export async function generateSessionSummary(
  supabase: SupabaseClient, sessionId: string
): Promise<void> { /* ... */ }

// In chat/route.ts:
generateSessionSummary(supabase, sessionId).catch(() => {})
```

- **Effort**: Medium
- **Risk**: Low

### Option B: Forward cookies

Pass the cookie header from the original request to the self-call.

- **Effort**: Small
- **Risk**: Medium — still has serverless lifetime concerns

### Option C: Internal API secret

Add `X-Internal-Secret` header and validate in the summary endpoint.

- **Effort**: Small
- **Risk**: Medium — adds a secret to manage

## Acceptance Criteria

- [ ] Summary generation actually produces summaries after session completion
- [ ] Verify by completing an open_day session and checking `ai_summary` column
- [ ] No auth propagation gaps
