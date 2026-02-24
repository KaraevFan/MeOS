---
status: pending
priority: p2
issue_id: "102"
tags: [code-review, typescript, type-safety]
dependencies: []
---

# Untyped `JSON.parse` in Summary Generation — No Zod Validation

## Problem Statement

`app/api/session/generate-summary/route.ts` parses Claude's JSON response with `JSON.parse(responseText)` and assigns it to a typed variable without runtime validation. If Claude returns malformed JSON (e.g., `{"summary": 123, "themes": "not an array"}`), it silently passes incorrect data to `updateSessionSummary`.

## Findings

- **Source**: kieran-typescript-reviewer
- **Location**: `app/api/session/generate-summary/route.ts` lines 109-120
- **Note**: The project already uses Zod extensively (e.g., `ChatRequestSchema`, `DayPlanDataSchema`)

## Proposed Solutions

Add Zod validation:

```typescript
const SummaryResultSchema = z.object({
  summary: z.string(),
  themes: z.array(z.string()),
  sentiment: z.enum(['positive', 'neutral', 'mixed', 'negative']),
  energy_level: z.number().int().min(1).max(5),
})

const parsed = SummaryResultSchema.safeParse(JSON.parse(responseText))
if (!parsed.success) {
  result = { summary: 'Session completed.', themes: [], sentiment: 'neutral', energy_level: 3 }
} else {
  result = parsed.data
}
```

- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria

- [ ] Claude's response is validated with Zod before use
- [ ] Fallback fires on invalid JSON shape
