---
status: pending
priority: p2
issue_id: "008"
tags: [code-review, typescript]
dependencies: []
---

# 008 — `renderInlineMarkdown` return type `React.ReactNode` without React import

## Problem Statement

`renderInlineMarkdown` is declared with return type `React.ReactNode` but the file does not import `React`. In Next.js 13+ with the React 18 JSX transform this works at runtime, but the type annotation `React.ReactNode` may fail `tsc --strict` unless `React` is imported as a type.

## Findings

- **File:** `components/chat/message-bubble.tsx:18`
- ```tsx
  function renderInlineMarkdown(text: string): React.ReactNode {
  ```
- `React` not in scope as a type; file only imports `cn` and component types
- Reported by: TypeScript reviewer (P2-A)
- Note: `npm run type-check` should be run to confirm whether this actually fails in this project's tsconfig

## Fix

```tsx
import type { ReactNode } from 'react'

function renderInlineMarkdown(text: string): ReactNode {
```

Or import inline:
```tsx
import React from 'react'  // adds type access
```

**Effort:** Trivial

## Acceptance Criteria

- [ ] `npm run type-check` passes with no errors in `message-bubble.tsx`
- [ ] Either `import type { ReactNode } from 'react'` or `import React from 'react'` added

## Work Log

- 2026-02-19: Created from PR #19 code review (TypeScript reviewer P2-A)
