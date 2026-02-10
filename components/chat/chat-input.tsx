'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface ChatInputProps {
  onSend: (text: string) => void
  disabled: boolean
  prefill?: string
}

export function ChatInput({ onSend, disabled, prefill }: ChatInputProps) {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (prefill) {
      setText(prefill)
      inputRef.current?.focus()
    }
  }, [prefill])

  function handleSubmit() {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="border-t border-border bg-bg px-4 py-3 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-end gap-3 max-w-lg mx-auto">
        {/* Voice button placeholder — will be functional in Task 11 */}
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex-shrink-0 w-[64px] h-[64px] rounded-full bg-primary',
            'flex items-center justify-center',
            'shadow-glow animate-pulse',
            'transition-all duration-200',
            'disabled:opacity-50 disabled:animate-none',
            'hover:bg-primary-hover active:scale-95'
          )}
          aria-label="Voice input (coming soon)"
          onClick={() => {
            // Voice functionality added in Task 11
          }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
            <path d="M19 10v2a7 7 0 01-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </button>

        <div className="flex-1 flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={disabled}
            rows={1}
            className={cn(
              'flex-1 resize-none overflow-hidden',
              'min-h-[44px] max-h-[120px] px-4 py-2.5',
              'bg-bg-card border border-border rounded-lg',
              'text-text placeholder:text-text-secondary',
              'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
              'disabled:opacity-50'
            )}
            style={{
              height: 'auto',
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement
              target.style.height = 'auto'
              target.style.height = Math.min(target.scrollHeight, 120) + 'px'
            }}
          />

          <button
            type="button"
            onClick={handleSubmit}
            disabled={disabled || !text.trim()}
            className={cn(
              'flex-shrink-0 w-10 h-10 rounded-full',
              'flex items-center justify-center',
              'bg-primary text-white',
              'hover:bg-primary-hover active:scale-95',
              'transition-all duration-200',
              'disabled:opacity-30 disabled:cursor-not-allowed'
            )}
            aria-label="Send message"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
