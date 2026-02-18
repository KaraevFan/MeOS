'use client'

import Link from 'next/link'
import { BreathingOrb } from '@/components/ui/breathing-orb'
import type { SessionType } from '@/types/chat'

interface ActiveSessionCardProps {
  sessionId: string
  sessionType: SessionType
}

const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  life_mapping: 'life mapping',
  weekly_checkin: 'weekly check-in',
  ad_hoc: 'conversation',
  close_day: 'evening reflection',
  open_day: 'morning session',
  quick_capture: 'quick capture',
}

export function ActiveSessionCard({ sessionId, sessionType }: ActiveSessionCardProps) {
  const typeLabel = SESSION_TYPE_LABELS[sessionType] || 'conversation'

  return (
    <div className="flex flex-col items-center gap-md py-md">
      <Link href={`/chat?session=${sessionId}`}>
        <BreathingOrb />
      </Link>
      <Link
        href={`/chat?session=${sessionId}`}
        className="text-sm font-medium text-primary hover:text-primary-hover transition-colors"
      >
        Continue your {typeLabel}
      </Link>
      <Link
        href="/chat?type=ad_hoc"
        className="text-xs text-text-secondary/60 hover:text-text-secondary transition-colors"
      >
        Start new conversation
      </Link>
    </div>
  )
}
