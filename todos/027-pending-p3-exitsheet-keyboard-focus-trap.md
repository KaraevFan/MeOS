---
status: pending
priority: p3
issue_id: "027"
tags: [code-review, accessibility, ux]
dependencies: []
---

# 027 — `ExitConfirmationSheet` buttons focusable via keyboard when visually hidden

## Problem Statement

`ExitConfirmationSheet` is always in the DOM — it slides off-screen via `translate-y-full` when closed. The backdrop is conditionally rendered (`{open && <div>}`), but the sheet itself is not. This means keyboard users can `Tab` into the sheet's buttons even when the sheet is visually hidden at the bottom of the viewport. For a PWA this is unlikely to affect most users (mobile-only), but it is a real accessibility regression for desktop keyboard users who interact with chat.

## Findings

- **File:** `components/chat/exit-confirmation-sheet.tsx:34–40`
- **Evidence:** Sheet div always rendered with `translate-y-full` when `open=false`; buttons have no `tabIndex=-1` or `aria-hidden` guard
- **Backdrop** is correctly conditionally rendered (`{open && ...}`) at line 26
- Reported by: TypeScript reviewer (LOW)

## Proposed Solutions

### Option A — Add `aria-hidden` and `inert` (Recommended)

```tsx
<div
  className={cn('fixed bottom-0 left-1/2 -translate-x-1/2 ...', open ? 'translate-y-0' : 'translate-y-full')}
  aria-hidden={!open}
  {...(!open && { inert: '' })}
>
```

`inert` is now widely supported (Chrome 102+, Firefox 112+, Safari 15.5+) and prevents focus, click, and assistive technology access in one attribute.

**Pros:** Correct accessibility fix, animation preserved, minimal change
**Cons:** `inert` requires TypeScript augmentation (`React.HTMLAttributes`)
**Effort:** Small
**Risk:** Low

### Option B — Conditionally render the whole sheet

```tsx
{showExitSheet && (
  <ExitConfirmationSheet ... />
)}
```

Simplest fix; no DOM node when closed; animation would need CSS entry transition instead of `translate-y`.

**Pros:** Zero DOM overhead when closed, no accessibility gymnastics
**Cons:** Loses slide-in animation on mount; first-open incurs React reconciliation overhead (negligible)
**Effort:** Small
**Risk:** Low

## Recommended Action

Option B — conditional rendering is simpler for a PWA. Move the sheet to the `ChatView` render as `{showExitSheet && <ExitConfirmationSheet />}` with `open` removed (always `true` when rendered). Add a CSS `animate-slide-up` class for entry animation if desired.

## Technical Details

- **Affected file:** `components/chat/exit-confirmation-sheet.tsx`
- **Also affects:** `components/chat/chat-view.tsx` line 1189–1194

## Acceptance Criteria

- [ ] Keyboard tab does not reach `ExitConfirmationSheet` buttons when sheet is not visible
- [ ] Sheet animation preserved (either transition or conditional render with entry animation)

## Work Log

- 2026-02-19: Created from PR #20 code review (TypeScript reviewer LOW)
