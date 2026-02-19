---
status: pending
priority: p2
issue_id: "010"
tags: [code-review, security, prompt-injection, ai]
dependencies: []
---

# 010 — Stored prompt injection: markdown file content injected unsanitized into system prompt

## Problem Statement

`fetchAndInjectFileContext` in `lib/ai/context.ts` reads markdown files the user influences (via Sage's FILE_UPDATE writes) and injects them verbatim into Claude's system prompt. A user who crafts messages to steer Sage to embed adversarial instructions into `sage/context.md` or `life-map/_overview.md` can have those instructions re-injected verbatim into the system prompt on subsequent sessions. This is a stored prompt injection vector.

The `captures` content is sanitized against block tags, but `sageContext`, `overview`, `lifePlan`, and `checkIn` content is not wrapped in any data boundary.

Note: `onboarding_name` (from session metadata) is also injected unsanitized and should be addressed at the same time (see `app/api/chat/route.ts` — `buildPulseContext`).

## Findings

- **File:** `lib/ai/context.ts` — sageContext, overview, lifePlan, checkIns injections
- **File:** `app/api/chat/route.ts` — `ad_hoc_context` injection (lines ~287); `onboarding_name` injection
- Evidence: user content is appended as raw strings to `systemPrompt`
- Reported by: Security reviewer (P2 findings 4, 5, 6)
- Cross-reference: Learnings researcher flagged this same pattern from `docs/solutions/security-issues/markdown-storage-security-review-fixes.md`

## Proposed Solutions

### Option A — XML data-fencing (Recommended, Anthropic best practice)

Wrap all user-influenced content in XML tags so Claude treats it as data, not instruction:

```typescript
// lib/ai/context.ts
parts.push('\nSAGE WORKING MODEL:')
parts.push('<user_data>')
parts.push(sageContext.value.content)
parts.push('</user_data>')

// Similar for overview, lifePlan, checkIns

// app/api/chat/route.ts — ad_hoc_context:
systemPrompt += `\n\n<session_context>\n${meta.ad_hoc_context.slice(0, 2000)}\n</session_context>`

// onboarding_name — sanitize + cap:
const safeName = onboarding.name.slice(0, 50).replace(/[^\p{L}\p{N} '\-]/gu, '')
contextParts.push(`The user's name is ${safeName}. Greet them by name.`)
```

**Pros:** Anthropic's recommended approach; low effort; Claude is trained to respect XML-fenced data as data
**Cons:** Slight prompt length increase
**Effort:** Small
**Risk:** Low (additive change, doesn't break existing behavior)

## Recommended Action

Option A — XML fence all user-influenced content sections.

## Technical Details

- **Affected files:**
  - `lib/ai/context.ts`
  - `app/api/chat/route.ts` (`ad_hoc_context` and `onboarding_name` sections)

## Acceptance Criteria

- [ ] `sageContext`, `overview`, `lifePlan`, `checkIns` wrapped in `<user_data>` tags in `context.ts`
- [ ] `ad_hoc_context` wrapped in `<session_context>` tags in `route.ts`
- [ ] `onboarding_name` sanitized with length cap + character filter
- [ ] Existing Sage behavior unchanged (verified by manual test)

## Work Log

- 2026-02-19: Created from PR #19 code review (Security reviewer P2 findings 4, 5, 6)
