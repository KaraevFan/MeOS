---
status: complete
priority: p3
issue_id: "081"
tags: [code-review, yagni, typescript, weekly-plan]
dependencies: []
---

# 081 — Remove dead weekly plan schema fields

## Problem Statement

The `WeeklyPlanFrontmatterSchema` in `types/markdown-files.ts` includes `priorities` (array of objects), `reflection_day` (string), and `status` enum fields that are never written to or read from by any code path. The frontmatter generator sets defaults for these but no consumer uses them. This is YAGNI — speculative schema complexity with no current use case.

## Findings

- `priorities`: Never extracted or displayed anywhere. The weekly plan's priorities are in the markdown body, not structured frontmatter.
- `reflection_day`: Defaults to "Sunday" but nothing reads it. No code path uses it to trigger reflections.
- `status`: Always "active", never filtered or checked.

## Proposed Solutions

### Option A: Remove unused fields from schema and generator
Remove `priorities`, `reflection_day`, and `status` from the schema. Keep `week_of`, `created_at`, `last_updated`, `version`, `schema_version` which are used. Also remove from `generateWeeklyPlanFrontmatter()`. Effort: Small. Risk: Low.

## Acceptance Criteria

- [ ] `priorities`, `reflection_day`, `status` removed from `WeeklyPlanFrontmatterSchema`
- [ ] Corresponding fields removed from `generateWeeklyPlanFrontmatter()`
- [ ] Type-check passes
- [ ] No runtime behavior changes
