'use client'

import { useState, useRef, useEffect } from 'react'

export function CaptureBar() {
  const [expanded, setExpanded] = useState(false)
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (expanded && inputRef.current) {
      inputRef.current.focus()
    }
  }, [expanded])

  function handleSubmit() {
    if (!text.trim()) {
      setExpanded(false)
      return
    }
    // TODO (M3): Save capture to captures/{date}-{timestamp}.md
    setText('')
    setExpanded(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === 'Escape') {
      setText('')
      setExpanded(false)
    }
  }

  if (expanded) {
    return (
      <div className="mx-5 mt-4">
        <div className="flex items-center gap-2 px-4 h-[46px] rounded-2xl bg-white border border-amber-200/50 shadow-[0_2px_8px_rgba(245,158,11,0.08)] transition-all">
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              if (!text.trim()) setExpanded(false)
            }}
            placeholder="What's on your mind?"
            className="flex-1 bg-transparent text-[14px] text-warm-dark placeholder:text-warm-gray/50 outline-none"
          />
          <button
            onClick={handleSubmit}
            disabled={!text.trim()}
            className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center shrink-0
                       disabled:opacity-30 hover:bg-amber-600 active:bg-amber-700
                       transition-colors duration-150"
            aria-label="Send capture"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-5 mt-4">
      <button
        onClick={() => setExpanded(true)}
        className="w-full flex items-center gap-3 px-4 h-[46px] rounded-2xl bg-warm-dark/[0.03] border border-warm-dark/[0.05] transition-colors hover:bg-warm-dark/[0.05] active:bg-warm-dark/[0.07]"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-amber-500/80"
        >
          <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
          <path d="M19 10v2a7 7 0 01-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
        <span className="text-[14px] text-warm-gray font-medium">
          Drop a thought
        </span>
      </button>
    </div>
  )
}
