---
status: pending
priority: p3
issue_id: "016"
tags: [code-review, security, infrastructure, performance]
dependencies: []
---

# 016 — In-memory rate limiter ineffective on Vercel serverless (resets on cold starts)

## Problem Statement

The `rateLimitMap` in `app/api/chat/route.ts` is a module-level `Map`. On Vercel's serverless runtime, each function invocation may spin up a new process/isolate — the map resets on cold starts and is not shared across concurrent instances. A determined user can exceed 20 requests/minute by hitting the API shortly after deployment or from multiple regions.

## Findings

- **File:** `app/api/chat/route.ts:15–33`
- ```ts
  const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
  ```
- Pre-existing issue, not introduced in this PR
- Reported by: Security reviewer (P3-7)

## Proposed Solutions

### Option A — Upstash Redis rate limiter (Recommended for Vercel)

```ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(20, '60 s'),
})

// In handler:
const { success } = await ratelimit.limit(userId)
if (!success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
```

**Pros:** Works across serverless instances; Upstash has a free tier
**Cons:** Adds external dependency; requires Upstash account setup
**Effort:** Small
**Risk:** Low

### Option B — Supabase-backed rate limit

Store request counts in a `rate_limits` table with RLS.

**Pros:** No additional service
**Cons:** DB round-trip adds latency to every chat request
**Effort:** Medium

## Recommended Action

Option A for production, or temporarily add a warning comment noting the current limiter is development-only.

## Technical Details

- **Affected file:** `app/api/chat/route.ts:15–33`

## Acceptance Criteria

- [ ] Rate limiter works across serverless instances
- [ ] OR: comment explicitly noting development-only limitation

## Work Log

- 2026-02-19: Created from PR #19 code review (Security reviewer P3-7)
