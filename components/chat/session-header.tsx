import type { SessionType } from '@/types/chat'

const SESSION_LABELS: Record<SessionType, string> = {
  life_mapping: 'Life Mapping',
  weekly_checkin: 'Weekly Check-In',
  open_conversation: 'Open Conversation',
  close_day: 'Close the Day',
  open_day: 'Open the Day',
  quick_capture: 'Quick Capture',
}

const SESSION_DURATIONS: Partial<Record<SessionType, string>> = {
  life_mapping: '~ 25 min',
  weekly_checkin: '~ 10 min',
  close_day: '~ 3 min',
  open_day: '~ 3 min',
}

interface SessionHeaderProps {
  sessionType: SessionType
  exploreDomain?: string
  nudgeContext?: string
  activeMode?: string | null
  onExit?: () => void
}

export function SessionHeader({ sessionType, exploreDomain, nudgeContext, activeMode, onExit }: SessionHeaderProps) {
  // When in a structured arc within open_conversation, show the arc's label
  const effectiveType = (activeMode as SessionType) ?? sessionType
  let label = SESSION_LABELS[effectiveType] || 'Conversation'

  // Contextual labels for open_conversation without an active mode
  if (sessionType === 'open_conversation' && !activeMode) {
    if (exploreDomain) {
      label = `Exploring ${exploreDomain}`
    } else if (nudgeContext) {
      label = 'Reflection'
    }
  }

  const duration = SESSION_DURATIONS[effectiveType]

  return (
    <div className="relative flex items-center justify-center py-3">
      {onExit && (
        <button
          onClick={onExit}
          className="absolute left-0 p-2 text-text-secondary/60 hover:text-text-secondary transition-colors active:scale-95 min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Exit session"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
        <span className="text-[11px] text-text-secondary font-medium">{label}</span>
        {duration && (
          <span className="text-[11px] text-text-secondary/60">{duration}</span>
        )}
      </div>
    </div>
  )
}
