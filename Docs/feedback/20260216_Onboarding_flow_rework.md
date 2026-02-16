# Onboarding Flow Rework — Implementation Spec

**Date:** 2026-02-16
**Context:** Playtest feedback from updated onboarding flow
**Priority:** High — this is the first-time user experience and directly impacts whether users reach the magic moment (life mapping conversation)

---

## Summary of Changes

The current onboarding flow has the right ingredients but the wrong order. We need to:

1. **Fix the name collection** — stop using raw email/user ID as display name
2. **Rework the intent screen** ("What brought you here?") to capture more useful signal
3. **Add a trust-building conversational moment** between intent selection and the pulse check
4. **Move the pulse check AFTER we've earned the user's trust**, not before

The guiding principle: the user should feel like they're having a warm, low-stakes conversation with Sage — not filling out a clinical intake form. Every screen should earn the right to ask the next question.

---

## Current Flow (What Exists)

```
Screen 1: Home → "Good morning, [raw username]" + voice orb + "Tap to begin"
Screen 2: Sage intro → "Hey — I'm Sage" + "Let's go" button
Screen 3: Intent selection → "What brought you here today?" + 4 options
Screen 4: Pulse check → 8 domain ratings (1-5, Rough → Thriving), one per screen
Screen 5: Radar chart → "Here's your life snapshot" + "Start Conversation"
Screen 6: Chat → Life mapping conversation begins (currently broken — 406 errors)
```

### Problems Identified

1. **Name display:** Shows `Tk4vu` (likely email prefix or Supabase user ID). Feels broken and impersonal.
2. **Intent options aren't differentiated enough:** "Feeling scattered," "Going through a transition," "Want more clarity," and "Just curious" are all variations of the same vague seeking. They don't give Sage meaningfully different conversational entry points.
3. **Trust gap before pulse check:** We jump from a single-tap intent selection straight into asking users to rate 8 sensitive life domains. The user has no relationship with Sage yet, no understanding of why they're rating things, and no preview of the payoff.
4. **Pulse check feels clinical:** Rating "Career / Work" on a ROUGH to THRIVING scale, 1 of 8, with no conversational framing — this reads like a therapy intake form, not a warm conversation.
5. **Chat fails to load after radar:** Console shows multiple 406 errors on Supabase resources. The pulse check ratings likely aren't being saved correctly before the chat view tries to load them.

---

## New Flow (What to Build)

```
Screen 1: Sage intro → "Hey — I'm Sage." + name collection
Screen 2: Intent selection → Reworked options based on user's situation
Screen 3: Mini-conversation → 2-3 quick, fun, trust-building exchanges with Sage
Screen 4: Pulse check intro → Sage frames WHY we're doing quick ratings
Screen 5: Pulse check → 8 domain ratings (same mechanic, better context)
Screen 6: Radar chart → "Here's your life snapshot" + "Start Conversation"
Screen 7: Chat → Life mapping conversation (with pulse check data as context)
```

### Detailed Screen Specs

---

### Screen 1: Sage Intro + Name Collection

**Purpose:** Mutual introduction. Sage introduces themselves, user shares their name.

**Layout:**
- Sage avatar (centered, same as current)
- Heading: `Hey — I'm Sage.`
- Subtext: `I'm going to help you build a map of where you are in life right now.`
- Text input field: placeholder text `What should I call you?`
- CTA button: `Let's go` (disabled until name entered, minimum 2 characters)

**Behavior:**
- Name is saved to user profile (`display_name` or equivalent field in Supabase)
- This name is used everywhere else in the app (home screen greeting, Sage addressing the user in conversation, etc.)
- If Google OAuth provides a display name, pre-fill the input but still show this screen so the user can confirm/change it
- Strip leading/trailing whitespace, capitalize first letter

**Design notes:**
- Keep the same warm, centered, minimal aesthetic as the current Sage intro screen
- The text input should feel like part of the conversation, not a form field — consider no visible border, just an underline or subtle placeholder
- The interaction should feel like: Sage says hi → you say hi back

---

### Screen 2: Intent Selection (Reworked)

**Purpose:** Capture the user's *situation* (not just feeling) to give Sage a meaningfully different conversational entry point.

**Layout:**
- Heading: `What's going on in your world right now?`
- Subtext: `Pick whatever fits best — there's no wrong answer.`
- 4-5 option cards (single select, same card style as current)

**New Options:**

| Option | Icon | What it tells Sage |
|--------|------|--------------------|
| `Things are good — I want to be more intentional` | 🌱 | User is in a stable place, looking to optimize. Sage can be more exploratory and ambitious. |
| `I'm starting something new` | 🚀 | User is in a transition by choice (new job, new city, new project). Sage can focus on clarity and direction. |
| `I'm feeling stuck or scattered` | 🌀 | User feels overwhelmed or unfocused. Sage should be grounding, help them see the full picture. |
| `I'm going through a tough time` | 🌊 | User is dealing with difficulty (loss, burnout, relationship issues). Sage should be warmer, more careful, less pushy. |
| `Just exploring` | ✨ | Low commitment, curious. Sage should be light and fun, prove value quickly. |

**Why these are better:** Each option maps to a genuinely different conversational tone and strategy for the life mapping session. The current options ("feeling scattered" vs "want more clarity") are essentially the same user in different words.

**Behavior:**
- Single select, tapping an option triggers a brief transition animation and advances to the next screen
- Selected intent is saved to the session/user record and passed as context to the life mapping prompt
- The intent directly influences Sage's opening message and conversational approach in the life mapping session

**Implementation note:** Store the selected intent as an enum value (e.g., `intentional`, `new_start`, `stuck`, `tough_time`, `exploring`) in the user's onboarding record. This will be injected into the system prompt for the life mapping conversation.

---

### Screen 3: Mini-Conversation (NEW — Trust Building)

**Purpose:** This is the key new addition. Before asking users to rate their life domains, we give them a brief, warm, low-stakes conversational exchange with Sage. This accomplishes three things:
1. Builds familiarity — user experiences Sage's personality before sharing vulnerable data
2. Establishes the conversational paradigm — this is a conversation, not a form
3. Creates a natural bridge to the pulse check — Sage can frame WHY ratings are useful

**Layout:** 
- This should feel like a simple chat interface, but contained (not the full chat view)
- Sage's messages appear as speech bubbles or styled text blocks on the left
- User responds via pre-written quick-reply buttons (NOT free text — we want this to be fast and controlled)
- Background: same warm off-white as other onboarding screens
- No nav bar visible — this is still part of the onboarding flow

**Conversation Script:**

The exact script should adapt based on the intent selected in Screen 2, but here's the general structure:

**Exchange 1 — Sage acknowledges the intent and asks a light question:**

*If intent = "Things are good — I want to be more intentional":*
> `Nice — sounds like you're in a good place and want to make the most of it. Before we dive in, quick question: when you imagine having more clarity about your life, what does that actually look like?`

Quick replies:
- `Knowing my priorities and sticking to them`
- `Feeling less pulled in every direction`
- `Having a plan I actually follow`
- `Honestly, I'm not sure yet`

*If intent = "I'm feeling stuck or scattered":*
> `I hear you — that scattered feeling is really common, especially for people who have a lot going on. Quick question: is it more that you have too many things competing for attention, or that you're not sure what to focus on?`

Quick replies:
- `Too many things, not enough focus`
- `Not sure what actually matters to me`  
- `A bit of both`
- `It's something else entirely`

*(Similar variations for other intents — the key is that Sage's question feels responsive to what they just shared)*

**Exchange 2 — Sage reflects back and previews the pulse check:**

After the user taps a quick reply, Sage responds with a brief, warm acknowledgment and then frames the upcoming pulse check:

> `Got it. That's really helpful context.`
>
> `Here's what I'd like to do: I'm going to show you eight areas of life — things like career, relationships, health — and ask you to give each one a quick gut rating. Don't overthink it. This just helps me know where to focus when we actually talk.`
>
> `Sound good?`

Quick replies:
- `Let's do it`
- `What do you mean by "gut rating"?`

If they tap "What do you mean by gut rating?":
> `Just a 1-to-5 feel for how each area is going. 1 means rough, 5 means thriving. Go with your first instinct — there are no wrong answers and you can always change them later.`

Quick reply:
- `Got it — let's go`

**Behavior:**
- Each exchange animates in naturally (Sage's messages appear with a brief typing delay of ~500-800ms, quick replies slide up after the message renders)
- User's selected quick replies appear as their "message" in the conversation (right-aligned, different style)
- The conversation data (selected quick replies) should be saved as part of the onboarding record — this gives Sage additional context for the life mapping conversation
- Total time for this screen: ~15-30 seconds. It should feel fast and engaging, not like another hurdle.

**Design notes:**
- This is NOT the full chat interface. It's a simplified, contained conversational moment within the onboarding flow. Think of it like a Typeform-style interaction but with chat bubbles instead of form fields.
- The quick reply buttons should be styled consistently with the intent selection cards — same warm palette, rounded corners, clear tap targets
- Consider a subtle progress indicator or skip option, but honestly this is short enough that skip isn't necessary
- Sage's messages should use the same typography and styling that will appear in the actual chat — this builds pattern recognition

---

### Screen 4: Pulse Check (Same Mechanic, Better Context)

**Purpose:** Quick gut-check ratings across 8 life domains. Same as current, but now the user understands WHY they're doing this and has a relationship with Sage.

**What to keep:**
- One domain per screen
- 5-point scale (ROUGH → THRIVING)
- "1 of 8" progress indicator
- Back button
- "Quick gut check — don't overthink these" instruction
- Auto-advance on tap (or manual "Next" — whatever is current)

**What to change:**
- Remove the "tap to rate" helper text if the scale dots are obviously tappable
- Consider adding a very brief (3-5 word) descriptor under each domain name to help users who aren't sure what falls under that domain:
  - Career / Work → `your job, projects, professional life`
  - Relationships → `partner, family, friendships`
  - Health / Body → `physical health, energy, fitness`
  - Finances → `money, security, financial goals`
  - Learning / Growth → `skills, education, personal development`
  - Creative Pursuits → `art, writing, creative expression`
  - Play / Fun / Adventure → `hobbies, travel, enjoyment`
  - Meaning / Purpose → `values, spirituality, life direction`

**Behavior:** Same as current. Ratings saved to user record and passed to life mapping conversation as context.

---

### Screen 5: Radar Chart (Same as Current)

**What to keep:**
- "Here's your life snapshot" heading
- "a map, not a grade" subtext (this is great copy)
- Radar chart visualization
- "Start Conversation" CTA
- "Edit ratings" link

**What to change:**
- Consider adding Sage's commentary below the chart, personalized to the shape. For example:
  - If there's high variance: `"Interesting — some areas are really strong while others are pulling for attention. Let's explore that."`
  - If everything is mid-range: `"Looks like things are generally okay but there might be room to dig deeper. Let's find out what's underneath."`
  - If mostly high: `"You're doing well across the board — let's figure out where to focus your energy for the biggest impact."`
- This commentary should be generated client-side based on the ratings (simple conditional logic, not an LLM call)

---

### Screen 6: Chat → Life Mapping Conversation

**This is the existing chat view.** The main fix needed here is:

1. **Fix the 406 errors** — the pulse check ratings need to be successfully saved and retrievable before the chat loads
2. **Sage's opening message should reference the onboarding context** — the intent they selected, and optionally the pulse check shape. Example opening:
   > `Hey [name]! Based on your snapshot, it looks like career and relationships are feeling strong, but health and creative pursuits could use some attention. I'd love to start there — but first, tell me a bit about what's going on in your world right now. What's top of mind?`

**The system prompt for the life mapping conversation should include:**
- User's display name
- Selected intent (from Screen 2)
- Quick reply selections from the mini-conversation (Screen 3)
- All 8 domain ratings from the pulse check
- Instructions for Sage to reference this context naturally, not robotically

---

## Bug Fixes Required

### Critical: 406 Errors on Chat Load

**Symptom:** After completing the pulse check and viewing the radar chart, navigating to the chat view triggers multiple 406 (Not Acceptable) errors on Supabase resources. The chat view loads empty with no messages.

**Likely causes:**
1. Pulse check ratings not being written to the database correctly
2. Row-level security (RLS) policies blocking reads on the domain ratings table
3. The chat view is trying to fetch domain data using query parameters that don't match the expected format (the URL fragments in the console suggest URL-encoded domain names like `Career+%2F+Work` which might not match the stored format)

**Investigation steps:**
1. Check the Supabase table that stores pulse check ratings — are rows being created?
2. Check RLS policies on that table — does the authenticated user have read access to their own rows?
3. Check the query format in the chat view's data fetching — are domain names being URL-encoded when they shouldn't be, or vice versa?
4. Check that the session/conversation record is being created before the chat view tries to load it

### Minor: Display Name

**Symptom:** Home screen shows `Good morning, Tk4vu` instead of the user's actual name.

**Fix:** Once name collection is added to Screen 1, use that value. In the meantime, if using Google OAuth, pull `user_metadata.full_name` or `user_metadata.name` from the Supabase auth user object. Fall back to "there" (as in "Good morning, there") if no name is available — never show a raw ID or email prefix.

---

## Implementation Order

1. **Fix the 406 bug** — nothing else matters if the chat doesn't load after onboarding
2. **Add name collection** to Screen 1 (Sage intro) — small change, big impact
3. **Rework intent options** on Screen 2 — copy change + store new enum values
4. **Build the mini-conversation** (Screen 3) — this is the biggest new piece of work
5. **Add domain descriptors** to pulse check screens — small copy addition
6. **Add Sage commentary** to radar chart — simple conditional logic
7. **Update life mapping system prompt** to incorporate all onboarding context

---

## Design Constraints & Principles

- **The entire onboarding should take under 3 minutes.** The mini-conversation adds ~20-30 seconds. The pulse check is already ~30-60 seconds. We can't let this bloat.
- **No free-text input during onboarding** (except the name field). Quick replies and taps only. We want this to feel effortless.
- **Every screen should feel like Sage is talking to you**, not like the app is asking you to fill out a form. Copy should be conversational, not instructional.
- **The onboarding IS the product pitch.** By the time the user hits "Start Conversation," they should already feel like Sage understands them a little bit. The pulse check + mini-conversation are proof that this tool is different from a blank ChatGPT window.
- **Warm amber palette, clean typography, generous whitespace.** No changes to the visual design language — it's working well.

---

## Success Criteria

After these changes, a new user should:
1. Feel personally greeted (their actual name, not a user ID)
2. Feel like Sage "gets" their situation before the conversation even starts
3. Understand WHY they're rating life domains (because Sage explained it)
4. Arrive at the life mapping conversation with context already loaded (no blank screen, no errors)
5. Hear Sage reference their onboarding inputs naturally in the opening message

The whole thing should feel like one continuous conversation with Sage that starts simple and gets progressively deeper — not like 5 separate forms stitched together.