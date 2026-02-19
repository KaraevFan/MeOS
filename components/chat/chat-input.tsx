'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useVoiceRecorder } from '@/lib/voice/recorder'

interface ChatInputProps {
  onSend: (text: string) => void
  disabled: boolean
  prefill?: string
  placeholder?: string
}

type VoiceState = 'idle' | 'recording' | 'processing'

export function ChatInput({ onSend, disabled, prefill, placeholder }: ChatInputProps) {
  const [text, setText] = useState('')
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // handleAutoStop is defined below — forward-declare ref for the hook
  const autoStopRef = useRef<((blob: Blob) => void) | undefined>(undefined)

  const {
    isRecording,
    duration,
    error: voiceError,
    isSupported: voiceSupported,
    mimeType,
    startRecording,
    stopRecording,
  } = useVoiceRecorder({ onAutoStop: (blob) => autoStopRef.current?.(blob) })

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
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  function showTranscriptionError(msg: string) {
    setTranscriptionError(msg)
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
    errorTimerRef.current = setTimeout(() => setTranscriptionError(null), 5000)
  }

  /** Transcribe a recorded audio blob and place result in the text field for user review */
  async function transcribeToField(blob: Blob) {
    setVoiceState('processing')
    try {
      const ext = mimeType.includes('mp4') ? 'mp4' : 'webm'

      const formData = new FormData()
      formData.append('audio', blob, `recording.${ext}`)

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.error || 'Transcription failed')
      }

      const result = await response.json()
      if (result.text && result.text.trim()) {
        setText(result.text)
        // Focus so user can review and edit
        setTimeout(() => inputRef.current?.focus(), 50)
      } else {
        showTranscriptionError('No speech detected. Try speaking louder.')
      }
    } catch {
      showTranscriptionError("Couldn't transcribe audio. Tap to try again.")
    } finally {
      setVoiceState('idle')
    }
  }

  /** Handle auto-stop at recording limit — transcribe to field */
  const handleAutoStop = useCallback((blob: Blob) => {
    transcribeToField(blob)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mimeType])

  // Keep autoStopRef in sync so the hook's stable callback can reach the latest handler
  useEffect(() => { autoStopRef.current = handleAutoStop }, [handleAutoStop])

  async function handleVoiceTap() {
    if (disabled && voiceState === 'idle') return

    // Clear any existing error on tap
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

  // Reset voice state if recording stops externally (but not during auto-stop processing)
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
    <div className="border-t border-border bg-bg px-3 py-2.5 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-end gap-2">
        {/* Mic button — compact icon, not an orb */}
        {voiceSupported && (
          <button
            type="button"
            disabled={disabled && voiceState === 'idle'}
            onClick={handleVoiceTap}
            className={cn(
              'relative flex-shrink-0 w-10 h-10 rounded-full',
              'flex items-center justify-center',
              'transition-all duration-200 active:scale-95',
              voiceState === 'idle' && 'text-warm-gray/60 hover:text-text hover:bg-bg-sage',
              voiceState === 'recording' && 'text-primary bg-primary/10',
              voiceState === 'processing' && 'text-warm-gray/40',
              disabled && voiceState === 'idle' && 'opacity-40'
            )}
            aria-label={
              voiceState === 'idle' ? 'Start recording' :
              voiceState === 'recording' ? 'Stop recording' :
              'Processing audio'
            }
          >
            {/* Pulse ring when recording */}
            {voiceState === 'recording' && (
              <span className="absolute inset-0 rounded-full border-2 border-primary animate-ping opacity-40" />
            )}

            {voiceState === 'processing' ? (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : voiceState === 'recording' ? (
              // Stop icon when recording
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              // Mic icon at rest
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                <path d="M19 10v2a7 7 0 01-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            )}
          </button>
        )}

        {/* Text field — takes majority of bar width */}
        <div className="flex-1 flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              voiceState === 'recording'
                ? `Recording... ${formatDuration(duration)}`
                : voiceState === 'processing'
                ? 'Transcribing...'
                : placeholder || 'Type a message...'
            }
            disabled={disabled || voiceState === 'recording'}
            rows={1}
            className={cn(
              'flex-1 resize-none overflow-hidden',
              'min-h-[40px] max-h-[120px] px-3 py-2.5',
              'bg-bg-card border border-border rounded-xl',
              'text-text text-[15px] placeholder:text-text-secondary/60',
              'focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-1',
              'disabled:opacity-50',
              'transition-all duration-150'
            )}
            style={{ height: 'auto' }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement
              target.style.height = 'auto'
              target.style.height = Math.min(target.scrollHeight, 120) + 'px'
            }}
          />

          {/* Send button — only active when text present */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={disabled || !text.trim() || voiceState !== 'idle'}
            className={cn(
              'flex-shrink-0 w-10 h-10 rounded-full',
              'flex items-center justify-center',
              'transition-all duration-200 active:scale-95',
              text.trim() && !disabled
                ? 'bg-primary text-white hover:bg-primary-hover'
                : 'bg-bg-card text-warm-gray/40 border border-border',
              'disabled:cursor-not-allowed'
            )}
            aria-label="Send message"
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
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>

      {/* Voice / transcription errors */}
      {(voiceError || transcriptionError) && (
        <p className="text-accent-terra text-xs mt-1.5 text-center px-2">{voiceError || transcriptionError}</p>
      )}
    </div>
  )
}
