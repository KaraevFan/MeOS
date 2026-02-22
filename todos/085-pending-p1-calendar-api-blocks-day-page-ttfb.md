---
status: pending
priority: p1
issue_id: "085"
tags: [code-review, performance, calendar]
dependencies: []
---

# Google Calendar API Blocks Day Page TTFB

## Problem Statement

The Day page server component (`app/(main)/day/page.tsx`) uses `Promise.all` to fetch day plan data, calendar integration status, and calendar events in parallel. However, the page cannot send any HTML until all three promises resolve. `getCalendarEvents` calls the Google Calendar API (200-600ms typical, up to 3s with token refresh retries), blocking TTFB for all users with calendar integration.

## Findings

- **Source**: performance-oracle agent
- **Location**: `app/(main)/day/page.tsx` lines 20-24
- **Evidence**: `Promise.all([getDayPlanWithCaptures, hasCalendarIntegration, getCalendarEvents.catch(...)])` — page is blocked until slowest promise resolves
- **Impact**: TTFB moves from ~150ms (Supabase-only) to 300-800ms (with Google API), up to 1-4s with token refresh
- **Additional**: No `loading.tsx` skeleton exists for the Day page, so users see a frozen tab bar during loading

## Proposed Solutions

### Option A: Suspense boundary for calendar (Recommended)
Move calendar fetch into an async server component rendered inside a `<Suspense>` boundary. Page renders immediately with day plan data; calendar streams in.

- **Pros**: Decouples TTFB from external API, idiomatic Next.js pattern
- **Cons**: Requires refactoring props to slot pattern or separate component
- **Effort**: Medium
- **Risk**: Low

### Option B: Client-side calendar fetch
Fetch calendar data client-side after page load via existing `/api/calendar/events` route.

- **Pros**: Page loads instantly, simpler implementation
- **Cons**: Client-side waterfall, flash of empty calendar area
- **Effort**: Small
- **Risk**: Low

### Option C: Add loading.tsx skeleton (Quick win)
Add `app/(main)/day/loading.tsx` with skeleton matching Day page layout for instant navigation feedback.

- **Pros**: Immediate visual improvement, complements either option above
- **Cons**: Doesn't fix underlying TTFB issue, just masks it
- **Effort**: Small
- **Risk**: None

## Acceptance Criteria

- [ ] Day page TTFB stays under 200ms regardless of Google API latency
- [ ] Calendar section renders progressively (skeleton or stream)
- [ ] `loading.tsx` skeleton exists for Day page navigation feedback

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-23 | Identified during code review of Playtest 6 PR | New calendar fetch on critical path |
