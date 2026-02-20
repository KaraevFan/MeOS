---
status: complete
priority: p2
issue_id: "050"
tags: [code-review, security, parser, day-plan]
dependencies: ["046"]
---

# 050 — JSON.parse on untrusted AI output without validation

## Problem Statement

The parser at `lib/ai/parser.ts:431-432` uses `JSON.parse(jsonStr) as DayPlanDataBlock` on AI-generated `[DAY_PLAN_DATA]` block content. `JSON.parse` returns `any` and the `as` cast asserts shape without validation. Malformed AI output (e.g., `{"energy_level": 42, "priorities": "not an array"}`) passes silently and only fails when data is used or written to Postgres.

Same pattern exists in `lib/ai/classify-capture.ts:84`.

## Findings

- **File:** `lib/ai/parser.ts:431-432`
  ```typescript
  const data = JSON.parse(jsonStr) as DayPlanDataBlock  // no validation
  ```
- **File:** `lib/ai/classify-capture.ts:84`
  ```typescript
  const parsed = JSON.parse(content.text.trim()) as { classification?: string; tags?: string[] }
  ```
- Related: learnings researcher flagged parser fragility and XML fencing from past solutions

## Proposed Solutions

### Option A: Zod validation at parse time (Recommended)
- Create `DayPlanDataSchema` using Zod
- `safeParse` the JSON, emit segment only if valid, log warning otherwise
- **Pros:** Catches bad AI output early, provides structured error messages
- **Effort:** Small
- **Risk:** Low

## Acceptance Criteria

- [ ] `[DAY_PLAN_DATA]` JSON validated with Zod schema before emitting segment
- [ ] Invalid shapes logged as warnings, not silently passed through
- [ ] Build passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-20 | Identified by code review | TypeScript + learnings reviewers flagged |
