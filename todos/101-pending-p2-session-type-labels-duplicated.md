---
status: pending
priority: p2
issue_id: "101"
tags: [code-review, quality, dry]
dependencies: []
---

# `SESSION_TYPE_LABELS` Duplicated Across 3 Files

## Problem Statement

The `SESSION_TYPE_LABELS` map is copy-pasted in three files with identical (or near-identical) content. This PR added 3 new entries (`close_day`, `open_day`, `quick_capture`) to two of these files — but a third (`active-session-card.tsx`) was not updated, demonstrating the drift risk. All three use `Record<string, string>`, which accepts any key and prevents TypeScript from catching missing entries.

## Findings

- **Source**: kieran-typescript-reviewer, simplicity-reviewer, agent-native-reviewer, performance-oracle
- **Locations**:
  - `components/history/session-card.tsx` lines 5-14
  - `app/(main)/history/[sessionId]/page.tsx` lines 37-46
  - `components/home/active-session-card.tsx` lines 11-18 (not updated in this PR)

## Proposed Solutions

Extract to a shared constant typed against `Session['session_type']`:

```typescript
// lib/constants.ts
import type { Session } from '@/types/database'

export const SESSION_TYPE_LABELS: Record<Session['session_type'], string> = {
  life_mapping: 'Life Mapping',
  weekly_checkin: 'Weekly Check-In',
  monthly_review: 'Monthly Review',
  quarterly_review: 'Quarterly Review',
  ad_hoc: 'Conversation',
  close_day: 'Evening Reflection',
  open_day: 'Morning Session',
  quick_capture: 'Quick Capture',
}
```

- **Effort**: Small
- **Risk**: Low — adding a new session type to the DB type will cause a compile error if label is missing

## Acceptance Criteria

- [ ] Single source of truth for session type labels
- [ ] Typed against `Session['session_type']` for exhaustiveness
- [ ] All 3 consuming files import from shared constant
