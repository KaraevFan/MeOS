# MeOS R4.3 Implementation Spec

**Date:** 2026-02-19
**Status:** Active — feed to Claude Code
**Context:** Issues discovered during R4.2 playtest with "James" persona. R4.2 patches (session header, progress pill) are verified working. These are the next-priority fixes before external demos.

---

## Priority Order

| # | Patch | Priority | Type |
|---|-------|----------|------|
| 1 | Sage pacing & wrap-up prompt tuning | P0 — demo quality | Prompt |
| 2 | Post-conversation rating update | P1 — data accuracy | Backend + UI |
| 3 | Domain name consistency in shelf | P1 — polish | UI |
| 4 | Soft wrap-up proactive trigger | P1 — conversation quality | Prompt |
| 5 | Pulse check label contrast | P2 — accessibility | UI |

---

## Patch 1: Sage Pacing & Session Arc Signaling (P0)

**Problem:** In the playtest, the user spent ~15 minutes on a single domain (Meaning/Purpose opened the conversation, then pivoted organically into Career). The pill showed "1 of 8" after substantial conversation. At this rate, covering all 8 domains would take 2+ hours, which contradicts our R3 fix that was supposed to cap sessions at 2–3 domains.

The issue isn't that the conversation was too deep — the depth was excellent. The issue is that Sage never signaled the session arc. The user had to ask "How much more do we have to talk on this career stuff?" to trigger a transition. Sage should manage pacing proactively.

**Fix — Prompt engineering changes:**

After the first domain card is generated and presented, Sage's next message should include arc signaling. Something like:

> "We've gone deep on Career — that was clearly where the energy was. I want to touch on one more area before we bring it all together. Given what came up about [tension from first domain], I'm curious about [suggested next domain]. Want to go there, or is there something else pulling at you?"

**Specific prompt instructions to add/modify:**

1. **After first domain card drops**, Sage should:
   - Acknowledge what was covered ("We went deep on X")
   - Signal remaining session scope ("I want to touch on one, maybe two more areas before we synthesize")
   - Suggest the next domain based on cross-domain connections from what emerged, not just pulse check priority
   - Give user agency to redirect

2. **During second domain exploration**, Sage should:
   - Be noticeably more focused — 4–6 exchanges max, not 10+
   - Reference connections to the first domain ("This connects to what you said about...")
   - Move toward the domain card faster

3. **After second domain card**, Sage should:
   - Default toward synthesis: "I think we have enough to work with. Want to synthesize what we've found, or is there one more area calling to you?"
   - If user says "one more," keep it tight — 3–4 exchanges, then card
   - If user says "synthesize," move to cross-domain synthesis

4. **Hard ceiling**: After 3 domain cards, Sage should move to synthesis regardless. The prompt should include something like: "We've covered a lot of ground. Let me pull together what I'm seeing across these areas."

**Key principle:** The user should always have a sense of "where we are in the session." The pill shows domain progress (1 of 8), but Sage's words should frame the *session* progress (1 of 2–3 for today).

**Acceptance Criteria:**
- [ ] After first domain card, Sage proactively signals "1–2 more areas then synthesis"
- [ ] Second domain exploration is noticeably shorter (4–6 exchanges)
- [ ] After second domain card, Sage defaults toward synthesis
- [ ] After third domain card, Sage moves to synthesis regardless
- [ ] User never has to ask "how much more" — Sage manages the arc

---

## Patch 2: Post-Conversation Rating Update (P1)

**Problem:** In the expanded shelf (spider chart + domain grid), Career shows "3/5" which is the raw pulse check rating. But during the conversation, "James" explicitly revised his assessment: *"the actual experience of the work... that's lower than a 3. Maybe a 2. I just didn't want to admit that to myself."*

Sage reflected this back and the domain card captured it in the Key Tension. But the numerical rating in the shelf wasn't updated. This creates a disconnect: the user just had a breakthrough moment of honesty, and the system still shows the old number.

**Design decision: Unified 1–5 scale everywhere.**

The pulse check established the user's mental model with a 1–5 scale (Rough → Struggling → Okay → Good → Thriving). Every rating surface in the app should use this same scale. No conversion, no translation, no confusion.

- Pulse check: 1–5
- Domain grid in shelf: X/5
- Spider chart axes: 1–5
- Post-conversation updated rating: 1–5
- Life Map view: 1–5

A previous version of the spec proposed a 1–10 scale for post-conversation ratings to add granularity. This is wrong. Users think in rough buckets ("okay," "struggling") that map cleanly to 5 points. Sage isn't doing clinical assessment — it's reflecting what the user said. Two scales creates a mapping headache (is 4/10 better or worse than 3/5?) for zero user benefit.

**Fix:**

When Sage generates a domain card after exploration, it should also emit an `updated_rating` on the 1–5 scale. This reflects what actually emerged in conversation, not just the initial self-report.

**Schema change for domain card output:**

```typescript
interface DomainCard {
  domain: string;
  current_state: string;
  whats_working: string[];
  whats_not_working: string[];
  key_tension: string;
  stated_intention: string;
  updated_rating: number;  // ← NEW: 1-5 scale, same as pulse check
}
```

**Prompt instruction for Sage:**
When generating a domain card, also assess an honest rating (1–5) based on what the user *actually* revealed, not just what they initially said. Use the same scale as the pulse check: 1 = Rough, 2 = Struggling, 3 = Okay, 4 = Good, 5 = Thriving. If the user revised their own assessment during conversation, use the revised number. Include this as `updated_rating` in the structured output.

For the "James" Career example: pulse check was 3 (Okay), but user said "the actual experience of the work... that's lower than a 3. Maybe a 2." → `updated_rating: 2`.

**UI behavior:**
- When a domain card is generated with `updated_rating`, update the domain's `rating` in the life map state
- The pill's expanded shelf should show the updated rating as `X/5`
- The spider chart should redraw to reflect the new value
- If the updated rating differs from the pulse check rating, Sage can reference this in synthesis: "You initially rated Career as 'okay,' but what we uncovered tells a different story"

**Acceptance Criteria:**
- [ ] Domain cards include `updated_rating` field (1–5 scale)
- [ ] All rating displays use 1–5 scale consistently (shelf, spider chart, Life Map view)
- [ ] No `/10` ratings anywhere in the UI
- [ ] Rating in shelf updates after domain card is generated
- [ ] Spider chart reflects updated ratings
- [ ] If user explicitly revises their assessment in conversation, updated_rating reflects the revision

---

## Patch 3: Domain Name Consistency in Shelf (P1)

**Problem:** In the expanded shelf view, the spider chart labels use "Purpose" but the domain grid below shows "Meaning." Both should use the same abbreviated label.

**Fix:** Standardize on the abbreviated label set everywhere in the shelf (both spider chart and domain grid):

| Domain (full) | Abbreviated (use in shelf) |
|----------------|---------------------------|
| Career | Career |
| Relationships | Relations… |
| Health / Body | Health |
| Finances | Finances |
| Creative Pursuits | Creative |
| Play / Fun / Adventure | Play |
| Learning / Growth | Learning |
| Meaning / Purpose | Purpose |

The `DomainSlot` compact variant already truncates names longer than 8 characters to the first word (see `DomainSlot.tsx` line 83). But "Meaning & Purpose" truncates to "Meaning" while the spider chart shows "Purpose."

**Fix options (pick one):**
1. **Change the domain name in the data model** from "Meaning & Purpose" to "Purpose & Meaning" — then auto-truncation gives "Purpose" which matches the spider chart
2. **Override the truncation logic** for this specific domain to show "Purpose" instead of auto-truncating
3. **Use a separate `shortName` field** in the domain data model

Option 1 is simplest and also reads better ("Purpose & Meaning" flows more naturally than "Meaning & Purpose").

**Acceptance Criteria:**
- [ ] Spider chart label and domain grid label match for every domain
- [ ] "Meaning / Purpose" displays as "Purpose" in both locations
- [ ] No other domain has a mismatch between chart and grid

---

## Patch 4: Soft Wrap-Up Proactive Trigger (P1)

**Problem:** The R3 fix specified that after 2–3 domains, Sage should default toward wrapping up. In the playtest, Sage did say "We can move on whenever you want — this is your session" but only *after* the user asked to move on. Sage should proactively offer the transition.

**Fix — Prompt engineering:**

Add a conversational depth tracker to Sage's system prompt behavior. After approximately 8–10 exchanges within a single domain exploration:

1. Sage should start moving toward synthesis for that domain: "I think I'm getting a clear picture here. Let me capture what we've found."
2. Sage should NOT keep drilling deeper if the user has already revealed a key tension and stated intention — those are the signals that a domain is "complete enough"

**Domain completeness signals** (if 2+ of these are present, move to domain card):
- User has named a specific tension or frustration
- User has identified what's working vs. what's not
- User has expressed a desire or intention (even vague)
- User has had an emotional moment of honesty or revision
- Exchange count within this domain exceeds 8

**Acceptance Criteria:**
- [ ] Sage proactively moves toward domain card generation after sufficient depth
- [ ] User doesn't have to ask "can we move on" to trigger a transition
- [ ] Sage recognizes domain completeness signals and begins wrapping that domain

---

## Patch 5: Pulse Check Label Contrast (P2)

**Problem:** From the Notion playtest log (R4 round): "Rough" and "Thriving" labels at the endpoints of pulse check sliders are light-colored text on cream background, making them hard to read.

**Fix:**
- Increase text contrast for the endpoint labels on pulse check sliders
- "Rough" (left endpoint) and "Thriving" (right endpoint) should use `warm-gray` color (same as primary text), not `warm-gray-light`
- Alternatively, use the domain status colors: "Rough" in `muted-red` or `soft-orange`, "Thriving" in `green`
- Keep the labels visually secondary to the rating circles, but readable

**Acceptance Criteria:**
- [ ] "Rough" and "Thriving" labels clearly readable on cream background
- [ ] Labels don't overpower the rating circles (visual hierarchy maintained)

---

## Appendix: What's Working Well (Don't Break These)

Verified working from this playtest — protect in all future changes:

- **Session header** with exit affordance, session label, ~25 min estimate, and user avatar
- **Progress pill** with dot indicators, "1 of 8" count, expandable chevron
- **Expanded shelf** with spider chart, domain grid, close button
- **Pulse check data injection** — Sage references specific ratings and proposes starting domain
- **Tab bar hidden** during active sessions
- **Input bar** simplified (mic, text, send)
- **Conversation quality** — cross-domain threading, challenging-but-warm tone, reflecting user's language back
- **Domain card generation** — structured output with Current State, What's Working, What's Not Working, Key Tension, Stated Intention
- **Domain card inline in chat** — appears naturally after Sage's wrap-up message, collapsible with chevron