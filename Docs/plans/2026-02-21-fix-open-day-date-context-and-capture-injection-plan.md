---
title: "fix: Open the Day date context, capture injection, and briefing handoff"
type: fix
date: 2026-02-21
brainstorm: Docs/brainstorms/2026-02-21-open-day-date-context-bug-brainstorm.md
---

# fix: Open the Day date context, capture injection, and briefing handoff

## Overview

The Open the Day morning ritual asks close-day-style questions ("How did today actually land for you?") and confuses yesterday's captures with today's. Three root causes contribute: no date in the system prompt, missing capture injection for open_day, and a user-message handoff from the briefing card that derails the 5-step flow.

## Problem Statement

On 2/21, user opens "Open the Day" on the morning after skipping close_day. Sage says: "You dropped a couple thoughts earlier — one about finishing a sketching video, another about contact lenses. Sounds like you were deep in something creative today. How did today actually land for you?" This is close-day language in a morning session, referencing yesterday's captures as "today."

**Root causes:**
1. System prompt has no explicit date — Claude must infer from context labels
2. Open_day context doesn't inject yesterday's captures (close_day does inject today's captures)
3. Briefing card sends `"Let's open the day"` as a user message, breaking the 5-step flow handoff

## Proposed Solution

Three focused changes to existing files, following established patterns already in the codebase.

### Change 1: Inject today's date into system prompt

**File:** `lib/ai/context.ts` — `fetchAndInjectFileContext()`

Add today's date and day-of-week at the top of the context block, immediately after the `=== USER'S LIFE CONTEXT ===` header. Applies to ALL session types (universal temporal grounding).

```typescript
// After line 27: const parts: string[] = ["=== USER'S LIFE CONTEXT ==="]
const today = new Date()
const todayStr = today.toLocaleDateString('en-CA')
const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' })
parts.push(`\nTODAY: ${dayOfWeek}, ${todayStr}`)
```

This gives Claude explicit date awareness: `TODAY: Friday, 2026-02-21`. Matches the pattern used in `prompts.ts` line 282 where `todayDate` is injected for close_day.

**Also fix** the date inconsistency at line 242 — change `toISOString().split('T')[0]` to `todayLocalDate()` (from `lib/utils.ts`). This is a pre-existing UTC vs local bug documented in the M3 review.

### Change 2: Inject yesterday's captures for open_day sessions

**File:** `lib/ai/context.ts` — `fetchAndInjectFileContext()`

Add a new block after the yesterday's day plan injection (after line 186), following the exact same pattern as the close_day capture injection (lines 205-234):

```typescript
// After the yesterday's day plan block (line 186), still inside the open_day guard
// Inject yesterday's captures for the morning briefing (carry-forward)
try {
  const captureFilenames = await ufs.listCaptures(yesterdayStr, 10)
  if (captureFilenames.length > 0) {
    const captureResults = await Promise.allSettled(
      captureFilenames.map((filename) => ufs.readCapture(filename))
    )
    const validCaptures = captureResults
      .filter((r): r is PromiseFulfilledResult<...> =>
        r.status === 'fulfilled' && r.value !== null
      )
      .map((r) => r.value!)

    if (validCaptures.length > 0) {
      parts.push(`\n=== YESTERDAY'S CAPTURES (${validCaptures.length}) ===`)
      for (const capture of validCaptures) {
        const time = new Date(capture.frontmatter.timestamp)
          .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        const mode = capture.frontmatter.input_mode === 'voice' ? ' [voice]' : ''
        // Strip block tags to prevent prompt injection (documented pattern from M3 review)
        const sanitized = capture.content.replace(
          /\[\/?(FILE_UPDATE|DOMAIN_SUMMARY|LIFE_MAP_SYNTHESIS|SESSION_SUMMARY|SUGGESTED_REPLIES|INLINE_CARD|INTENTION_CARD|DAY_PLAN_DATA)[^\]]*\]/g,
          ''
        )
        parts.push(`- ${time}${mode}: "${sanitized}"`)
      }
    }
  }
} catch {
  // No yesterday captures — that's fine
}
```

**Key details:**
- Reuses the `yesterdayStr` variable already computed at line 166
- Same sanitization regex as close_day (line 226), extended with `DAY_PLAN_DATA` tag
- Same 10-capture limit for token budget
- Label says "YESTERDAY'S CAPTURES" — gives Claude correct temporal framing
- Must be inside the existing `if (sessionType === 'open_day')` block

### Change 3: Fix briefing card handoff to auto-trigger

**File:** `components/chat/chat-view.tsx` — briefing card `onStart` callback

Change from sending a user message to auto-triggering Claude:

```typescript
// Lines 1139-1143 — briefing card onStart
// BEFORE:
onStart={() => {
  setShowBriefing(false)
  handleSend("Let's open the day")
}}

// AFTER:
onStart={() => {
  setShowBriefing(false)
  triggerSageResponse('none')
}}
```

This matches the close_day pattern (lines 458-462) where `triggerSageResponse('none')` auto-triggers Claude after the hardcoded greeting. Claude sees only `[assistant: "Good morning, Tom. Let's set the tone for today."]` and generates Step 1 (energy check + pills) as its first response — no ambiguous user message to derail the flow.

**Why this is safe:** `triggerSageResponse` calls `streamAndFinalize()` which handles streaming and saves the assistant message. It does NOT process FILE_UPDATE blocks, but that's correct — Step 1 (energy check) doesn't produce any file updates. File updates only come in Step 5, which will be a response to a user message processed through the full `sendMessage` pipeline.

## Technical Considerations

- **Capture sanitization is critical.** The M3 code review documented a prompt injection vector where capture content containing `[FILE_UPDATE]` blocks could trick Sage into unauthorized writes. The regex sanitization pattern from close_day (context.ts line 226) must be replicated exactly for the open_day injection.
- **Date must use local timezone.** Use `toLocaleDateString('en-CA')` consistently (Pattern A in the codebase). The UTC variant `toISOString().split('T')[0]` causes date mismatches for users in negative UTC offsets after midnight.
- **`triggerSageResponse` vs `sendMessage` lifecycle.** `triggerSageResponse` only streams — no FILE_UPDATE processing. This is correct for the auto-triggered Step 1 response. All subsequent user messages go through `sendMessage` which handles the full lifecycle including day plan data persistence.

## Acceptance Criteria

- [x] System prompt includes `TODAY: [Day], [YYYY-MM-DD]` for all session types (`lib/ai/context.ts`)
- [x] Open_day context includes `=== YESTERDAY'S CAPTURES (N) ===` with sanitized content (`lib/ai/context.ts`)
- [x] Briefing card "Begin" triggers `triggerSageResponse('none')` instead of `handleSend("Let's open the day")` (`components/chat/chat-view.tsx`)
- [x] Fix UTC date bug at context.ts line 242 — use `todayLocalDate()` instead of `toISOString().split('T')[0]`
- [ ] Sage's first response after briefing card is Step 1 energy check with pills, not a close-day-style question
- [ ] Yesterday's captures are referenced with correct "yesterday" temporal framing in Step 2 briefing

## Dependencies & Risks

- **Low risk.** All three changes follow established patterns in the same files.
- **No schema changes.** No migrations, no new tables.
- **No prompt changes.** The open_day skill (`skills/open-day.md`) is correct — the issue is context injection + flow, not the prompt itself.
- **Token budget:** Adding yesterday's captures (max 10) adds ~500-1000 tokens to the open_day system prompt. Within budget given existing context size.

## References

- Brainstorm: `Docs/brainstorms/2026-02-21-open-day-date-context-bug-brainstorm.md`
- Implementation spec: `Docs/feedback/20260220_R4e_open_day_quick_capture.md` (Section 4, Step 2)
- M3 code review: `docs/solutions/code-review-fixes/20260218-daily-rhythm-m3-review-findings.md`
- Open_day skill: `skills/open-day.md`
- Context builder: `lib/ai/context.ts`
- Chat view: `components/chat/chat-view.tsx`
