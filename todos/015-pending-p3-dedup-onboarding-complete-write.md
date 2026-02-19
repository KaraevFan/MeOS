---
status: pending
priority: p3
issue_id: "015"
tags: [code-review, architecture, maintainability]
dependencies: []
---

# 015 — `onboarding_completed` written in two places with divergent error handling

## Problem Statement

`users.onboarding_completed = true` is written in two separate code paths in `chat-view.tsx`:
1. `line 738–741` — legacy `[LIFE_MAP_SYNTHESIS]` block handler: `await`ed
2. `line 896–901` — new `[FILE_UPDATE type="overview"]` block handler: fire-and-forget with `.catch()`

Different error-handling semantics for the same operation. If the onboarding completion logic ever needs a change (e.g., also invalidating a cache, setting a cookie, firing an analytics event), it must be updated in two places.

## Findings

- **File:** `components/chat/chat-view.tsx:738–741` and `:896–901`
- Reported by: Architecture reviewer (P3)

## Fix

```tsx
// Extract a shared helper:
async function markOnboardingComplete(supabase: SupabaseClient, userId: string) {
  await supabase.from('users').update({ onboarding_completed: true }).eq('id', userId)
}

// Replace both call sites with:
await markOnboardingComplete(supabase, userId)
```

The helper can also be expanded in the future (cookie write, analytics) without touching the call sites.

**Effort:** Small
**Risk:** Low

## Acceptance Criteria

- [ ] Single `markOnboardingComplete` helper called from both paths
- [ ] Consistent error handling (both `await` or both fire-and-forget, documented why)

## Work Log

- 2026-02-19: Created from PR #19 code review (Architecture reviewer P3)
