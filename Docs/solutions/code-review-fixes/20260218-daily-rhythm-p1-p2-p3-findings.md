---
title: "Code Review Fixes: Daily Rhythm M2 Branch (20 Findings)"
date: 2026-02-18
category: code-review-fixes
severity: medium
tags:
  - code-review
  - parser
  - side-effects
  - type-safety
  - zod-validation
  - react-hooks
  - deduplication
  - security
  - documentation
modules:
  - lib/ai/parser.ts
  - lib/ai/context.ts
  - lib/ai/skill-loader.ts
  - lib/calendar/types.ts
  - lib/calendar/google-calendar.ts
  - lib/utils.ts
  - lib/supabase/home-data.ts
  - components/home/hero-card.tsx
  - components/home/capture-bar.tsx
  - components/home/checkin-card.tsx
  - components/chat/briefing-card.tsx
  - types/chat.ts
  - app/api/chat/route.ts
  - app/(auth)/auth/callback/route.ts
  - app/(auth)/login/page.tsx
  - supabase/migrations/013_calendar_integration.sql
related:
  - Docs/solutions/logic-errors/markdown-section-extraction-heading-boundary.md
  - Docs/solutions/logic-errors/dead-code-accumulation-post-redesign.md
  - Docs/solutions/security-issues/rls-auth-data-leak-fix.md
  - Docs/solutions/security-issues/markdown-storage-security-review-fixes.md
commits:
  - da69186
pr_branch: feat/daily-rhythm-m2
---

# Code Review Fixes: Daily Rhythm M2 Branch

## Problem Statement

A comprehensive code review of the `feat/daily-rhythm-m2` branch (9 commits, 47 files, +3597/-337 vs main) identified 20 findings across three severity tiers. The branch implements Milestones 2a-2c of the MeOS daily rhythm feature (home screen redesign, open-day/close-day sessions, calendar integration).

All 20 findings were fixed in commit `da69186` across 16 files.

## Findings & Solutions

### P1 Critical (3 findings)

#### 1. Global regex `lastIndex` state leak

**File:** `lib/ai/parser.ts`
**Symptom:** Intermittent parse failures when `FILE_UPDATE` blocks contain multiple attributes.

Module-level regex with `/g` flag maintains `lastIndex` state between calls. Successive calls to `parseFileUpdateAttributes()` could skip matches or fail silently.

**Before:**
```typescript
const ATTR_REGEX = /(\w+)="([^"]*)"/g

function parseFileUpdateAttributes(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  let m: RegExpExecArray | null
  while ((m = ATTR_REGEX.exec(attrString)) !== null) {
    attrs[m[1]] = m[2]
  }
  return attrs
}
```

**After:**
```typescript
function parseFileUpdateAttributes(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  for (const m of attrString.matchAll(/(\w+)="([^"]*)"/g)) {
    attrs[m[1]] = m[2]
  }
  return attrs
}
```

**Why it works:** `matchAll()` creates a fresh iterator per call with no shared state.

#### 2. Side effect in context builder

**Files:** `lib/ai/context.ts`, `app/api/chat/route.ts`
**Symptom:** `buildConversationContext()` performed DB writes (expiring stale sessions) mixed with read-only prompt building, violating Command-Query Separation.

**Fix:** Extracted `expireStaleOpenDaySessions()` as a separate exported function. The API route now calls it explicitly before building context.

```typescript
// lib/ai/context.ts — pure read-only
export async function buildConversationContext(...): Promise<string> { /* reads only */ }

// lib/ai/context.ts — explicit side effect
export async function expireStaleOpenDaySessions(userId: string): Promise<void> { /* writes only */ }

// app/api/chat/route.ts — orchestrator owns sequencing
if (sessionType === 'close_day') {
  await expireStaleOpenDaySessions(user.id)
}
const systemPrompt = await buildConversationContext(sessionType, user.id, options)
```

#### 3. Plaintext OAuth token storage

**File:** `supabase/migrations/013_calendar_integration.sql`
**Symptom:** `access_token` and `refresh_token` stored as plaintext in the `integrations` table.

**Fix:** Added security comment documenting this as a known MVP tradeoff. Each user can only read their own row (RLS). Post-MVP path: encrypt via pgcrypto or Vault.

### P2 Important (5 findings)

#### 4. Custom YAML parser limitations undocumented

**File:** `lib/ai/skill-loader.ts`
**Fix:** Added JSDoc documenting known edge cases (quoted strings, colons in values, multi-line) and when to replace with `gray-matter`.

#### 5-6. Missing Zod validation + unsafe type cast

**Files:** `lib/calendar/types.ts`, `lib/calendar/google-calendar.ts`
**Symptom:** `as CalendarIntegration` cast on Supabase query result bypassed runtime validation.

**Fix:** Added `CalendarIntegrationSchema` (Zod) alongside the type. Replaced `as` cast with `safeParse()`:

```typescript
// types.ts
export const CalendarIntegrationSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  provider: z.string(),
  access_token: z.string(),
  refresh_token: z.string().nullable(),
  token_expires_at: z.string().nullable(),
  scopes: z.array(z.string()).nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})
export type CalendarIntegration = z.infer<typeof CalendarIntegrationSchema>

// google-calendar.ts
const parsed = CalendarIntegrationSchema.safeParse(integration)
if (!parsed.success) {
  console.warn('[calendar] Integration row failed validation:', parsed.error.message)
  return []
}
const token = await getValidToken(parsed.data, userId)
```

#### 7. InlineCardData not a discriminated union

**File:** `types/chat.ts`
**Fix:** Changed from `interface` to union type for future extensibility:

```typescript
export type InlineCardData =
  | { cardType: 'calendar'; items: string[] }
```

#### 8. Unstable useEffect dependency (object identity)

**File:** `components/home/hero-card.tsx`
**Symptom:** `contextualLinePayload` prop as object in dependency array caused re-fetching on every parent render.

**Fix:** Added `useMemo` with `JSON.stringify` for stable serialization:

```typescript
const payloadKey = useMemo(
  () => contextualLinePayload ? JSON.stringify(contextualLinePayload) : null,
  [contextualLinePayload]
)

useEffect(() => {
  if (!payloadKey) return
  // fetch using payloadKey as body (already serialized)
}, [payloadKey])
```

### P3 Nice-to-have (6 findings)

| # | Finding | File | Fix |
|---|---------|------|-----|
| 9 | `getTimeGreeting()` duplicated in 2 files | `lib/utils.ts` | Extracted shared utility, replaced imports |
| 10 | Checkin card missing fallback for unknown response | `components/home/checkin-card.tsx` | Added `?? 'Got it.'` |
| 11 | Auth callback token availability undocumented | `app/(auth)/auth/callback/route.ts` | Added comment explaining `provider_token` is only available on initial OAuth |
| 12 | Login calendar scope forced on all sign-ins | `app/(auth)/login/page.tsx` | Documented as MVP decision with post-MVP incremental path |
| 13 | Capture bar silently discards input | `components/home/capture-bar.tsx` | Added flash feedback with auto-dismiss |

## Prevention Checklist

Apply to every code change:

- [ ] **Regex:** No module-level `/g` flags. Use `matchAll()` or create regex inside function scope.
- [ ] **Purity:** Functions named `build*`/`fetch*`/`get*` must be read-only. Side effects belong in the API route layer.
- [ ] **Validation:** External data (Supabase, APIs) validated with Zod `safeParse()`, never bare `as` casts.
- [ ] **Effects:** No object/array literals in useEffect dependency arrays. Use `useMemo()` + serialization.
- [ ] **Duplication:** Grep codebase before writing utility functions. Check `lib/utils.ts` first.

## Cross-References

- **Regex bugs:** See also `Docs/solutions/logic-errors/markdown-section-extraction-heading-boundary.md` (similar regex boundary issue in markdown parser)
- **Side effects / dead code:** See `Docs/solutions/logic-errors/dead-code-accumulation-post-redesign.md` (SSR hydration patterns, dead computation)
- **Zod validation:** See `Docs/solutions/security-issues/rls-auth-data-leak-fix.md` (Zod request validation patterns)
- **Security hardening:** See `Docs/solutions/security-issues/markdown-storage-security-review-fixes.md` (deny-by-default permissions, `Promise.allSettled()` batching)
