---
title: "feat: Unified suggestion pills with AI-generated replies"
type: feat
date: 2026-02-19
brainstorm: Docs/brainstorms/2026-02-19-unified-suggestion-pills-brainstorm.md
---

# Unified Suggestion Pills with AI-Generated Replies

## Overview

Replace three separate pill/button components (`SuggestedReplyButtons`, `QuickReplyButtons`, `StateQuickReplies`) with one unified `SuggestionPills` component. Add `[SUGGESTED_REPLIES]` instructions to all Sage prompts so every response includes 3 AI-generated suggested user replies. Cap all pill displays at 3, truncate long text, and apply the same component to onboarding.

## Problem Statement

1. **No suggested replies in regular conversations** — the `[SUGGESTED_REPLIES]` parser exists but no prompt instructs Sage to generate them. Users must always type or voice-record.
2. **Pill overflow on mobile** — domain pills show all unexplored domains (up to 8), requiring horizontal scroll that's awkward on phones.
3. **Three inconsistent components** — different layouts (flex-wrap vs overflow-x-auto), different styling, different prop shapes. Maintenance burden and visual inconsistency.

## Proposed Solution

**Hybrid approach:** AI-generated pills for conversational moments + client-side logic for domain navigation. One rendering component for all pill use cases.

## Technical Approach

### Phase 1: Create `SuggestionPills` Component

Create `components/chat/suggestion-pills.tsx` — the single unified component.

**Props:**
```typescript
interface SuggestionPill {
  label: string       // Display text (truncated visually)
  value: string       // Full text sent on tap (may differ from label)
  variant?: 'default' | 'primary'
}

interface SuggestionPillsProps {
  pills: SuggestionPill[]   // Max 3, enforced by component (.slice(0, 3))
  onSelect: (value: string) => void
  disabled?: boolean
}
```

**Why `label` + `value`?** Domain pills display "Health" but send "Let's explore Health". AI pills display truncated text but send the full text.

**Layout & Styling:**
- Container: `flex gap-2 px-4 py-2` — single row, no wrap, no scroll
- Pill: `rounded-full text-sm font-medium min-h-[44px] px-4 py-2.5`
- Each pill: `flex-1 min-w-0 truncate` — equal width, text truncates with ellipsis
- Default variant: `bg-bg border border-border text-text` → hover `bg-primary text-white`
- Primary variant: `bg-primary border-primary text-white` → hover `bg-primary-hover`
- Active: `active:scale-95 transition-transform`
- Animation: `animate-fade-up` (existing utility, 0.3s ease-out)
- Use `cn()` helper for conditional classes

**Performance (from institutional learnings):**
- Extract any inline style objects to module-level constants
- Component is a leaf — no need for `React.memo` unless profiling shows issues
- Parent must memoize `pills` array with `useMemo` to prevent unnecessary re-renders during streaming

**Accessibility:**
- 44px min touch target (enforced by `min-h-[44px]`)
- When pills are hidden/disabled: use `aria-hidden` + `inert`
- Add `prefers-reduced-motion` media query to `animate-fade-up` in `globals.css` if not already present

**Files:**
- **Create:** `components/chat/suggestion-pills.tsx`

### Phase 2: Add `[SUGGESTED_REPLIES]` to All Prompts

Add instruction to all Sage prompts so every response ends with 3 suggested user replies.

**Instruction text (shared constant in `prompts.ts`):**
```
SUGGESTED REPLIES FORMAT:
Always end your response with a [SUGGESTED_REPLIES] block containing exactly 3 short
suggested user replies (3-6 words each). Write them in the user's voice — what they
might naturally say next. Offer variety: one that deepens the current topic, one that
shifts direction, and one that acknowledges or wraps the point.

Exception: Do NOT include [SUGGESTED_REPLIES] if your message is a session wrap-up or
final synthesis (i.e., when you are ending the conversation).

Example:
[SUGGESTED_REPLIES]
Tell me more about that
Let's switch to relationships
Yeah, that resonates
[/SUGGESTED_REPLIES]
```

**Where to add:**

| Source | File | Action |
|---|---|---|
| `getLifeMappingPrompt()` | `lib/ai/prompts.ts:32` | Append shared constant |
| `getWeeklyCheckinBasePrompt()` | `lib/ai/prompts.ts:309` | Append shared constant |
| `getAdHocPrompt()` | `lib/ai/prompts.ts:387` | Append shared constant |
| `getCloseDayPrompt()` | `lib/ai/prompts.ts:247` | Append shared constant |
| `skills/open-day.md` | `skills/open-day.md` | Already has it (lines 69-74, 86-91) — verify format matches |
| `skills/close-day.md` | `skills/close-day.md` | Add instruction |

**Implementation approach:** Define `SUGGESTED_REPLIES_FORMAT` as a shared constant in `prompts.ts` (like existing `FILE_UPDATE_FORMAT`). Append to each prompt function's output. For skill-based prompts loaded from `.md` files, append in `buildConversationContext()` (`lib/ai/context.ts:350-352`).

**Parser enforcement:** Add `.slice(0, 3)` in the parser (`lib/ai/parser.ts:357`) to cap at 3 even if Sage generates more.

**Files:**
- **Edit:** `lib/ai/prompts.ts` — add `SUGGESTED_REPLIES_FORMAT` constant, append to all 4 prompt functions
- **Edit:** `lib/ai/context.ts` — append instruction for skill-based prompts in `buildConversationContext()`
- **Edit:** `skills/close-day.md` — add `[SUGGESTED_REPLIES]` instruction
- **Edit:** `lib/ai/parser.ts` — add `.slice(0, 3)` cap

### Phase 3: Wire Up `SuggestionPills` in Chat View

Replace all three pill variants in `chat-view.tsx` with the unified component.

**Priority/conflict resolution (explicit suppression):**
1. `IntentionCard` — highest priority, renders as card not pills
2. AI `[SUGGESTED_REPLIES]` — if present, suppress domain pills and state pills
3. Domain quick replies — only if no AI suggestions AND last message has domain card AND life_mapping session
4. State-based replies — only on opening message with no user messages AND no AI suggestions

**Data transformation in chat-view.tsx:**

```typescript
// AI-suggested replies → pills
const aiPills: SuggestionPill[] = useMemo(() =>
  suggestedReplies?.data.replies.map(r => ({
    label: r,
    value: r,
  })) ?? [],
  [suggestedReplies]
)

// Domain replies → pills (top 3 by pulse rating)
const domainPills: SuggestionPill[] = useMemo(() => {
  const unexplored = ALL_DOMAINS.filter(d => !domainsExplored.has(d))
  const sorted = unexplored.sort((a, b) => /* pulse rating ascending */)
  const top3 = sorted.slice(0, suggestWrapUp ? 2 : 3)
  const pills = top3.map(d => ({ label: d, value: `Let's explore ${d}` }))
  if (suggestWrapUp) {
    pills.push({ label: 'Wrap up & synthesize', value: 'Wrap up & synthesize', variant: 'primary' })
  }
  return pills
}, [domainsExplored, pulseCheckRatings, suggestWrapUp])

// State-based replies → pills
const statePills: SuggestionPill[] = useMemo(() => {
  // switch on sessionState, return appropriate pills
}, [sessionState])
```

**Disable pills while streaming:** Pass `disabled={isStreaming}` — pills appear after streaming completes (existing behavior preserved).

**Disable pills after session end:** If session is complete/closed, don't render pills at all.

**Remove `StateQuickReplies` inline component** (lines 62-121 in chat-view.tsx) — logic moves to `useMemo` above.

**Files:**
- **Edit:** `components/chat/chat-view.tsx` — replace all pill rendering with `SuggestionPills`, remove `StateQuickReplies`, update imports
- **Delete:** `components/chat/suggested-reply-buttons.tsx`
- **Delete:** `components/chat/quick-reply-buttons.tsx`

### Phase 4: Unify Onboarding Pills

Replace the full-width stacked buttons in `mini-conversation.tsx` with `SuggestionPills`.

**Changes:**
- Cap each exchange step at 3 options (review existing scripts — some already have 2-3, trim any with 4+)
- Replace `ExchangeCard` button rendering with `SuggestionPills` component
- Keep framer-motion stagger animation on the pills container (wrap `SuggestionPills` in `motion.div`)
- Layout changes from vertical stack to horizontal pill row

**Review onboarding scripts for 3-pill fit:**
- `EXCHANGE_1_SCRIPTS` (intent selection) — currently has 5 intents, needs reduction to 3 most common or a different UX pattern
- `EXCHANGE_2` onwards — verify each has ≤3 options

**Decision needed:** If onboarding intent selection (5 options) can't reasonably be cut to 3, keep that specific step as-is and only unify subsequent steps. This is a pragmatic exception.

**Files:**
- **Edit:** `components/onboarding/mini-conversation.tsx` — replace button rendering with `SuggestionPills`, review option counts

## Acceptance Criteria

### Functional Requirements
- [x] `SuggestionPills` component renders max 3 pills in a single row
- [x] Long pill text truncates with ellipsis; full text sends on tap
- [x] AI-generated suggestions appear after every Sage message (except session-closing messages)
- [x] Domain pills during life mapping show top 3 by pulse rating
- [x] "Wrap up" pill appears with `primary` variant after 3+ domains explored
- [x] State-based pills show on opening message when no user messages exist
- [x] Priority order enforced: intention cards > AI suggestions > domain pills > state pills
- [x] Pills disabled during streaming, hidden after session end
- [x] Onboarding uses unified pills (trimmed to 3 options per step)

### Non-Functional Requirements
- [x] 44px minimum touch targets on all pills
- [x] `prefers-reduced-motion` respected for fade-up animation
- [x] Pills array guarded by `!isStreaming` check — no computation during streaming re-renders
- [x] No horizontal scroll, no wrapping — 3 pills always fit in one row
- [x] Passes `npm run build` and `npm run type-check`

## Dependencies & Risks

**Low risk:** Parser already handles `[SUGGESTED_REPLIES]` — just needs prompt additions.

**Medium risk:** Onboarding has 5 intent options in exchange 1 — may need a carve-out or UX redesign for that step.

**Token cost:** Each Sage response adds ~30-50 tokens for the `[SUGGESTED_REPLIES]` block. Negligible per-message but compounds over long sessions.

## References

### Internal References
- Brainstorm: `Docs/brainstorms/2026-02-19-unified-suggestion-pills-brainstorm.md`
- Existing components: `components/chat/suggested-reply-buttons.tsx`, `components/chat/quick-reply-buttons.tsx`
- Chat view rendering: `components/chat/chat-view.tsx:1076-1153`
- Parser: `lib/ai/parser.ts:344-362` (main), `lib/ai/parser.ts:498-518` (streaming)
- Prompts: `lib/ai/prompts.ts`, `lib/ai/context.ts:326-368`
- Onboarding: `components/onboarding/mini-conversation.tsx`
- Design system: `.claude/skills/meos-design/SKILL.md`

### Institutional Learnings Applied
- CSS Grid height constraints: `docs/solutions/ui-bugs/chat-input-pushed-offscreen-css-grid-height.md`
- Streaming re-render optimization: `docs/solutions/performance-issues/react-component-memory-leaks-and-rerender-optimization.md`
- Code review checklist: `docs/solutions/code-review-fixes/20260219-react-hooks-security-db-hygiene-multi-pass-review.md`
