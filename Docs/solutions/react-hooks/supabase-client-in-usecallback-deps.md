---
date: 2026-02-19
title: "useCallback instability from render-scope createClient(), and 8 companion patterns from PR #20 review"
problem_type: [react-hooks, security, performance, accessibility, architecture]
component: chat
symptoms:
  - "useCallback recreated on every render despite stable logic (supabase in deps)"
  - "isOnboarding derived value computed in two separate places in same component"
  - "Exit affordance shown after session completion when it should be hidden"
  - "abandonSession() relied solely on RLS with no app-layer user_id ownership check"
  - "Missing composite index on messages(session_id, role) causing O(n) filter on page nav"
  - "No API endpoint for session abandonment — agent parity gap"
  - "Unnecessary useCallback wrapping a single router.push() call"
  - "ExitConfirmationSheet keyboard-accessible when visually hidden (no aria-hidden/inert)"
  - "Silent .catch(() => {}) swallowing abandonSession errors"
tags: [react, useCallback, useMemo, supabase, accessibility, agent-parity, security, performance, rls, aria, inert]
related_issues: ["PR #20", "todos/019-027"]
status: resolved
---

# useCallback instability from render-scope `createClient()`, and 8 companion patterns

## Overview

Nine code review findings (019–027) from PR #20 (`feat/tab-bar-session-exit-ux`) were resolved in a single pass. The overarching theme: multiple defense layers were missing or inconsistent — React memoization was undermined by unstable object references, security ownership was delegated entirely to RLS without app-layer redundancy, and UI affordances were not gated on the correct runtime state. A secondary theme is agent parity: every UI-only data write needs a corresponding API route.

---

## Solution

### P1 — Stability & Error Visibility

#### 019 + 020: Supabase client in `useCallback` deps → stale closure + silent error

`createClient()` was called at component render scope and included in a `useCallback` dependency array. Because `createClient()` returns a new object reference on every render (even though the underlying Supabase singleton is stable), `handleExit` was recreated on every render defeating memoization. Additionally, the resulting error was silently swallowed.

**Before:**
```tsx
const supabase = createClient()  // render scope — new object reference every render

const handleExit = useCallback(() => {
  if (sessionIdRef.current) {
    abandonSession(supabase, sessionIdRef.current).catch(() => {})  // silent error
  }
  router.push('/home')
}, [supabase, router])  // supabase forces recreation every render
```

**After:**
```tsx
const handleExit = useCallback(() => {
  if (sessionIdRef.current) {
    const client = createClient()  // inside handler — no dep needed, always fresh
    abandonSession(client, sessionIdRef.current, userId).catch((err) => {
      captureException(err, { tags: { component: 'chat-view', stage: 'abandon_session' } })
    })
  }
  router.push('/home')
}, [isOnboarding, userId, router])  // no supabase in deps
```

**Root cause:** The Supabase browser client is a singleton by design, but `createClient()` wraps it in a new object on every invocation. Including any such call in a dependency array violates the exhaustive-deps contract — the dep is always "new" so the callback is always "stale".

---

### P2 — Correctness, Security & Performance

#### 021: `isOnboarding` derived boolean computed twice

`isOnboarding` was computed inside the `useCallback` body AND again at render scope — two independent derivations of the same value.

**Fix:** Single `useMemo` near top of component; render-scope duplicate removed.

```tsx
const isOnboarding = useMemo(
  () => sessionType === 'life_mapping' && initialSessionState?.state === 'new_user',
  [sessionType, initialSessionState]
)
// handleExit deps reference isOnboarding directly; no inline recomputation
```

#### 022: `onExit` prop active after session completes

`onExit` was passed to `SessionHeader` unconditionally — the exit affordance remained callable even after the session completed, a terminal state.

```tsx
// Before
onExit={handleExit}

// After — undefined disables the prop at the component boundary
onExit={sessionCompleted ? undefined : handleExit}
```

#### 023: `abandonSession()` missing app-layer `user_id` ownership guard

`abandonSession()` filtered only by `sessionId`, relying entirely on RLS. RLS is a single point of failure — a misconfigured policy, service-role key, or migration error bypasses it completely.

**Before:**
```ts
export async function abandonSession(supabase: SupabaseClient, sessionId: string) {
  await supabase.from('sessions').update({ status: 'abandoned' }).eq('id', sessionId)
}
```

**After:**
```ts
export async function abandonSession(
  supabase: SupabaseClient,
  sessionId: string,
  userId: string           // new required parameter
) {
  await supabase
    .from('sessions')
    .update({ status: 'abandoned' })
    .eq('id', sessionId)
    .eq('user_id', userId) // defense in depth — RLS still applies on top
}
```

#### 024: Missing `idx_messages_session_role` composite index

The layout query does an INNER JOIN between `sessions` and `messages` filtering `messages.role = 'user'`. Without a composite index, the FK index finds messages by `session_id` but then filters `role = 'user'` in memory — O(n) per active session, on every page navigation.

```sql
-- supabase/migrations/015_messages_session_role_index.sql
CREATE INDEX IF NOT EXISTS idx_messages_session_role
  ON messages(session_id, role);
```

Covers both `app/(main)/layout.tsx` active-session check and the pre-existing `lib/supabase/home-data.ts` sessions-with-user-messages query.

#### 025: No `POST /api/session/abandon` — agent parity gap

Session abandonment was UI-only (direct browser Supabase call). Any agent or automated client had no API path. Pattern from existing routes (`/api/pulse-check`, `/api/session/generate-reengagement`):

```ts
// app/api/session/abandon/route.ts
const Schema = z.object({ sessionId: z.string().uuid() })

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const parsed = Schema.safeParse(await request.json())
  if (!parsed.success) return new Response(JSON.stringify({ error: 'Invalid sessionId' }), { status: 422 })

  const { data: session } = await supabase
    .from('sessions').select('user_id').eq('id', parsed.data.sessionId).single()
  if (!session || session.user_id !== user.id) return new Response('Forbidden', { status: 403 })

  await abandonSession(supabase, parsed.data.sessionId, user.id)
  return new Response(JSON.stringify({ ok: true }), { status: 200 })
}
```

---

### P3 — Simplicity & Accessibility

#### 026: Unnecessary `useCallback` wrapping a single expression

`handlePauseAndExit` was a `useCallback` whose entire body was `router.push('/home')`. `router` is already a stable reference from `useRouter`. Inlined at the single call site.

```tsx
// Before: const handlePauseAndExit = useCallback(() => router.push('/home'), [router])
// After: inline at onPause prop
onPause={() => router.push('/home')}
```

#### 027: Hidden sheet elements keyboard-accessible via CSS transform

`ExitConfirmationSheet` was always in the DOM (for the slide animation) but had no accessibility guard. Keyboard users could Tab into the buttons when the sheet was visually hidden at the bottom of the viewport.

React 19 natively types `inert` as boolean. No TypeScript augmentation needed.

```tsx
<div
  className={cn(..., open ? 'translate-y-0' : 'translate-y-full')}
  aria-hidden={!open}
  inert={!open}   // React 19 — prevents focus, click, and AT access
>
```

`aria-hidden` handles the semantics/AT tree. `inert` handles keyboard focus and pointer events. Both are required — `aria-hidden` alone does not block Tab focus.

---

## Prevention

### React: `createClient()` in dependency arrays

- Never call `createClient()` inside a component body and include the result in `useCallback`/`useMemo`/`useEffect` deps.
- If a Supabase client is needed inside a handler, call `createClient()` inside the handler body — it returns the singleton, so it is cheap and referentially fresh each call.
- The linter catches missing deps (`react-hooks/exhaustive-deps`) but NOT included-but-unstable deps. Code review must catch this pattern explicitly.

**Code review checklist:**
- [ ] `createClient()` not in a `useCallback`/`useMemo` dependency array
- [ ] No `// eslint-disable-next-line react-hooks/exhaustive-deps` masking an instability — fix the stability instead

### Derived booleans computed multiple times

- Derive once at the top of the component (or `useMemo`), consume everywhere below.
- Grep the file for the expression before approving a PR — duplicate is a signal to extract.

### Agent parity

- Every user-visible state mutation must have a corresponding API route.
- The test: "Can a Claude agent complete this action via HTTP requests alone?" If no, add the route.
- New routes: Zod-validate body, `createServerClient` for auth, ownership check before mutating.

### Session mutation ownership guard

- Every `supabase.from('sessions').update/delete` must chain `.eq('user_id', userId)`.
- Mutation helpers must accept `userId: string` as a required parameter — never inferred from context.

### `aria-hidden` + `inert` for off-screen elements

- CSS-transform-hidden panels must carry `aria-hidden={!visible}` and `inert={!visible}` toggled from the same state variable driving the CSS class.
- Test: Tab through the page when the panel is "hidden" — keyboard focus must not enter it.

### Silent `.catch(() => {})`

- Empty catch blocks are never acceptable. At minimum: `captureException` or `console.error`.
- Enable `@typescript-eslint/no-floating-promises: 'warn'` — catches unawaited promises.

---

## Detection

```bash
# createClient() in component body (candidate for dep array instability)
grep -rln "createClient" --include="*.tsx" components/ | xargs grep -l "'use client'"

# Silent empty catch blocks
grep -rn "catch(() => {})\|catch((_) => {})" --include="*.ts" --include="*.tsx" app/ components/ lib/

# Off-screen transform without aria-hidden (manual review needed)
grep -rn "translate-x-full\|translate-y-full" --include="*.tsx" app/ components/

# Session mutations missing user_id filter
grep -rn "from('sessions')" --include="*.ts" app/api/ lib/supabase/ | grep "\.update\|\.delete"

# UI direct DB writes without an API route counterpart
grep -rn "\.from(" --include="*.tsx" components/ | grep "insert\|update\|delete"
```

---

## Related Docs

- [breathing-orb-optimization.md](../performance-issues/breathing-orb-optimization.md) — reference instability: inline style objects recreated every render
- [rls-auth-data-leak-fix.md](../security-issues/rls-auth-data-leak-fix.md) — session mutation ownership: `auth.uid() = user_id` in RLS + app layer
- [20260219-react-hooks-security-db-hygiene-multi-pass-review.md](../code-review-fixes/20260219-react-hooks-security-db-hygiene-multi-pass-review.md) — stale closures via `useRef`, agent parity (missing pulse-check API), `prefers-reduced-motion` accessibility

## Work Log

- 2026-02-19: Documented from PR #20 code review resolution (todos 019–027)
