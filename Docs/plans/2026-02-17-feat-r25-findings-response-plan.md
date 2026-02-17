# R2.5 Playtest Findings — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the ship-blocking session persistence bug, restyle the intake flow as a card-based form, polish the pulse check rating UI, and address P2 polish items (quick-reply contrast, back button, message spacing).

**Architecture:** P0 adds a type-agnostic active session lookup + `?session=<id>` URL param so ChatView can resume any session by ID. Home screen conditionally shows an ActiveSessionCard when an active session exists. P1 restyles MiniConversation from chat bubbles to card-based UI, and adds status colors + gradient hints to the pulse check circles. P2 tightens visual polish across quick-reply buttons and message layout.

**Tech Stack:** Next.js 14 (App Router), Tailwind CSS, Framer Motion, Supabase (Postgres)

**Design doc:** `Docs/plans/2026-02-17-r25-findings-response-design.md`

---

## Task 1: Add type-agnostic `findActiveSession()` to session helpers

**Files:**
- Modify: `lib/supabase/sessions.ts`

**Step 1: Add `findActiveSession` function**

Add this function after the existing `getActiveSession` (line 34):

```typescript
export async function findActiveSession(
  supabase: SupabaseClient,
  userId: string
) {
  const { data, error } = await supabase
    .from('sessions')
    .select('id, session_type, status, created_at, updated_at')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data
}
```

Note: This differs from the existing `getActiveSession` by NOT filtering on `session_type` and NOT loading messages. It's a lightweight lookup for routing decisions.

**Step 2: Verify it compiles**

Run: `npm run type-check`
Expected: PASS

**Step 3: Commit**

```bash
git add lib/supabase/sessions.ts
git commit -m "feat: add findActiveSession() for type-agnostic session lookup"
```

---

## Task 2: Handle `?session=<id>` param in chat page

**Files:**
- Modify: `app/(main)/chat/page.tsx`

**Step 1: Add `session` to searchParams type**

At line 13, add `session` to the searchParams type:

```typescript
searchParams: Promise<{ type?: string; explore?: string; nudge?: string; session_context?: string; session?: string }>
```

**Step 2: Load the target session when `?session=` is provided**

After `const params = await searchParams` (line 22), add early session loading:

```typescript
  // If a specific session ID is provided, load it directly
  if (params.session) {
    const { data: targetSession } = await supabase
      .from('sessions')
      .select('id, session_type, status')
      .eq('id', params.session)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (targetSession) {
      const targetType = targetSession.session_type as SessionType

      // Load commitments if it's a check-in
      let targetCommitments: Commitment[] = []
      if (targetType === 'weekly_checkin') {
        try {
          const lifePlan = await new UserFileSystem(supabase, user.id).readLifePlan()
          if (lifePlan) {
            targetCommitments = extractCommitments(lifePlan.content)
          }
        } catch {
          // Graceful fallback
        }
      }

      return (
        <div className="fixed inset-0 bottom-16 pb-[env(safe-area-inset-bottom)]">
          <ChatView
            userId={user.id}
            sessionType={targetType}
            resumeSessionId={targetSession.id}
            initialCommitments={targetCommitments}
          />
        </div>
      )
    }
    // If session not found/not active, fall through to normal routing
  }
```

**Step 3: Verify it compiles**

Run: `npm run type-check`
Expected: Will fail because `resumeSessionId` prop doesn't exist on ChatView yet — that's Task 3.

**Step 4: Commit (WIP)**

```bash
git add app/\(main\)/chat/page.tsx
git commit -m "feat: handle ?session= param for direct session resume in chat page"
```

---

## Task 3: Update ChatView to accept and use `resumeSessionId` prop

**Files:**
- Modify: `components/chat/chat-view.tsx`

**Step 1: Add `resumeSessionId` to ChatViewProps**

At line 38 (in `ChatViewProps`), add:

```typescript
  resumeSessionId?: string
```

**Step 2: Update the component signature**

At line 130, add `resumeSessionId` to the destructured props:

```typescript
export function ChatView({ userId, sessionType = 'life_mapping', initialSessionState, initialCommitments, exploreDomain, nudgeContext, sessionContext, resumeSessionId }: ChatViewProps) {
```

**Step 3: Update the `init()` function to prioritize `resumeSessionId`**

In the `init()` function (line 174), at the start of the try block (line 176), add a branch for resumeSessionId BEFORE the existing active session check:

```typescript
        // Priority 1: Resume a specific session by ID
        if (resumeSessionId) {
          const { data: targetSession } = await supabase
            .from('sessions')
            .select('*')
            .eq('id', resumeSessionId)
            .eq('user_id', userId)
            .eq('status', 'active')
            .single()

          if (targetSession) {
            setSessionId(targetSession.id)

            const { data: existingMessages } = await supabase
              .from('messages')
              .select('*')
              .eq('session_id', targetSession.id)
              .order('created_at', { ascending: true })

            if (existingMessages && existingMessages.length > 0) {
              setMessages(existingMessages.map((m) => ({
                id: m.id,
                sessionId: m.session_id,
                role: m.role as 'user' | 'assistant',
                content: m.content,
                hasStructuredBlock: m.has_structured_block,
                createdAt: m.created_at,
              })))

              if (targetSession.domains_explored) {
                setDomainsExplored(new Set(targetSession.domains_explored as DomainName[]))
              }
            }

            setIsLoading(false)
            return
          }
          // If target session not found, fall through to normal init
        }
```

This goes at the top of the `try` block, before the existing `const { data: activeSession } = await supabase...` query.

**Step 4: Add `resumeSessionId` to the useEffect dependency array**

At line 391, update the deps:

```typescript
  }, [userId, sessionType, resumeSessionId])
```

**Step 5: Verify it compiles**

Run: `npm run type-check`
Expected: PASS

**Step 6: Commit**

```bash
git add components/chat/chat-view.tsx
git commit -m "feat: ChatView accepts resumeSessionId to load specific session"
```

---

## Task 4: Smart routing on home screen + ActiveSessionCard

**Files:**
- Modify: `app/(main)/home/page.tsx`
- Modify: `lib/supabase/home-data.ts`
- Modify: `components/home/pre-onboarding-hero.tsx`
- Create: `components/home/active-session-card.tsx`

**Step 1: Add active session data to HomeData**

In `lib/supabase/home-data.ts`, add to the `HomeData` interface (around line 13):

```typescript
  activeSessionId: string | null
  activeSessionType: string | null
```

In the `getHomeData` function, after the user profile query (around line 107), add a query for active sessions:

```typescript
  // Check for active session
  let activeSessionId: string | null = null
  let activeSessionType: string | null = null

  if (onboardingCompleted) {
    const { data: activeSession } = await supabase
      .from('sessions')
      .select('id, session_type')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (activeSession) {
      activeSessionId = activeSession.id
      activeSessionType = activeSession.session_type
    }
  }
```

Add those fields to the return object at the end (around line 229):

```typescript
    activeSessionId,
    activeSessionType,
```

**Step 2: Create ActiveSessionCard component**

Create `components/home/active-session-card.tsx`:

```typescript
'use client'

import Link from 'next/link'
import { BreathingOrb } from '@/components/ui/breathing-orb'

interface ActiveSessionCardProps {
  sessionId: string
  sessionType: string
}

const SESSION_TYPE_LABELS: Record<string, string> = {
  life_mapping: 'life mapping',
  weekly_checkin: 'weekly check-in',
  ad_hoc: 'conversation',
}

export function ActiveSessionCard({ sessionId, sessionType }: ActiveSessionCardProps) {
  const typeLabel = SESSION_TYPE_LABELS[sessionType] || 'conversation'

  return (
    <div className="flex flex-col items-center gap-md py-md">
      <Link href={`/chat?session=${sessionId}`}>
        <BreathingOrb />
      </Link>
      <Link
        href={`/chat?session=${sessionId}`}
        className="text-sm font-medium text-primary hover:text-primary-hover transition-colors"
      >
        Continue your {typeLabel}
      </Link>
      <Link
        href="/chat?type=ad_hoc"
        className="text-xs text-text-secondary/60 hover:text-text-secondary transition-colors"
      >
        Start new conversation
      </Link>
    </div>
  )
}
```

**Step 3: Update home page to show ActiveSessionCard**

In `app/(main)/home/page.tsx`, add the import:

```typescript
import { ActiveSessionCard } from '@/components/home/active-session-card'
```

Replace the Talk to Sage section at the bottom (line 142):

```typescript
        {/* 7. Talk to Sage / Resume */}
        {homeData.activeSessionId ? (
          <ActiveSessionCard
            sessionId={homeData.activeSessionId}
            sessionType={homeData.activeSessionType!}
          />
        ) : (
          <TalkToSageOrb />
        )}
```

**Step 4: Update TalkToSageOrb to also check for active session**

In `components/home/pre-onboarding-hero.tsx`, the `TalkToSageOrb` currently always routes to `/chat?type=ad_hoc`. This is a fallback — the main smart routing happens via `ActiveSessionCard` in the home page. No change needed here since it's only shown when there's NO active session.

**Step 5: Verify it compiles**

Run: `npm run type-check`
Expected: PASS

**Step 6: Commit**

```bash
git add lib/supabase/home-data.ts components/home/active-session-card.tsx app/\(main\)/home/page.tsx
git commit -m "feat: show ActiveSessionCard on home when conversation is in progress"
```

---

## Task 5: Restyle MiniConversation as card-based form

**Files:**
- Modify: `components/onboarding/mini-conversation.tsx`

**Step 1: Replace the chat-bubble UI with card-based layout**

Rewrite `mini-conversation.tsx`. The key changes:
- Remove `SageMessage` and `UserMessage` components entirely
- Replace with a card-per-exchange layout
- Sage's question becomes a heading, options become vertically stacked pills
- Selected option shows a check/selected state then transitions to next exchange
- Keep all branching logic, phase management, typing delays, and data flow identical

Replace the content area (the chat area `<div ref={scrollRef}` and the `QuickReplyBar` section) with:

```tsx
      {/* Card content area */}
      <div
        ref={scrollRef}
        className="flex-1 flex flex-col items-center justify-center px-6 overflow-y-auto"
      >
        <AnimatePresence mode="wait" custom={direction}>
          {/* Exchange 1 */}
          {(phase === 'typing_exchange1' || phase === 'showing_exchange1' || (!exchange1Reply && phase !== 'complete')) && (
            <motion.div
              key="exchange1"
              custom={direction}
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -60 }}
              transition={{ duration: 0.35 }}
              className="w-full max-w-sm text-center"
            >
              {phase === 'typing_exchange1' ? (
                <TypingIndicator />
              ) : (
                <>
                  <h2 className="text-lg font-medium text-text leading-snug mb-8">
                    {exchange1.sageMessage}
                  </h2>
                  <div className="flex flex-col gap-2.5">
                    {exchange1.quickReplies.map((option, i) => (
                      <motion.button
                        key={option}
                        type="button"
                        onClick={() => handleQuickReply(1, option)}
                        className="w-full text-left px-4 py-3.5 rounded-2xl border-[1.5px] border-border bg-bg text-[15px] text-text leading-snug active:bg-primary active:text-white active:border-primary transition-colors"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: i * 0.06 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {option}
                      </motion.button>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* Exchange 2 */}
          {exchange1Reply && (phase === 'typing_exchange2' || phase === 'showing_exchange2') && !exchange2Reply && (
            <motion.div
              key="exchange2"
              custom={direction}
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -60 }}
              transition={{ duration: 0.35 }}
              className="w-full max-w-sm text-center"
            >
              {phase === 'typing_exchange2' ? (
                <TypingIndicator />
              ) : (
                <>
                  <h2 className="text-lg font-medium text-text leading-snug mb-8">
                    {EXCHANGE_2.sageMessage}
                  </h2>
                  <div className="flex flex-col gap-2.5">
                    {EXCHANGE_2.quickReplies.map((option, i) => (
                      <motion.button
                        key={option}
                        type="button"
                        onClick={() => handleQuickReply(2, option)}
                        className="w-full text-left px-4 py-3.5 rounded-2xl border-[1.5px] border-border bg-bg text-[15px] text-text leading-snug active:bg-primary active:text-white active:border-primary transition-colors"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: i * 0.06 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {option}
                      </motion.button>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* Clarification */}
          {exchange2Reply && exchange2Reply.selectedOption === 'What do you mean by "gut rating"?' && (phase === 'typing_clarification' || phase === 'showing_clarification') && !clarificationReply && (
            <motion.div
              key="clarification"
              custom={direction}
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -60 }}
              transition={{ duration: 0.35 }}
              className="w-full max-w-sm text-center"
            >
              {phase === 'typing_clarification' ? (
                <TypingIndicator />
              ) : (
                <>
                  <h2 className="text-lg font-medium text-text leading-snug mb-8">
                    {CLARIFICATION.sageMessage}
                  </h2>
                  <div className="flex flex-col gap-2.5">
                    {CLARIFICATION.quickReplies.map((option, i) => (
                      <motion.button
                        key={option}
                        type="button"
                        onClick={() => handleQuickReply(3, option)}
                        className="w-full text-left px-4 py-3.5 rounded-2xl border-[1.5px] border-border bg-bg text-[15px] text-text leading-snug active:bg-primary active:text-white active:border-primary transition-colors"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: i * 0.06 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {option}
                      </motion.button>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
```

Add a `direction` state (initialized to `1`) to manage the enter/exit animation direction.

Remove `SageMessage`, `UserMessage` components and the `QuickReplyBar` component.

Remove the old `TypingIndicator` — replace with a centered version:

```tsx
function TypingIndicator() {
  return (
    <div className="flex items-center justify-center gap-1.5 py-8">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-2 h-2 rounded-full bg-text-secondary/40"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{
            duration: 1,
            repeat: Infinity,
            delay: i * 0.2,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}
```

**Step 2: Verify it compiles**

Run: `npm run type-check`
Expected: PASS

**Step 3: Visually verify**

Run: `npm run dev`
Navigate to `/onboarding`, complete intro and intent screens, verify:
- Mini-conversation shows question as heading (not chat bubble)
- Options are stacked pills (not quick-reply buttons)
- Transitions between exchanges use slide animation
- Back button works (goes to intent selection)
- Data flow is unchanged (quickReplies captured correctly)

**Step 4: Commit**

```bash
git add components/onboarding/mini-conversation.tsx
git commit -m "feat: restyle MiniConversation as card-based form (no chat pretense)"
```

---

## Task 6: Pulse check — color gradient hints + status-colored feedback

**Files:**
- Modify: `components/onboarding/rating-scale.tsx`

**Step 1: Add color arrays for gradient hints and selected states**

At the top of the file, after `const LABELS`, add:

```typescript
// Gradient hint colors (unselected state) — subtle status preview
const HINT_COLORS = [
  'bg-status-crisis/15',     // Rough
  'bg-status-attention/15',  // Struggling
  'bg-primary/15',           // Okay
  'bg-accent-sage/15',       // Good
  'bg-accent-sage/20',       // Thriving
]

// Selected state colors
const SELECTED_COLORS = [
  'bg-status-crisis',     // Rough — #B05A5A
  'bg-status-attention',  // Struggling — #C17B5D
  'bg-primary',           // Okay — #D97706
  'bg-accent-sage',       // Good — #7D8E7B
  'bg-accent-sage',       // Thriving — #7D8E7B
]

// Selected glow shadows
const SELECTED_SHADOWS = [
  '0 0 12px rgba(176, 90, 90, 0.35)',
  '0 0 12px rgba(193, 123, 93, 0.35)',
  '0 0 12px rgba(212, 165, 116, 0.35)',
  '0 0 12px rgba(125, 142, 123, 0.35)',
  '0 0 14px rgba(125, 142, 123, 0.45)',
]

// Label text colors (match selected circle)
const LABEL_COLORS = [
  'text-status-crisis',
  'text-status-attention',
  'text-primary',
  'text-accent-sage',
  'text-accent-sage',
]
```

**Step 2: Update the unselected circle to use gradient hint**

Replace the unselected circle div (currently at line 44-48):

```tsx
              <div
                className={cn(
                  'w-[44px] h-[44px] rounded-full border-[1.5px] transition-opacity duration-200',
                  isSelected ? 'opacity-0' : `border-border opacity-100 ${HINT_COLORS[i]}`
                )}
              />
```

**Step 3: Update the selected circle to use status color + shadow**

Replace the selected indicator (currently at line 53-63):

```tsx
              {isSelected && (
                <motion.div
                  className="absolute inset-0 flex items-center justify-center"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', damping: 14, stiffness: 220 }}
                >
                  <div
                    className={cn('w-[44px] h-[44px] rounded-full', SELECTED_COLORS[i])}
                    style={{ boxShadow: SELECTED_SHADOWS[i] }}
                  />
                </motion.div>
              )}
```

**Step 4: Update the selected label to use matching color**

Replace the selected label (currently at line 74-76):

```tsx
            <motion.p
              key={value}
              className={cn('text-[13px] font-medium tracking-wide text-center', LABEL_COLORS[value])}
```

**Step 5: Replace the connecting line with a gradient**

Replace the connecting line div (line 29):

```tsx
        <div
          className="absolute inset-x-[22px] top-1/2 -translate-y-1/2 h-[1.5px] opacity-20"
          style={{
            background: 'linear-gradient(to right, #B05A5A, #C17B5D, #D97706, #7D8E7B, #7D8E7B)',
          }}
        />
```

**Step 6: Verify it compiles**

Run: `npm run type-check`
Expected: PASS

**Step 7: Commit**

```bash
git add components/onboarding/rating-scale.tsx
git commit -m "feat: pulse check gradient hints + status-colored tap feedback"
```

---

## Task 7: Pulse check — tighter spacing

**Files:**
- Modify: `components/onboarding/domain-card.tsx`
- Modify: `components/onboarding/rating-scale.tsx`

**Step 1: Tighten RatingScale internal spacing**

In `rating-scale.tsx`, change the outer container gap from `gap-4` to `gap-2.5` (line 15):

```tsx
    <div className="flex flex-col items-center gap-2.5">
```

Also reduce the selected label container height from `h-6` to `h-5` (line 71):

```tsx
      <div className="h-5">
```

**Step 2: Tighten DomainCard spacing**

In `domain-card.tsx`, reduce the margin between domain descriptor and rating scale from `mb-12` to `mb-8` (line 93):

```tsx
            className="text-[14px] text-text-secondary italic text-center mb-8"
```

Reduce the padding-bottom on the content area from `pb-20` to `pb-12` (line 61):

```tsx
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-12">
```

**Step 3: Verify it compiles**

Run: `npm run type-check`
Expected: PASS

**Step 4: Commit**

```bash
git add components/onboarding/rating-scale.tsx components/onboarding/domain-card.tsx
git commit -m "feat: tighter pulse check spacing — less floating-in-void"
```

---

## Task 8: P2 — Quick-reply button contrast

**Files:**
- Modify: `components/chat/quick-reply-buttons.tsx`
- Modify: `components/chat/chat-view.tsx` (StateQuickReplies)

**Step 1: Update QuickReplyButtons styling**

In `quick-reply-buttons.tsx`, update the domain button classes (line 37-41):

```tsx
            'flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium',
            'bg-bg border border-text-secondary/15 text-text shadow-sm',
            'hover:bg-primary hover:text-white hover:border-primary',
            'active:scale-95 transition-all duration-150',
            'disabled:opacity-50 disabled:cursor-not-allowed'
```

**Step 2: Update StateQuickReplies styling**

In `chat-view.tsx`, update `buttonClass` (line 54):

```typescript
  const buttonClass = 'flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium bg-bg border border-text-secondary/15 text-text shadow-sm hover:bg-primary hover:text-white hover:border-primary active:scale-95 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed'
```

**Step 3: Verify it compiles**

Run: `npm run type-check`
Expected: PASS

**Step 4: Commit**

```bash
git add components/chat/quick-reply-buttons.tsx components/chat/chat-view.tsx
git commit -m "fix: improve quick-reply button contrast with darker border + shadow"
```

---

## Task 9: P2 — Verify back button behavior

**Files:**
- Verify: `components/onboarding/mini-conversation.tsx`
- Verify: `components/onboarding/onboarding-flow.tsx`

**Step 1: Verify the back button in MiniConversation**

Check `mini-conversation.tsx` line 247: the back button calls `onBack()`.
Check `onboarding-flow.tsx` line 201-203: `handleConversationBack` calls `goBack('intent')`.
`goBack` (line 168-171) sets `direction = -1` and `setStep(prevStep)`.

This is correct — the back button goes to the intent selection step, not `router.back()`.

**Step 2: Verify DomainCard back button**

Check `domain-card.tsx` line 37: calls `onBack()`.
Check `onboarding-flow.tsx` line 222-229: `handleDomainBack` either decrements `domainIndex` or goes back to `'conversation'` step.

This is also correct.

**Step 3: Commit**

No code changes needed — back buttons are already wired correctly. Note this in the PR description.

---

## Task 10: P2 — Message spacing (content gravity + tighter quick-reply margins)

**Files:**
- Modify: `components/chat/chat-view.tsx`

**Step 1: Add bottom-gravity to the messages area**

At line 868, the messages container is:

```tsx
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
```

Wrap the content inside with a flex container that pushes content to the bottom:

```tsx
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        <div className="min-h-full flex flex-col justify-end space-y-4">
```

Close the inner div before the closing `</div>` of the scroll container (before line 1007).

This makes messages gravity-pull to the bottom of the viewport. When there's more content than fits, it scrolls normally. When there's less, the messages sit at the bottom like a real chat app.

**Step 2: Reduce quick-reply top margins**

In the `StateQuickReplies` component, all the outer `<div>` elements have `className="mt-3"`. Reduce to `mt-2` for tighter coupling to the last message:

Lines 65, 76, 85, 92 — change `mt-3` to `mt-2` in the return JSX of each case.

Similarly in the message render loop (line 894), the `showDomainQuickReplies` div has `mt-3` — change to `mt-2`.

**Step 3: Verify it compiles**

Run: `npm run type-check`
Expected: PASS

**Step 4: Visually verify**

Run: `npm run dev`
Navigate to an active chat. Verify:
- With few messages, content sits at the bottom (not top-aligned with dead space below)
- Quick replies sit tighter against the last message
- When scrolling is needed, behavior is unchanged

**Step 5: Commit**

```bash
git add components/chat/chat-view.tsx
git commit -m "fix: message spacing — content gravity + tighter quick-reply margins"
```

---

## Task 11: Final verification + type check

**Step 1: Full type check**

Run: `npm run type-check`
Expected: PASS

**Step 2: Lint check**

Run: `npm run lint`
Expected: PASS (fix any issues)

**Step 3: Dev server smoke test**

Run: `npm run dev`

Test checklist:
- [ ] Home screen shows ActiveSessionCard when a session is active
- [ ] Tapping "Continue" loads the existing conversation with all messages
- [ ] "Start new conversation" link works
- [ ] Onboarding intake uses card-based form (no chat bubbles)
- [ ] Pulse check circles show gradient hints
- [ ] Tapping a circle fills with status color + matching glow
- [ ] Spacing is tighter on pulse check screens
- [ ] Quick-reply buttons have better contrast in chat
- [ ] Messages gravity-pull to bottom of chat view
- [ ] Back buttons navigate within onboarding (don't exit)

**Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "chore: lint fixes and final verification"
```
