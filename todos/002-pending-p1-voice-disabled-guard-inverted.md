---
status: pending
priority: p1
issue_id: "002"
tags: [code-review, typescript, voice, accessibility]
dependencies: []
---

# 002 — Voice `disabled` guard inverted: stop fires when `disabled=true`

## Problem Statement

The early-return at `chat-input.tsx:111` only blocks voice when `disabled=true AND voiceState==='idle'`. When `disabled=true` and `voiceState==='recording'`, the function falls through to the `else if` branch at line 119 and calls `stopRecording()`. This means a user can tap the button mid-recording even when the parent has signalled `disabled=true` (e.g., while Sage is streaming a reply). The button is also not visually disabled in the `recording` state (line 150–151 only applies `disabled` when `voiceState === 'idle'`), so the tap guard is the sole gate.

The same logic is encoded in both the guard (line 111) and the `disabled` button attribute (line 150), creating a maintenance hazard.

## Findings

- **File:** `components/chat/chat-input.tsx:111` and `:150–151`
- **Guard:**
  ```tsx
  if (disabled && voiceState === 'idle') return  // line 111
  ```
- **Button disabled attribute:**
  ```tsx
  disabled={disabled && voiceState === 'idle'}  // line 150
  ```
- When `disabled=true` and voice is recording, the stop+transcribe path fires even though the app is in a disabled state
- Transcribed text populates the field while `disabled=true`; the text cannot be sent until streaming ends — probably acceptable UX but the behavior is undocumented
- Reported by: TypeScript reviewer (P1-B), Simplicity reviewer (P2)

## Proposed Solutions

### Option A — Gate all interactions on `disabled` (Recommended)

```tsx
async function handleVoiceTap() {
  if (disabled) return  // block all interactions when disabled, regardless of voice state

  setTranscriptionError(null)
  if (voiceState === 'idle') {
    setVoiceState('recording')
    await startRecording()
  } else if (voiceState === 'recording' && isRecording) {
    try {
      const blob = await stopRecording()
      await transcribeToField(blob)
    } catch {
      showTranscriptionError("Couldn't transcribe audio. Tap to try again.")
      setVoiceState('idle')
    }
  }
}
```

**Pros:** Simple, predictable — disabled means disabled in all states
**Cons:** User cannot stop an active recording if the parent `disabled` prop is set during recording (e.g., streaming started after recording began). May trap the mic.
**Effort:** Small
**Risk:** Low

### Option B — Allow stop-when-recording regardless of `disabled`, block only start

```tsx
async function handleVoiceTap() {
  // Allow stopping an active recording even when disabled; block only starting new ones
  if (disabled && voiceState === 'idle') return

  // Remove the 'idle' qualification from the button's disabled attribute too:
  // disabled={disabled && voiceState === 'idle'} → keep as-is (both encode same rule)
}
```

This is the current behavior, documented explicitly. Update the button `disabled` prop to match.

**Pros:** Prevents mic being stuck open if streaming starts during recording
**Cons:** Current behavior is preserved but still allows transcription during disabled state
**Effort:** Tiny (add comment explaining intent)
**Risk:** None

## Recommended Action

Decide on intended behavior: **Can the user stop a recording once started, even if `disabled` becomes true?** If yes → Option B (add comment). If no → Option A. At minimum, the guard and the `disabled` attribute should encode the same rule.

## Technical Details

- **Affected file:** `components/chat/chat-input.tsx:111, 150`
- **PR:** #19

## Acceptance Criteria

- [ ] Guard at line 111 and `disabled` prop at line 150 encode the same condition
- [ ] No eslint-disable suppressions required
- [ ] Intended behavior when recording starts and `disabled` becomes true is documented in a comment

## Work Log

- 2026-02-19: Created from PR #19 code review (TypeScript reviewer P1-B, Simplicity P2)
