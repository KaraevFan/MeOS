---
status: complete
priority: p2
issue_id: "067"
tags: [code-review, architecture, energy-check, fragile-heuristic]
dependencies: []
---

# 067 — EnergyCheckChips renders hardcoded options, ignoring AI-provided pill data

## Problem Statement

`EnergyCheckChips` renders 5 hardcoded `ENERGY_OPTIONS` regardless of what the AI actually sent in `[SUGGESTED_REPLIES]`. The detection heuristic (`activePills.length === 5 && messages.length <= 3`) is fragile — if the AI sends 4 or 6 options, it silently falls back to `SuggestionPills` which truncates to 3. The hardcoded labels also violate single-source-of-truth: if the system prompt changes energy labels, the chips won't reflect the change.

**Source:** Architecture strategist review, simplicity reviewer, TypeScript reviewer.

## Findings

- `components/chat/chat-view.tsx:1233-1237` — detection uses `activePills.length === 5`
- `components/chat/energy-check-chips.tsx:11-17` — hardcodes 5 options, ignores `activePills`
- Long-term fix: add `[ENERGY_CHECK]` block type in parser (like `[INTENTION_CARD]`)
- Short-term: make the component data-driven from `activePills`

## Proposed Solutions

### Option A: Make EnergyCheckChips accept pills as props (Short-term, Recommended)

Pass `activePills` to the component. Map pills to emoji+label display. Keep the hardcoded emoji lookup but use the AI's text as the source of truth for what options to show.

**Pros:** Resilient to prompt changes. **Cons:** Still uses count-based detection. **Effort:** Small. **Risk:** Low.

### Option B: Add `[ENERGY_CHECK]` parser block type (Long-term)

Add a dedicated block type in the parser. The prompt emits `[ENERGY_CHECK]` instead of `[SUGGESTED_REPLIES]` for the energy step.

**Pros:** Clean, explicit, no heuristics. **Cons:** Requires prompt change + parser update. **Effort:** Medium. **Risk:** Low.

## Acceptance Criteria

- [ ] Component renders options based on AI output, not hardcoded array
- [ ] If AI sends 4 or 6 options, they all display correctly
- [ ] Emoji decoration is a UI enhancement, not a data dependency

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-21 | Identified during architecture review | UI should be data-driven from AI output, not hardcoded |
