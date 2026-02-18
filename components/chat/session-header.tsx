import type { SessionType } from '@/types/chat'

const SESSION_LABELS: Record<SessionType, string> = {
  life_mapping: 'Life Mapping',
  weekly_checkin: 'Weekly Check-In',
  ad_hoc: 'Open Conversation',
  close_day: 'Close the Day',
}

const SESSION_DURATIONS: Partial<Record<SessionType, string>> = {
  life_mapping: '~ 25 min',
  weekly_checkin: '~ 10 min',
  close_day: '~ 3 min',
}

interface SessionHeaderProps {
  sessionType: SessionType
  exploreDomain?: string
  nudgeContext?: string
}

export function SessionHeader({ sessionType, exploreDomain, nudgeContext }: SessionHeaderProps) {
  let label = SESSION_LABELS[sessionType] || 'Conversation'

  // Contextual labels for ad-hoc sessions
  if (sessionType === 'ad_hoc') {
    if (exploreDomain) {
      label = `Exploring ${exploreDomain}`
    } else if (nudgeContext) {
      label = 'Reflection'
    }
  }

  const duration = SESSION_DURATIONS[sessionType]

  return (
    <div className="flex items-center justify-center gap-2 py-3">
      <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
      <span className="text-[11px] text-text-secondary font-medium">{label}</span>
      {duration && (
        <span className="text-[11px] text-text-secondary/60">{duration}</span>
      )}
    </div>
  )
}
