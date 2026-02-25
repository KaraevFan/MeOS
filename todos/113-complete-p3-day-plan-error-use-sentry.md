---
status: complete
priority: p3
issue_id: "113"
tags: [code-review, observability, security]
dependencies: []
---

# Day Plan Write Error Uses console.error Instead of Sentry

## Problem Statement

In `components/chat/chat-view.tsx:1058`, the day plan write failure handler uses `console.error('[ChatView] Day plan write failed:', err)`. This is a `'use client'` component, so the error goes to the browser console in production — not to Sentry or server logs.

## Findings

- Flagged by: security-sentinel
- Sentry is already imported and used elsewhere in chat-view.tsx
- Browser console errors are invisible in production monitoring

## Proposed Solutions

Use `captureException` from Sentry alongside or instead of `console.error`.

- Effort: Trivial

## Technical Details

- **Affected files:** `components/chat/chat-view.tsx:1058`

## Acceptance Criteria

- [ ] Day plan write failures are captured by Sentry in production

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-25 | Created from PR #34 code review | |

## Resources

- PR: #34
