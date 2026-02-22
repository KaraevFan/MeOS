---
status: pending
priority: p3
issue_id: "090"
tags: [code-review, quality, design-system]
dependencies: []
---

# EnergyCheckCard Uses bg-white Instead of Semantic Token

## Problem Statement

`energy-check-card.tsx` uses hardcoded `bg-white` instead of the semantic `bg-bg-card` design token. Inconsistent with the design system and would break if dark mode were ever introduced.

## Findings

- **Source**: kieran-typescript-reviewer agent
- **Location**: `components/chat/energy-check-card.tsx` line 38

## Proposed Solutions

Change `bg-white` to `bg-bg-card` (the semantic token for card backgrounds from the design system).

- **Effort**: Trivial
- **Risk**: None

## Acceptance Criteria

- [ ] EnergyCheckCard uses `bg-bg-card` instead of `bg-white`

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-23 | Found during code review | Design system consistency |
