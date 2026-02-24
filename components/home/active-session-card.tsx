'use client'

import Link from 'next/link'
import { SESSION_TYPE_LABELS_LOWER } from '@/lib/session-labels'
import type { SessionType } from '@/types/chat'

interface ActiveSessionCardProps {
  sessionId: string
  sessionType: SessionType
}

export function ActiveSessionCard({ sessionId, sessionType }: ActiveSessionCardProps) {
  const typeLabel = SESSION_TYPE_LABELS_LOWER[sessionType]

  return (
    <div className="flex flex-col gap-2">
      <Link
        href={`/chat?session=${sessionId}`}
        className="block rounded-2xl bg-white border border-warm-dark/[0.04] shadow-[0_1px_4px_rgba(61,56,50,0.04)] px-4 py-3 min-h-[44px] hover:shadow-md transition-shadow"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-amber-100">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-warm-dark">
              Continue your {typeLabel}
            </p>
            <p className="text-[13px] text-warm-gray">
              Tap to pick up where you left off
            </p>
          </div>
        </div>
      </Link>
      <Link
        href="/chat?type=open_conversation"
        className="text-[13px] text-warm-gray/60 hover:text-warm-gray text-center transition-colors"
      >
        Start a new conversation
      </Link>
    </div>
  )
}
