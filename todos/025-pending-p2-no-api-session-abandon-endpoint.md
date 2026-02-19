---
status: pending
priority: p2
issue_id: "025"
tags: [code-review, agent-native, api, sessions]
dependencies: [023]
---

# 025 — No `POST /api/session/abandon` endpoint — agent parity gap

## Problem Statement

PR #20 adds the ability to abandon a session (0-2 messages, silent discard), but this action is only accessible from the client-side UI via `abandonSession()` called directly with the browser Supabase client. There is no API endpoint that an agent can call to abandon a session programmatically. Any agent that starts a session and needs to discard it (e.g., a background agent detecting the user is unavailable, or a test agent cleaning up) has no API path. This violates the agent-native parity principle established by the existing `/api/pulse-check` and `/api/session/generate-reengagement` endpoints.

## Findings

- **File:** `components/chat/chat-view.tsx:213–216` — the only callsite for `abandonSession`
- **No route:** `app/api/session/abandon/route.ts` does not exist
- The decision tree threshold (< 3 user messages = silent discard) is encoded only in the UI
- Reported by: Agent-native reviewer (CRITICAL/MISSING), Agent-native parity principle

## Proposed Solutions

### Option A — Add `POST /api/session/abandon` (Recommended)

```ts
// app/api/session/abandon/route.ts
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { abandonSession } from '@/lib/supabase/sessions'

const Schema = z.object({ sessionId: z.string().uuid() })

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const body = await request.json()
  const { sessionId } = Schema.parse(body)

  // Verify ownership
  const { data: session } = await supabase
    .from('sessions').select('user_id').eq('id', sessionId).single()
  if (!session || session.user_id !== user.id)
    return new Response('Forbidden', { status: 403 })

  await abandonSession(supabase, sessionId, user.id)
  return new Response(JSON.stringify({ ok: true }), { status: 200 })
}
```

**Pros:** Agent-accessible, server-side ownership validation, consistent with other session API routes
**Cons:** Adds a file; requires updating `abandonSession` to accept `userId` (see #023)
**Effort:** Small
**Risk:** Low

### Option B — Defer to post-MVP agent work

The immediate user need is the UI fix. Agent parity can be added when agent capabilities are built out (Week 4-5 per Q1 roadmap).

**Pros:** Reduces scope now
**Cons:** Technical debt; every new UI capability needs a paired API endpoint eventually
**Effort:** None now
**Risk:** Low

## Recommended Action

Option A — add the endpoint. This is a small file that follows the exact pattern of existing API routes. The agent-native parity principle is non-negotiable per `CLAUDE.md` ("never trust client-side auth alone" + agent parity).

## Technical Details

- **File to create:** `app/api/session/abandon/route.ts`
- **Depends on:** #023 (userId param on abandonSession)
- **PR:** #20 or follow-up PR

## Acceptance Criteria

- [ ] `POST /api/session/abandon` returns 200 with `{ ok: true }`
- [ ] Returns 401 if unauthenticated
- [ ] Returns 403 if session does not belong to calling user
- [ ] Returns 422/400 if `sessionId` is not a valid UUID
- [ ] `abandonSession` in sessions.ts accepts `userId` and filters by it

## Work Log

- 2026-02-19: Created from PR #20 code review (Agent-native reviewer CRITICAL)
