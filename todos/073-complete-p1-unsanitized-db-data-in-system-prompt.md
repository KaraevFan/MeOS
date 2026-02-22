---
status: complete
priority: p1
issue_id: "073"
tags: [code-review, security, prompt-injection, context-injection]
dependencies: []
---

# 073 — Unsanitized DB data injected into system prompt without `<user_data>` tags

## Problem Statement

In `lib/ai/context.ts`, the carry-forward and week-in-numbers blocks inject `day_plans` DB data (priority text, open thread text) directly into the system prompt WITHOUT wrapping in `<user_data>` tags and WITHOUT stripping potential `[FILE_UPDATE]` or `[DAY_PLAN_DATA]` block tags. This means if a user's priority text or thread text contains `[FILE_UPDATE type="domain" ...]`, it could be interpreted as a Sage output command, leading to prompt injection / file overwrites.

The rest of the context injection in the same file correctly wraps user content in `<user_data>` tags (e.g., weekly plan, life plan, etc.), but the new day_plans blocks don't follow this pattern.

## Findings

- **File:** `lib/ai/context.ts` — Carry-forward block (~line building `CARRY FORWARD FROM YESTERDAY` section): iterates `plan.priorities` and `plan.open_threads` and injects `.text` directly
- **File:** `lib/ai/context.ts` — Week-in-numbers block: similarly injects aggregated priorities and threads without sanitization
- **Pattern violation:** All other user-sourced content in the same file is wrapped in `<user_data>` tags; these new blocks skip that pattern
- **Attack surface:** A user (or compromised input) with priority text like `[FILE_UPDATE type="domain" name="Career / Work"]` could overwrite life map files

## Proposed Solutions

### Option A: Wrap in `<user_data>` tags and strip block tags (Recommended)
Wrap entire carry-forward and week-in-numbers sections in `<user_data>` tags, matching the pattern used for weekly plan, life plan, and check-in injection. Also strip any `[FILE_UPDATE`, `[DOMAIN_SUMMARY`, `[DAY_PLAN_DATA` tags from the text using the same regex pattern used in `sanitizeCapture()`.
- **Pros:** Consistent with existing pattern; minimal code change; closes the injection vector
- **Cons:** None
- **Effort:** Small
- **Risk:** Low

### Option B: Dedicated `sanitizeDbText()` utility
Create a dedicated `sanitizeDbText()` utility that strips block tags and wraps individual values.
- **Pros:** Reusable across future DB-to-prompt injection points
- **Cons:** More code for current scope; may be premature abstraction
- **Effort:** Medium
- **Risk:** Low

## Acceptance Criteria

- [ ] Carry-forward section content wrapped in `<user_data>` tags
- [ ] Week-in-numbers section content wrapped in `<user_data>` tags
- [ ] Block tags (`[FILE_UPDATE`, `[DAY_PLAN_DATA`, etc.) stripped from injected text
- [ ] Existing context injection patterns remain unchanged

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
