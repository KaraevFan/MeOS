---
title: "R5a Playtest Code Review — Security, Performance, Architecture, and Quality Fixes"
date: 2026-02-21
category: code-review-fixes
severity: mixed
modules:
  - components/day-plan/day-plan-swipe-container.tsx
  - components/chat/energy-check-chips.tsx
  - app/(main)/chat/page.tsx
  - app/api/day-plan/route.ts
  - lib/dates.ts
  - lib/constants/reflective-prompts.ts
  - components/home/ambient-card.tsx
  - components/home/home-screen.tsx
  - components/chat/chat-view.tsx
tags:
  - code-review
  - security
  - prompt-injection
  - race-condition
  - performance
  - memoization
  - caching
  - type-safety
  - architecture
  - date-arithmetic
related_issues:
  - "065"
  - "066"
  - "067"
  - "068"
  - "069"
  - "070"
  - "071"
  - "072"
---

# R5a Playtest Code Review — 8 Findings Fixed

A multi-agent code review (7 agents: kieran-typescript-reviewer, security-sentinel, performance-oracle, architecture-strategist, code-simplicity-reviewer, agent-native-reviewer, learnings-researcher) of the R5a playtest UX fixes branch identified 8 issues. All were resolved in commit `14209c2`.

## Problem Summary

| # | Severity | Category | Issue |
|---|----------|----------|-------|
| 065 | P1 | Security | URL `prompt` param flows unsanitized into AI system prompt |
| 066 | P1 | Performance | Rapid swipe fires unbounded concurrent fetches with race condition |
| 067 | P2 | Architecture | EnergyCheckChips renders hardcoded options, ignores AI pills |
| 068 | P2 | Performance | IIFE breaks entire callback memoization chain |
| 069 | P2 | Performance | Day plan API missing Cache-Control for immutable historical dates |
| 070 | P2 | Type Safety | `res.json()` returns untyped `any`, set to state without validation |
| 071 | P3 | Cleanup | Diagnostic `console.log` left in production code |
| 072 | P3 | Duplication | Three implementations of "shift YYYY-MM-DD by N days" |

## Root Causes and Fixes

### P1-065: Prompt Injection via URL Parameter

**Root cause:** The ambient card reflection flow passed prompt text as a raw URL parameter (`/chat?mode=reflection&prompt=<text>`). The server read `params.prompt` with no validation and stored it as `nudgeContext`, which was later injected into the Claude system prompt. A crafted link could inject attacker-controlled text.

**Wrong:**
```typescript
// Reads raw URL param — open to prompt injection
if (params.mode === 'reflection' && params.prompt && sessionType === 'ad_hoc') {
  nudgeContext = params.prompt  // attacker controls this string
}
```

**Correct:**
```typescript
// 1. Extract prompts to shared constants (lib/constants/reflective-prompts.ts)
export const REFLECTIVE_PROMPTS = [
  'What feels most true about where you are right now?',
  // ... 14 more prompts
] as const

// 2. Validate server-side against allowlist
import { REFLECTIVE_PROMPTS } from '@/lib/constants/reflective-prompts'

if (params.mode === 'reflection' && params.prompt && sessionType === 'ad_hoc') {
  if ((REFLECTIVE_PROMPTS as readonly string[]).includes(params.prompt)) {
    nudgeContext = params.prompt  // only set if in known-safe list
  }
}
```

**Rule:** Any string from URL params/POST bodies/cookies that will touch an AI prompt must pass an allowlist or be fetched via a user-scoped DB query. Direct interpolation is forbidden.

---

### P1-066: Swipe Fetch Race Condition

**Root cause:** `fetchDayPlan` used plain `fetch()` with no `AbortController` and no client-side cache. Rapid swiping fired up to 30 concurrent requests. Out-of-order responses caused stale data to overwrite the current view.

**Wrong:**
```typescript
const fetchDayPlan = useCallback(async (date: string) => {
  setIsLoading(true)
  try {
    const res = await fetch(`/api/day-plan?date=${date}`)
    if (res.ok) {
      const json = await res.json()
      setData(json)  // may be out-of-order; stale overwrites current
    }
  } finally {
    setIsLoading(false)
  }
}, [])
```

**Correct:**
```typescript
const abortRef = useRef<AbortController | null>(null)
const cacheRef = useRef<Map<string, DayPlanWithCaptures>>(new Map())

const fetchDayPlan = useCallback(async (date: string) => {
  const cached = cacheRef.current.get(date)
  if (cached) { setData(cached); return }

  abortRef.current?.abort()
  const controller = new AbortController()
  abortRef.current = controller

  setIsLoading(true)
  try {
    const res = await fetch(`/api/day-plan?date=${date}`, { signal: controller.signal })
    if (res.ok) {
      const json: unknown = await res.json()
      if (isDayPlanResponse(json)) {
        cacheRef.current.set(date, json)
        setData(json)
      }
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return
  } finally {
    if (abortRef.current === controller) setIsLoading(false)
  }
}, [])

useEffect(() => { return () => { abortRef.current?.abort() } }, [])
```

Three guarantees: (1) prior request cancelled before new one starts, (2) visited dates served from cache instantly, (3) `abortRef.current === controller` guard prevents superseded requests from clearing loading state.

**Rule:** Any `useCallback` that calls `fetch()` and is invoked by user navigation must use `AbortController`. Cache immutable historical data in a `useRef<Map>`.

---

### P2-067: Hardcoded Energy Options Ignoring AI Output

**Root cause:** `EnergyCheckChips` had an internal `ENERGY_OPTIONS` array. The AI's actual `[SUGGESTED_REPLIES]` data was discarded. Detection used a fragile `activePills.length === 5` heuristic.

**Fix:** Component now accepts `pills: SuggestionPill[]` as a prop. Emoji decoration is a pure cosmetic lookup, not a data dependency. Detection relaxed to `>= 4`.

```typescript
// Emoji lookup — cosmetic only, degrades gracefully
const ENERGY_EMOJI: Record<string, string> = {
  'fired up': '\uD83D\uDD25', 'focused': '\u26A1', /* ... */ }

function getEmoji(label: string): string | undefined {
  const key = label.toLowerCase().replace(/^[\p{Emoji}\s]+/u, '').trim()
  return ENERGY_EMOJI[key]
}

export function EnergyCheckChips({ pills, onSelect, disabled }: EnergyCheckChipsProps) {
  return (
    <div className="flex gap-2 ...">
      {pills.map((pill) => {
        const emoji = getEmoji(pill.label)
        return <button key={pill.value} ...>{emoji && <span>{emoji}</span>}{pill.label}</button>
      })}
    </div>
  )
}
```

**Rule:** Components rendering AI-derived selectable options must receive them as props, not define them internally.

---

### P2-068: IIFE Breaks Memoization Chain

**Root cause:** `earliestDate` was computed by an IIFE that ran every render, producing a referentially new string. This invalidated `navigateToDate` -> `handlePrev`/`handleNext` -> touch handlers. `formatShortDate` was also defined inside the render body despite being pure.

**Wrong:**
```typescript
// IIFE creates new string reference every render
const earliestDate = (() => {
  const [y, m, d] = today.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d - MAX_LOOKBACK_DAYS))
  return date.toISOString().split('T')[0]
})()
```

**Correct:**
```typescript
// Stable across renders — only recomputes when today changes
const earliestDate = useMemo(() => shiftDate(today, -MAX_LOOKBACK_DAYS), [today])

// Pure function moved outside component at module scope
function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00')
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
```

**Rule:** Values in `useCallback`/`useMemo` dependency arrays must be referentially stable. Use `useMemo` for derived values, move pure functions outside the component.

---

### P2-069: Missing Cache Headers

**Fix:** Conditional `Cache-Control` in `app/api/day-plan/route.ts`:

```typescript
const isHistorical = parsed.data.date < todayStr
const headers: HeadersInit = isHistorical
  ? { 'Cache-Control': 'private, max-age=3600' }
  : { 'Cache-Control': 'private, no-cache' }
return NextResponse.json(data, { headers })
```

**Rule:** Every API route must set explicit `Cache-Control`. Immutable historical data gets long cache; today gets no-cache. User-private data is always `private`.

---

### P2-070: Unvalidated Fetch Response

**Fix:** Type `res.json()` as `unknown`, validate with a type guard before setting state:

```typescript
function isDayPlanResponse(value: unknown): value is DayPlanWithCaptures {
  return typeof value === 'object' && value !== null
    && 'captures' in value && Array.isArray((value as DayPlanWithCaptures).captures)
}

const json: unknown = await res.json()
if (isDayPlanResponse(json)) { setData(json) }
```

**Rule:** Annotate `res.json()` as `unknown`. Pass through type guard or Zod `.safeParse()` before first typed use.

---

### P3-071: Diagnostic console.log

Removed `console.log('[MeOS] Home page mounted at', ...)` from `home-screen.tsx`.

**Rule:** No `console.log` in application source. Enable `"no-console": ["error", { "allow": ["warn", "error"] }]`.

---

### P3-072: Duplicate Date Arithmetic

**Fix:** Added `shiftDate` to `lib/dates.ts`, replaced 3 inline implementations:

```typescript
export function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + days))
  return date.toISOString().split('T')[0]
}

// Refactored getYesterdayDateString to use it
export function getYesterdayDateString(tz: string = DEFAULT_TIMEZONE): string {
  return shiftDate(getLocalDateString(tz), -1)
}
```

**Rule:** All YYYY-MM-DD date arithmetic must use `shiftDate()` from `lib/dates.ts`.

## Prevention Checklist

For every PR, verify:

**Security:**
- [ ] No URL param or client-supplied string reaches AI prompts without allowlist validation
- [ ] External data touching system prompts is labelled with origin and validation method

**Concurrency:**
- [ ] Navigation-triggered fetches use `AbortController` and cancel prior requests
- [ ] `finally` blocks check `abortRef.current === controller` before clearing loading
- [ ] Cleanup `useEffect` calls `abortRef.current?.abort()`
- [ ] Immutable historical data is cached in `useRef<Map>`

**Memoization:**
- [ ] Pure functions are at module scope, not inside components
- [ ] All `useCallback`/`useMemo` deps are stable (no IIFEs, inline objects, inline arrays)

**HTTP Caching:**
- [ ] Every API route sets explicit `Cache-Control`
- [ ] Date-keyed endpoints: long cache for past, no-cache for today

**Type Safety:**
- [ ] `res.json()` annotated as `unknown` at assignment
- [ ] Type guard or Zod parse before first typed use or setState

**Code Hygiene:**
- [ ] No `console.log`/`console.debug` in application source
- [ ] Date arithmetic uses `shiftDate()` from `lib/dates.ts`

## Recommended ESLint Rules

```json
{
  "no-console": ["error", { "allow": ["warn", "error"] }],
  "@typescript-eslint/no-explicit-any": "error",
  "@typescript-eslint/no-unsafe-assignment": "error",
  "react-hooks/exhaustive-deps": "error"
}
```

## Related Documentation

**Security — Prompt Injection:**
- `Docs/solutions/security-issues/markdown-storage-security-review-fixes.md` — FILE_UPDATE type allowlist, deny-by-default permissions
- `Docs/solutions/code-review-fixes/20260219-react-hooks-security-db-hygiene-multi-pass-review.md` — XML fencing for context injection
- `todos/010-pending-p2-stored-prompt-injection-xml-fence.md` — open: XML fence for markdown file injection

**Performance — Memoization:**
- `Docs/solutions/performance-issues/react-component-memory-leaks-and-rerender-optimization.md` — useMemo patterns for streaming
- `Docs/solutions/react-hooks/supabase-client-in-usecallback-deps.md` — createClient() in render breaks memoization
- `todos/011-pending-p2-parsemessage-memoize.md` — open: same pattern in chat-view.tsx

**Date Arithmetic:**
- `Docs/solutions/logic-errors/2026-02-21-server-side-utc-date-context-injection-bug.md` — centralized lib/dates.ts, DST-safe arithmetic

**Type Safety:**
- `Docs/solutions/code-review-fixes/20260218-daily-rhythm-p1-p2-p3-findings.md` — Zod validation precedent
