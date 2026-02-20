'use client'

import { useState, useRef } from 'react'
import type { Capture } from '@/types/day-plan'

interface CaptureInputProps {
  onCaptureAdded: (capture: Capture) => void
}

export function CaptureInput({ onCaptureAdded }: CaptureInputProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [text, setText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  async function handleSubmit() {
    const trimmed = text.trim()
    if (!trimmed || isSubmitting) return

    setIsSubmitting(true)

    // Optimistic: create a local capture immediately
    const optimisticCapture: Capture = {
      id: `temp-${Date.now()}`,
      user_id: '',
      day_plan_id: null,
      content: trimmed,
      classification: null,
      auto_tags: [],
      source: 'manual',
      explored: false,
      completed: false,
      created_at: new Date().toISOString(),
    }
    onCaptureAdded(optimisticCapture)

    setText('')
    setIsExpanded(false)

    // Show toast
    setShowToast(true)
    setTimeout(() => setShowToast(false), 2000)

    try {
      await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed, inputMode: 'text' }),
      })
    } catch {
      // Capture is already shown optimistically — background save failed silently
      // The capture still exists in markdown via the API fallback
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <>
      {/* Toast notification */}
      {showToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 animate-fade-up">
          <div className="rounded-full bg-warm-dark/90 px-4 py-2 text-sm font-medium text-white shadow-md">
            {'\u2713'} Captured
          </div>
        </div>
      )}

      {isExpanded ? (
        <div className="mb-3 rounded-[14px] border border-warm-dark/[0.08] bg-bg px-4 py-3 shadow-pebble">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What's on your mind?"
            className="w-full resize-none text-sm text-warm-dark placeholder:text-warm-dark/30 bg-transparent focus:outline-none min-h-[60px] max-h-[120px]"
            rows={2}
            autoFocus
          />
          <div className="flex items-center justify-between mt-2">
            <button
              onClick={() => { setIsExpanded(false); setText('') }}
              className="text-xs text-warm-gray/50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!text.trim() || isSubmitting}
              className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-40 transition-opacity"
            >
              {isSubmitting ? 'Saving...' : 'Capture'}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => {
            setIsExpanded(true)
            setTimeout(() => inputRef.current?.focus(), 50)
          }}
          className="mb-3 w-full rounded-[14px] border border-warm-dark/[0.06] bg-bg px-4 py-3 text-left"
        >
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-dp-amber/40">
              <path d="M12 3l1.912 5.813a2 2 0 001.272 1.272L21 12l-5.813 1.912a2 2 0 00-1.272 1.272L12 21l-1.912-5.813a2 2 0 00-1.272-1.272L3 12l5.813-1.912a2 2 0 001.272-1.272z" />
            </svg>
            <span className="text-sm text-warm-dark/30">Capture a thought...</span>
          </div>
        </button>
      )}
    </>
  )
}
