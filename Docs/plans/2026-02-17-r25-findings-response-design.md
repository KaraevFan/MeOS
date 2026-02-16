# R2.5 Playtest Findings — Response Design

**Date:** 2026-02-17
**Source:** `Docs/feedback/20260217_R2.5_findings.md`
**Status:** Approved

---

## Scope

Full pass on all R2.5 findings: P0 session persistence, P1 intake restyle + pulse check polish, P2 quick-reply contrast + back button + message spacing.

---

## P0: Session Persistence / Return to Active Conversation

### Problem

Navigating away from the onboarding life-mapping conversation makes it impossible to return. The home orb routes to `/chat?type=ad_hoc` (new session). No "Resume" affordance exists.

### Design

**Active session detection** — new `getActiveSession(userId)` in `lib/supabase/sessions.ts`:
- Queries `sessions` for `status = 'active'` AND `user_id = userId`
- Returns session row (id, type, created_at) or null
- Enforces single-active-session invariant

**Routing changes at all chat entry points:**

| Entry point | Current | New |
|---|---|---|
| Home orb (post-onboarding) | `/chat?type=ad_hoc` | If active session → `/chat?session=<id>`, else `/chat?type=ad_hoc` |
| Chat tab | `/chat` (state detection) | Same, but ChatView prioritizes `?session=` param |
| "Start check-in" button | `/chat?type=weekly_checkin` | Unchanged (intentional new session) |
| Domain CTA "Talk to Sage" | `/chat?type=ad_hoc&explore=<domain>` | If active session → `/chat?session=<id>`, else keep current |

**ChatView changes** (`components/chat/chat-view.tsx`):
- New prop/param: `sessionId` (optional)
- If `sessionId` provided → load that exact session + messages
- If no `sessionId` → existing behavior (find or create by type)
- On session completion → clear active session, navigate home

**Home screen "Continue" card** — new `ActiveSessionCard` component:
- Shown when `getActiveSession()` returns a session
- Replaces the orb/Talk to Sage CTA
- Shows: "Continue your conversation with Sage" + session type context + time since last message
- Links to `/chat?session=<id>`

**Edge cases:**
- Browser refresh → URL has `?session=<id>`, ChatView loads it (messages already persisted in real-time)
- App killed → Home screen checks for active session, shows Continue card
- User wants to abandon → "Start new conversation" secondary link below Continue card; completes/abandons current session first
- Stale sessions → Optional: auto-complete sessions older than 24h with `status = 'active'` on next app load

**Files:**
- `lib/supabase/sessions.ts` — add `getActiveSession()`
- `app/(main)/chat/page.tsx` — handle `?session=` param
- `components/chat/chat-view.tsx` — accept `sessionId` prop
- `components/home/pre-onboarding-hero.tsx` — smart routing
- `app/(main)/home/page.tsx` — ActiveSessionCard display logic
- New: `components/home/active-session-card.tsx`

---

## P1.1: Intake Form Restyle (Option A — Own the Form)

### Problem

The mini-conversation step (step 3 of onboarding) uses chat-bubble UI with only multiple-choice buttons. Creates uncanny valley — looks conversational, behaves like a form.

### Design

Restyle `MiniConversation` from chat-bubble layout to a warm card layout. **Only step 3 needs restyling** — steps 1, 2, 4, 5 are already card-based.

**Layout per exchange:**
- Sage's question as a heading (18-20px, `text-text`, medium weight), centered
- Subtext/context line below (14px, `text-text-secondary`)
- Options as large pill buttons, stacked vertically (full-width, 48px height, warm styling)
- Selected option fills with `bg-primary` + white text
- Card transitions (slide/fade) between exchanges, using existing Framer Motion patterns

**Visual identity:**
- Same cream background as other onboarding steps
- No avatar, no message bubbles, no chat-like elements
- Sage's voice comes through in copy, not UI frame
- Subtle progress indicator (step dots or thin bar)

**The "upgrade moment":** First time the user sees chat UI is when Sage actually speaks — makes it feel like a distinct, richer experience.

**Data flow unchanged:** Same branching logic, same `quickReplies` array, same `sessionStorage` persistence.

**Files:**
- `components/onboarding/onboarding-flow.tsx` — restyle MiniConversation section

---

## P1.2: Pulse Check Polish

### Current State

`rating-scale.tsx`: Five 44px circles on a connecting line, uniform `bg-bg/60` fill, uniform amber on selection, "ROUGH"/"THRIVING" labels, 400ms auto-advance.

### Design

**1. Color gradient hint on unselected circles:**
- Circle 1 (Rough): `bg-status-crisis/15` — faint warm red
- Circle 2 (Struggling): `bg-status-attention/15` — faint terracotta
- Circle 3 (Okay): `bg-primary/15` — faint amber
- Circle 4 (Good): `bg-accent-sage/15` — faint sage
- Circle 5 (Thriving): `bg-accent-sage/20` — slightly stronger sage
- Connecting line: subtle left-to-right gradient (warm red → sage green, ~10% opacity)

**2. Status-colored tap feedback:**
- 1: `bg-status-crisis` (muted red #B05A5A)
- 2: `bg-status-attention` (terracotta #C17B5D)
- 3: `bg-primary` (amber — unchanged for middle)
- 4: `bg-accent-sage` (sage green #7D8E7B)
- 5: `bg-accent-sage` with brighter glow shadow
- Glow shadow and selected label text match the status color

**3. Tighter spacing:**
- Reduce vertical gap between domain name and rating scale
- Reduce gap between scale and selected label text
- Keep domain descriptor (italic subtext) but tighten margin
- Card should feel compact — less "floating in a void"

**Files:**
- `components/onboarding/rating-scale.tsx`

---

## P2: Polish Items

### 1. Quick-reply button contrast

**Current:** `bg-bg` with `border-border` — blends into cream background.

**Fix:**
- Border: `border-border-warm` (slightly darker)
- Add `shadow-sm` for gentle lift
- Font weight: `font-medium` (500) from normal (400)
- Keep existing hover/active states

**File:** `components/chat/quick-reply-buttons.tsx`

### 2. Back button behavior

Verify the `‹` chevron navigates to previous onboarding step, not exits the flow. Fix if it calls `router.back()` instead of decrementing step state.

**File:** `components/onboarding/onboarding-flow.tsx`

### 3. Message spacing

**Current:** 16px spacing (`space-y-4`) between all messages. Quick replies at scroll bottom with potential large gaps.

**Fix:**
- Quick-reply buttons anchored closer to last message — reduce top margin
- Message container uses `flex-col justify-end` so content gravity pulls downward (standard chat pattern)
- Less dead space between Sage's message and quick-reply options

**Files:** `components/chat/chat-view.tsx`, `components/chat/quick-reply-buttons.tsx`
