---
status: complete
priority: p1
issue_id: "065"
tags: [code-review, security, prompt-injection, ambient-card]
dependencies: []
---

# 065 — URL `prompt` parameter flows unsanitized into AI system prompt

## Problem Statement

The ambient card reflection flow passes the prompt text as a raw URL parameter (`/chat?mode=reflection&prompt=<text>`). The server reads this value with zero validation and stores it in `sessions.metadata.ad_hoc_context`, which is later injected into the Claude system prompt. While the current ambient card only passes hardcoded prompts, the URL is an open interface — a crafted link could inject attacker-controlled text into a user's AI system prompt.

**Existing mitigations that limit severity:** XML `<user_data>` fence in the API route, `slice(0, 2000)` cap, RLS, auth required. But the injection vector should be closed at the source.

**Source:** Security sentinel review, architecture strategist review.

## Findings

- `app/(main)/chat/page.tsx:120` — `nudgeContext = params.prompt` with no validation
- `components/chat/chat-view.tsx:398` — interpolated into template string for `ad_hoc_context`
- `app/api/chat/route.ts:292` — stored metadata injected into system prompt
- Related to existing todo `010-pending-p2-stored-prompt-injection-xml-fence`

## Proposed Solutions

### Option A: Allowlist validation (Recommended)

Extract `REFLECTIVE_PROMPTS` to a shared module, validate `params.prompt` against the list server-side.

```typescript
import { REFLECTIVE_PROMPTS } from '@/lib/constants/reflective-prompts'

if (params.mode === 'reflection' && params.prompt && sessionType === 'ad_hoc') {
  if (REFLECTIVE_PROMPTS.includes(params.prompt)) {
    nudgeContext = params.prompt
  }
}
```

**Pros:** Eliminates the open parameter entirely. Simple. **Cons:** Requires extracting the array. **Effort:** Small. **Risk:** Low.

### Option B: Pass index instead of text

Navigate to `/chat?mode=reflection&promptIndex=3`, look up the prompt server-side by index.

**Pros:** No text in URL at all. **Cons:** Brittle if array order changes. **Effort:** Small. **Risk:** Low.

## Acceptance Criteria

- [ ] Non-allowlisted prompt values are silently ignored (no error, falls through to generic ad_hoc)
- [ ] Hardcoded reflection prompts continue to work when tapped from ambient card
- [ ] `REFLECTIVE_PROMPTS` array is importable by both `ambient-card.tsx` and `chat/page.tsx`

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-21 | Identified during security review | URL params flowing into system prompts need allowlist validation |

## Resources

- PR: `fix/r5a-p1-p2-playtest-fixes`
- Related: `todos/010-pending-p2-stored-prompt-injection-xml-fence.md`
