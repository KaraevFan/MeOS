# MeOS MVP — End-to-End Testing Plan

> First taste-test of the live build. Goal: validate functional correctness AND evaluate whether the experience matches the product vision — warm, conversational, never clinical.

**Date:** February 2026
**Tester:** You (founder)
**Environment:** `npm run dev` on localhost, mobile browser (or desktop with mobile viewport)
**Prereqs:** Supabase migration applied, `.env.local` configured, dev server running

---

## How to Use This Document

Each cluster is a natural user journey, not a feature checklist. Work through them in order — they build on each other (Cluster 1 creates the data that Clusters 2–4 rely on).

For each step:
- **[F]** = Functional check (does it work?)
- **[V]** = Vision check (does it feel right?)

Take notes directly in the "Notes" sections. Be honest and specific — "the card feels cold" is more useful than "looks fine."

---

## Cluster 1: First Contact → Life Mapping → Completion

**What you're testing:** The entire first-time user experience, from landing to having a populated life map. This is the single most important flow in the product.

**Time estimate:** 15–25 minutes (depending on how deep you go with Sage)

### 1.1 Landing & Login

| # | Step | Check | Type |
|---|------|-------|------|
| 1 | Open `localhost:3000` | Redirects to `/login` | [F] |
| 2 | See the login page | Warm cream background, centered layout, "MeOS" title | [V] |
| 3 | Click "Continue with Email" | Email input expands smoothly | [F] |
| 4 | Enter your email, click "Send Magic Link" | Shows "Check your email" confirmation | [F] |
| 5 | Check your email | Magic link arrives (may take 30s) | [F] |
| 6 | Click the magic link | Redirects to `/home` | [F] |
| 7 | — | Loading spinner shown during redirect? | [F] |

**Vision check:** Does the login feel welcoming or transactional? Does it feel like you're entering a warm space or filling out a form?

**Notes:**
```


```

### 1.2 Home Screen (Pre-Onboarding)

| # | Step | Check | Type |
|---|------|-------|------|
| 8 | See home screen | Time-appropriate greeting ("Good morning/afternoon/evening") | [F] |
| 9 | — | Shows your first name (from email) or just greeting? | [F] |
| 10 | — | "Ready to map your life? Let's talk." copy | [V] |
| 11 | — | "Map your life" CTA button visible and prominent | [F] |
| 12 | — | No empty/blank areas, everything feels intentional | [V] |

**Vision check:** Does the home screen make you *want* to tap "Map your life"? Or does it feel like a placeholder?

**Notes:**
```


```

### 1.3 Life Mapping Conversation (Core Experience)

This is the heart of the product. Take your time. Talk to Sage like a real user.

| # | Step | Check | Type |
|---|------|-------|------|
| 13 | Tap "Map your life" | Navigates to `/chat`, Sage's opening message appears instantly | [F] |
| 14 | Read Sage's opening | Feels warm, sets expectations, ends with the open question | [V] |
| 15 | — | Message styled as Sage bubble (left-aligned, sage-green border) | [F] |
| 16 | Type a response about how you're feeling | Message appears right-aligned, cream background | [F] |
| 17 | — | Typing indicator (three dots) appears while waiting | [F] |
| 18 | Sage responds | Response streams in token-by-token (not all at once) | [F] |
| 19 | — | Sage reflects back what you said before steering | [V] |
| 20 | — | Response is concise (2–4 sentences), not a wall of text | [V] |
| 21 | — | Sage suggests a starting domain based on your response | [V] |
| 22 | Explore the first domain (2–4 exchanges) | Sage probes current state, what's working, what's not | [V] |
| 23 | — | Sage follows your emotional energy, doesn't feel robotic | [V] |
| 24 | — | Sage names something you hadn't articulated | [V] |
| 25 | Sage generates domain card | `[DOMAIN_SUMMARY]` block renders as a styled card | [F] |
| 26 | — | "Building your map..." skeleton appears during streaming | [F] |
| 27 | — | Card shows: domain name, status dot, current state, what's working/not, tension, intention | [F] |
| 28 | — | Status feels accurate (thriving/stable/needs_attention/in_crisis) | [V] |
| 29 | — | Card content feels like a fair summary of what you said | [V] |
| 30 | — | Quick-reply pills appear below the card | [F] |
| 31 | — | Remaining domains shown + "Wrap up" button | [F] |
| 32 | Tap a domain pill (e.g., "Health / Body") | Sends "Let's explore Health / Body" as your message | [F] |
| 33 | Explore second domain | Same quality of conversation as first | [V] |
| 34 | Second domain card generated | Card renders correctly, quick-reply pills update (domain removed) | [F] |
| 35 | *(Optional)* Tap the edit pencil on a domain card | Input prefills with "About my {domain} card — " | [F] |
| 36 | *(Optional)* Explore a 3rd domain | Test that the rhythm doesn't get repetitive | [V] |
| 37 | Tap "Wrap up" | Sends wrap-up message to Sage | [F] |
| 38 | Sage generates synthesis | `[LIFE_MAP_SYNTHESIS]` renders as synthesis card | [F] |
| 39 | — | Narrative feels like a thoughtful coach's assessment, not generic | [V] |
| 40 | — | Primary compounding engine identifies a real leverage point | [V] |
| 41 | — | Quarterly priorities are specific and limited (max 3) | [V] |
| 42 | — | Key tensions capture real contradictions you feel | [V] |
| 43 | — | Anti-goals feel like genuine "not now" decisions, not filler | [V] |
| 44 | Push notification prompt appears | "Want me to remind you...?" with Allow/Skip | [F] |
| 45 | Tap "Skip" (or "Allow") | Prompt disappears | [F] |

**Big vision questions after this cluster:**
- Did the conversation feel like talking to a wise friend or an AI filling out a form?
- Did Sage surprise you with any insight you hadn't considered?
- Did the domain cards feel like a useful artifact or an interruption to the conversation?
- Was the pacing right? Did you feel in control?
- Did Sage push back on anything, or just accept everything you said?

**Notes:**
```


```

---

## Cluster 2: The Artifacts (Life Map & History)

**What you're testing:** Whether the data Sage extracted during conversation is useful, accurate, and well-presented outside of chat.

**Time estimate:** 5 minutes

### 2.1 Life Map View

| # | Step | Check | Type |
|---|------|-------|------|
| 46 | Tap "Life Map" tab in bottom nav | Navigates to `/life-map` | [F] |
| 47 | See synthesis section | Narrative, compounding engine, priorities, tensions, anti-goals all present | [F] |
| 48 | — | Compounding engine highlighted (amber background) | [F] |
| 49 | — | Content matches what Sage generated in chat | [F] |
| 50 | See domain grid | Explored domains show as full cards, unexplored domains grayed out | [F] |
| 51 | Tap an explored domain card | Card expands with full detail | [F] |
| 52 | — | All fields present: current state, what's working/not, desires, tensions, intentions | [F] |
| 53 | — | Status dot color matches the status | [F] |
| 54 | Tap again to collapse | Card collapses smoothly | [F] |
| 55 | See "Last updated" timestamp | Correct date shown | [F] |

**Vision check:** Does the life map feel like a useful personal document or just a data dump? Would you want to revisit this page?

**Notes:**
```


```

### 2.2 History View

| # | Step | Check | Type |
|---|------|-------|------|
| 56 | Tap "History" tab | Navigates to `/history` | [F] |
| 57 | See session list | Your life mapping session appears | [F] |
| 58 | — | "Life Mapping" type badge, "Completed" status pill | [F] |
| 59 | — | AI summary snippet shown (if generated) | [F] |
| 60 | — | Key theme tags shown (if generated) | [F] |
| 61 | Tap the session card | Navigates to `/history/{sessionId}` | [F] |
| 62 | See full conversation replay | All messages rendered with correct styling | [F] |
| 63 | — | Domain cards and synthesis card render inline | [F] |
| 64 | — | Read-only — no input bar at bottom | [F] |
| 65 | Tap back arrow | Returns to history list | [F] |

**Vision check:** Is the history view useful for reflection, or just an archive you'd never open?

**Notes:**
```


```

---

## Cluster 3: Home Screen (Post-Onboarding) & Check-In Entry

**What you're testing:** Whether the home screen evolves meaningfully after onboarding and provides a clear path to the weekly check-in.

**Time estimate:** 3 minutes

| # | Step | Check | Type |
|---|------|-------|------|
| 66 | Tap "Home" tab | Navigates to `/home` | [F] |
| 67 | — | No longer shows "Ready to map your life?" — now shows check-in state | [F] |
| 68 | See check-in card | "Next check-in" with date (should be ~7 days from now) | [F] |
| 69 | — | "Start early" button (since it's not overdue yet) | [F] |
| 70 | See priorities section | Shows quarterly priorities from your life map | [F] |
| 71 | — | Priorities match what Sage synthesized | [F] |
| 72 | See "Talk to Sage" button | Full-width secondary button at bottom | [F] |
| 73 | — | Overall feel: calm dashboard, not overwhelming | [V] |

**Vision check:** Does the post-onboarding home screen make you feel grounded? Does it remind you of what matters without pressuring you?

**Notes:**
```


```

---

## Cluster 4: Weekly Check-In Conversation

**What you're testing:** Whether Sage meaningfully references your life map context and the check-in feels different from life mapping.

**Time estimate:** 10–15 minutes

| # | Step | Check | Type |
|---|------|-------|------|
| 74 | From home, tap "Start early" | Navigates to `/chat?type=weekly_checkin` | [F] |
| 75 | See Sage's opening | "Hey, welcome back. How are you doing?" — appears instantly | [F] |
| 76 | — | Different tone from life mapping opening (shorter, warmer) | [V] |
| 77 | Respond about your week | Your message sends, Sage starts streaming | [F] |
| 78 | Sage's first response | References something from your life map (priorities, domains, commitments) | [V] |
| 79 | — | Asks about specific priorities or last commitment | [V] |
| 80 | — | Does NOT re-explore domains from scratch — builds on existing map | [V] |
| 81 | Continue conversation (3–5 exchanges) | Sage checks in on progress, explores obstacles | [V] |
| 82 | — | If you mention not following through, Sage asks "What got in the way?" (not judgmental) | [V] |
| 83 | — | Sage asks about energy/mood | [V] |
| 84 | — | Sage suggests one forward-looking intention | [V] |
| 85 | Sage generates session summary | `[SESSION_SUMMARY]` block (not visible in chat) | [F] |
| 86 | — | Session auto-completes (you can tell if the input bar still works or not — it should still be active since there's no visual indicator currently) | [F] |
| 87 | Go to History tab | New session appears: "Weekly Check-In", "Completed" | [F] |
| 88 | — | AI summary and key themes populated | [F] |

**Big vision questions:**
- Did the check-in feel like catching up with someone who knows you, or starting over?
- Was Sage's tone different from life mapping? (Should feel more casual, less exploratory)
- Did Sage reference specific things from your life map?
- Did the check-in feel like 5-10 minutes, or did it drag?

**Notes:**
```


```

---

## Cluster 5: Voice Input

**What you're testing:** Whether the voice-first promise works in practice. Test this during either conversation flow — no need for a separate session.

**Time estimate:** 3 minutes (embedded in Clusters 1 or 4)

| # | Step | Check | Type |
|---|------|-------|------|
| 89 | See the voice button | Amber circle, bottom-left of input area, pulsing gently | [F] |
| 90 | — | Button is the most prominent input element (per design spec) | [V] |
| 91 | Tap the voice button | Microphone permission prompt (first time) | [F] |
| 92 | Grant permission | Button transitions to recording state (larger, deeper amber, stop icon) | [F] |
| 93 | — | Elapsed time counter appears on button | [F] |
| 94 | Speak for 5-10 seconds | — | — |
| 95 | Tap button to stop | Button transitions to processing state (spinner) | [F] |
| 96 | — | "Processing your voice..." text appears below | [F] |
| 97 | Transcription completes | Your spoken text auto-sends as a message (no manual review) | [F] |
| 98 | — | Transcription is reasonably accurate | [F] |
| 99 | Sage responds normally | Works same as typed input | [F] |

**Vision check:** Does voice feel like the primary input method or an afterthought? Is the button satisfying to tap? Does the recording → processing → sent flow feel smooth or jarring?

**Notes:**
```


```

---

## Cluster 6: Navigation, Loading, & Polish

**What you're testing:** General fit and finish. Quick pass through the app's chrome.

**Time estimate:** 3 minutes

| # | Step | Check | Type |
|---|------|-------|------|
| 100 | Bottom tab bar | All 4 tabs work (Home, Chat, Life Map, History) | [F] |
| 101 | — | Active tab highlighted with amber/primary pill | [F] |
| 102 | — | Tab bar fixed to bottom, doesn't scroll away | [F] |
| 103 | — | Safe area padding on notched phones (if testing on real device) | [F] |
| 104 | Navigate between pages | Loading skeletons appear briefly on Home, Life Map, History | [F] |
| 105 | — | No blank white flashes between pages | [V] |
| 106 | Pull up the chat while a session exists | Restores previous messages (session recovery) | [F] |
| 107 | Check overall typography | Satoshi font loaded? Or falling back to system font? | [F] |
| 108 | — | Text sizes feel comfortable on mobile | [V] |
| 109 | — | Color palette feels warm throughout (no cold blues or sterile whites) | [V] |
| 110 | — | Touch targets all feel tappable (≥44px) | [V] |

**Notes:**
```


```

---

## Cluster 7: Edge Cases (Quick Smoke Tests)

**What you're testing:** Things that probably won't happen in a demo but should work.

**Time estimate:** 5 minutes

| # | Step | Check | Type |
|---|------|-------|------|
| 111 | Send an empty message (just spaces) | Should not send | [F] |
| 112 | Send a very long message (500+ characters) | Sends and displays correctly, no overflow | [F] |
| 113 | Rapidly tap send multiple times | Only one message sends (button disabled during streaming) | [F] |
| 114 | Navigate away mid-stream (tap Home tab) | No crash. Return to Chat — messages still there | [F] |
| 115 | Open Life Map before doing any mapping | Shows empty state with CTA to talk to Sage | [F] |
| 116 | Open History with no completed sessions | Shows empty state with CTA | [F] |
| 117 | Refresh the page during a conversation | Session restores, messages reload | [F] |
| 118 | Open in a second browser tab (same account) | Both tabs work (no conflict) | [F] |

**Notes:**
```


```

---

## Post-Test Reflection

After completing all clusters, step back and answer these holistically:

### Product Vision Alignment

```
1. Does MeOS feel like a "voice-first AI life partner" or
   a "chat app with an AI"?


2. Does Sage feel like a distinct personality — warm, opinionated,
   insightful — or a generic AI assistant?


3. Would you want to come back for a weekly check-in?
   Why or why not?


4. What single moment in the experience surprised or
   delighted you?


5. What single moment felt most "off" or broke the
   illusion?


```

### Sage's Conversation Quality

```
6. Did Sage push back on anything, or just agree
   with everything?


7. Were the domain cards accurate reflections of what
   you said?


8. Did the synthesis feel like a genuine insight or
   a summarization?


9. Was Sage's response length right? Too short?
   Too verbose?


10. Did Sage name any emotion or tension you hadn't
    said out loud?


```

### Design & Feel

```
11. Does the warm palette (amber, cream) feel cohesive
    or forced?


12. Is the voice button prominent enough? Did you
    naturally gravitate to it?


13. Do the domain cards and synthesis cards feel like
    artifacts you'd revisit, or noise in the chat?


14. Does the overall app feel like a v1 you'd ship
    or a prototype?


```

### Top 3 Things to Fix Before Shipping

```
1.

2.

3.
```

### Top 3 Things That Work Well

```
1.

2.

3.
```
