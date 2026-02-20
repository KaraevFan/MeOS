---
status: pending
priority: p3
issue_id: "054"
tags: [code-review, performance, react, day-plan]
dependencies: []
---

# 054 — Missing useMemo on groupCaptures + parseStreamingChunk optimization

## Problem Statement

1. `groupCaptures(localCaptures)` in `CapturedThoughts` runs on every render without memoization. Trivial fix: wrap with `useMemo`.

2. `parseStreamingChunk` performs 9 string scans per streaming chunk. Adding an early `[` character check eliminates ~80% of unnecessary CPU work during plain text streaming.

## Findings

- **File:** `components/day-plan/captured-thoughts.tsx:154` — no useMemo
- **File:** `lib/ai/parser.ts:481+` — 9 indexOf/regex scans per chunk

## Acceptance Criteria

- [ ] `groupCaptures` wrapped in `useMemo`
- [ ] `parseStreamingChunk` has early exit for chunks without `[`

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-20 | Identified by code review | Performance oracle flagged |
