---
status: pending
priority: p2
issue_id: "006"
tags: [code-review, typescript, voice]
dependencies: []
---

# 006 — Whisper transcription leading-space artifact: use `result.text.trim()`

## Problem Statement

Whisper API frequently returns transcriptions with a leading space (e.g., `" Hello there."` is a known output artifact). The code checks `result.text.trim()` to guard against blank transcriptions, but then sets the full untrimmed value. This means the user sees a leading space in the text field.

## Findings

- **File:** `components/chat/chat-input.tsx:87–88`
- ```tsx
  if (result.text && result.text.trim()) {
    setText(result.text)  // sets raw untrimmed value with potential leading space
  ```
- `handleSubmit` calls `.trim()` before sending, so the message itself is correct
- But the visual textarea content shows the leading space, which looks like a bug
- Reported by: TypeScript reviewer (P2-B)

## Fix

```tsx
if (result.text && result.text.trim()) {
  setText(result.text.trim())  // set trimmed value
```

**Effort:** Trivial (1-character change)
**Risk:** None

## Acceptance Criteria

- [ ] `setText(result.text.trim())` at `chat-input.tsx:88`
- [ ] Whisper transcription does not show leading space in textarea

## Work Log

- 2026-02-19: Created from PR #19 code review (TypeScript reviewer P2-B)
