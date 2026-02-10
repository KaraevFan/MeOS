'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { useVoiceRecorder } from '@/lib/voice/recorder'

interface ChatInputProps {
  onSend: (text: string) => void
  disabled: boolean
  prefill?: string
}

type VoiceState = 'idle' | 'recording' | 'processing'

export function ChatInput({ onSend, disabled, prefill }: ChatInputProps) {
  const [text, setText] = useState('')
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const {
    isRecording,
    duration,
    error: voiceError,
    isSupported: voiceSupported,
    startRecording,
    stopRecording,
  } = useVoiceRecorder()

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

  async function handleVoiceTap() {
    if (disabled) return

    if (voiceState === 'idle') {
      setVoiceState('recording')
      await startRecording()
    } else if (voiceState === 'recording' && isRecording) {
      setVoiceState('processing')
      try {
        const blob = await stopRecording()

        // Send to transcription API
        const formData = new FormData()
        formData.append('audio', blob, 'recording.webm')

        const response = await fetch('/api/transcribe', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          throw new Error('Transcription failed')
        }

        const result = await response.json()
        if (result.text) {
          // Auto-send voice transcription
          onSend(result.text)
        }
      } catch {
        // Fall back to showing error
        setText('')
      } finally {
        setVoiceState('idle')
      }
    }
  }

  // Reset voice state if recording stops externally
  useEffect(() => {
    if (!isRecording && voiceState === 'recording') {
      setVoiceState('idle')
    }
  }, [isRecording, voiceState])

  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="border-t border-border bg-bg px-4 py-3 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-end gap-3 max-w-lg mx-auto">
        {/* Voice button */}
        {voiceSupported && (
          <button
            type="button"
            disabled={disabled && voiceState === 'idle'}
            onClick={handleVoiceTap}
            className={cn(
              'flex-shrink-0 rounded-full bg-primary',
              'flex flex-col items-center justify-center',
              'transition-all duration-200',
              'hover:bg-primary-hover active:scale-95',
              // Size states
              voiceState === 'idle' && 'w-[64px] h-[64px] shadow-glow animate-pulse',
              voiceState === 'recording' && 'w-[72px] h-[72px] bg-primary-hover shadow-glow',
              voiceState === 'processing' && 'w-[64px] h-[64px] opacity-70',
              // Disabled
              disabled && voiceState === 'idle' && 'opacity-50 animate-none'
            )}
            aria-label={
              voiceState === 'idle' ? 'Start recording' :
              voiceState === 'recording' ? 'Stop recording' :
              'Processing audio'
            }
          >
            {voiceState === 'processing' ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg
                width={voiceState === 'recording' ? '32' : '28'}
                height={voiceState === 'recording' ? '32' : '28'}
                viewBox="0 0 24 24"
                fill={voiceState === 'recording' ? 'white' : 'none'}
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {voiceState === 'recording' ? (
                  // Stop icon (square)
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                ) : (
                  // Mic icon
                  <>
                    <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                    <path d="M19 10v2a7 7 0 01-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </>
                )}
              </svg>
            )}
            {voiceState === 'recording' && (
              <span className="text-white text-[10px] font-medium mt-0.5">
                {formatDuration(duration)}
              </span>
            )}
          </button>
        )}

        <div className="flex-1 flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={voiceState === 'recording' ? 'Recording...' : voiceState === 'processing' ? 'Processing...' : 'Type a message...'}
            disabled={disabled || voiceState !== 'idle'}
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
            disabled={disabled || !text.trim() || voiceState !== 'idle'}
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

      {/* Voice error */}
      {voiceError && (
        <p className="text-accent-terra text-xs mt-2 text-center">{voiceError}</p>
      )}

      {/* Processing label */}
      {voiceState === 'processing' && (
        <p className="text-text-secondary text-xs mt-2 text-center">Processing your voice...</p>
      )}
    </div>
  )
}
