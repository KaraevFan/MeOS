---
status: pending
priority: p2
issue_id: "033"
tags: [code-review, architecture, deduplication, hooks, supabase-realtime]
dependencies: []
---

# 033 — Extract shared `useLifeMapData` hook from pill and sidebar

## Problem Statement

`life-map-progress-pill.tsx` (lines 43-129) and `life-map-sidebar.tsx` (lines 40-176) independently: define identical `FileIndexRow` interface, create Supabase client, run the same `file_index` query, download/parse `session-insights.md`, subscribe to `postgres_changes` on `file_index`, and build the same `domainFileIndex` Map. This is ~80 lines of duplicated data-fetching code. While the two components never mount simultaneously (pill on mobile, sidebar on desktop), bug fixes applied to one may not reach the other, creating a divergence risk.

## Findings

- **Files:** `components/chat/life-map-progress-pill.tsx:43-129`, `components/chat/life-map-sidebar.tsx:40-176`
- **Duplicated logic:**
  1. `FileIndexRow` interface definition — identical in both files
  2. `createClient()` call
  3. `file_index` Supabase query filtered by `user_id` and `session_id`
  4. Download + parse `session-insights.md` from Storage
  5. Realtime subscription to `postgres_changes` on `file_index` table
  6. `domainFileIndex` Map construction from query results
- **Estimated duplication:** ~80 lines
- Reported by: Architecture strategist (Priority 3), Code simplicity reviewer (HIGH — "single biggest problem"), Performance oracle (P0 — if both ever mount on desktop)

## Proposed Solutions

### Option A — Extract `useLifeMapData` custom hook (Recommended)

```tsx
// lib/hooks/use-life-map-data.ts
export interface FileIndexRow {
  file_path: string
  status: string
  updated_at: string
}

export function useLifeMapData(userId: string) {
  const [fileIndex, setFileIndex] = useState<FileIndexRow[]>([])
  const [insightsContent, setInsightsContent] = useState<string | null>(null)

  // Single fetch + single realtime subscription
  useEffect(() => {
    // fetch file_index rows
    // download session-insights.md
    // subscribe to postgres_changes
    return () => { /* unsubscribe */ }
  }, [userId])

  return { fileIndex, insightsContent }
}
```

Both pill and sidebar consume the hook and focus only on their presentation logic.

**Pros:** Single source of truth for data fetching, ~80 LOC saved, bug fixes propagate to both consumers automatically
**Cons:** Slight refactor effort across two files
**Effort:** Medium
**Risk:** Low

### Option B — Shared utility functions (not a hook)

Extract the query and subscription logic into plain functions, called from each component's own `useEffect`.

**Pros:** Smaller change surface
**Cons:** Still duplicates the state management and effect wiring — less benefit
**Effort:** Small
**Risk:** Low

## Recommended Action

Option A — full `useLifeMapData` hook extraction. The duplication is structural (same state + same effect + same subscription), so a hook is the natural abstraction.

## Technical Details

- **Affected files:** `components/chat/life-map-progress-pill.tsx`, `components/chat/life-map-sidebar.tsx`
- **New file:** `lib/hooks/use-life-map-data.ts`
- **PR:** #20

## Acceptance Criteria

- [ ] `useLifeMapData` hook exists in `lib/hooks/use-life-map-data.ts`
- [ ] `FileIndexRow` interface defined once in the hook file (or `types/`)
- [ ] `life-map-progress-pill.tsx` consumes `useLifeMapData` instead of inline data fetching
- [ ] `life-map-sidebar.tsx` consumes `useLifeMapData` instead of inline data fetching
- [ ] Realtime subscription created once per hook instance
- [ ] ~80 lines of duplicated code removed across both files
- [ ] TypeScript strict check passes
- [ ] ESLint passes

## Work Log

- 2026-02-19: Created from PR #20 R4.2 code review (Architecture strategist P3, Code simplicity reviewer HIGH, Performance oracle P0)
