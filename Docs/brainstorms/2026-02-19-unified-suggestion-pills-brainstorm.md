# Unified Suggestion Pills

**Date:** 2026-02-19
**Status:** Ready for planning

## What We're Building

A unified suggestion pill system that provides quick-tap reply options across all conversation types (life mapping, weekly check-ins, onboarding). Currently there are three separate pill/button components with inconsistent behavior. This consolidates them into one component with a 3-pill limit, consistent styling, and AI-generated suggestions for conversational moments.

## Why This Approach (Hybrid: AI + Client-Side)

- **AI-generated conversational replies** — Sage ends every response with 3 suggested user replies via `[SUGGESTED_REPLIES]` blocks. These represent what the user might say next (deepening, redirecting, affirming). The parser infrastructure already exists; just needs prompt additions.
- **Client-side domain suggestions** — During life mapping, domain navigation pills remain logic-driven (top 3 unexplored domains sorted by pulse rating). Instant, no AI latency.
- **One rendering component** — `SuggestionPills` replaces `SuggestedReplyButtons`, `QuickReplyButtons`, and `StateQuickReplies`. Same styling, same 3-pill cap, same truncation everywhere.

Rejected alternatives:
- **Fully AI-driven (Approach A):** Cleaner but adds latency to domain suggestions that don't need AI.
- **Fully client-side (Approach C):** Fast but generic. Can't adapt to nuanced conversation context.

## Key Decisions

1. **3-pill maximum everywhere** — No scrolling, no wrapping. Sage picks the 3 best. Domain logic picks top 3. Onboarding capped at 3 per step.
2. **Truncation with ellipsis** — Pills truncate visually at ~25 chars. Full text sent on tap.
3. **AI generates after every Sage message** — Prompt instruction: "End every response with `[SUGGESTED_REPLIES]` containing exactly 3 short suggested user replies (3-6 words each). Make them distinct: one deepens, one redirects, one affirms/closes."
4. **Unified component for onboarding too** — Replace the larger hardcoded buttons in `mini-conversation.tsx` with the same pill component.
5. **Priority order when multiple sources exist:**
   - Intention cards (keep/change) > AI `[SUGGESTED_REPLIES]` > Domain quick replies > State-based replies

## Component Spec

### `SuggestionPills`
- **Props:** `suggestions: Array<{ text: string; variant?: 'default' | 'primary' }>`, `onSelect: (text: string) => void`
- **Layout:** `flex gap-2`, single row, no wrap, no horizontal scroll
- **Styling:** `rounded-full`, warm amber/cream palette, 44px min touch target, text-sm
- **Truncation:** CSS `text-overflow: ellipsis` with `max-width` per pill (~33% of container minus gaps)
- **Variants:** `default` (cream bg, border) and `primary` (amber bg, white text) for emphasis (e.g., "Wrap up")

### Prompt Addition
All Sage system prompts get this instruction appended:
```
Always end your response with a [SUGGESTED_REPLIES] block containing exactly 3 short
suggested user replies (3-6 words each). These should be written in the user's voice —
what they might naturally say next. Offer variety: one that goes deeper into the current
topic, one that shifts direction, and one that acknowledges/wraps the point.
```

### Domain Logic (Life Mapping)
- After domain card: show top 3 unexplored domains by pulse rating (struggling first)
- When 3+ domains explored: replace 3rd pill with "Wrap up & synthesize" (variant: `primary`)
- When fewer than 3 unexplored: show what's left + "Wrap up"

### Onboarding
- Same `SuggestionPills` component, max 3 options per conversation step
- Current onboarding steps that have 2-3 options just get restyled

## Components Affected

| Current Component | Action |
|---|---|
| `components/chat/suggested-reply-buttons.tsx` | Replace with `SuggestionPills` |
| `components/chat/quick-reply-buttons.tsx` | Replace with `SuggestionPills` |
| `StateQuickReplies` in `chat-view.tsx` | Replace with `SuggestionPills` |
| `components/onboarding/mini-conversation.tsx` | Swap buttons for `SuggestionPills` |
| `lib/ai/prompts.ts` (all session prompts) | Add `[SUGGESTED_REPLIES]` instruction |
| `lib/ai/parser.ts` | Already handles parsing (no changes needed) |

## Open Questions

None — all resolved during brainstorm.
