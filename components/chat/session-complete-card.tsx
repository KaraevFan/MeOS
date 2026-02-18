'use client'

import Link from 'next/link'
import type { SessionType } from '@/types/chat'

interface SessionCompleteCardProps {
  sessionType: SessionType
  nextCheckinDate: string | null
}

export function SessionCompleteCard({ sessionType, nextCheckinDate }: SessionCompleteCardProps) {
  const isLifeMapping = sessionType === 'life_mapping'
  const isCloseDay = sessionType === 'close_day'
  const isOpenDay = sessionType === 'open_day'

  const formattedDate = nextCheckinDate
    ? new Date(nextCheckinDate).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      })
    : null

  const title = isOpenDay
    ? "You're set. Go make it happen."
    : isCloseDay
    ? 'Day logged. Sleep well.'
    : isLifeMapping
    ? 'Your life map is ready.'
    : 'Check-in saved.'

  const ctaLabel = isLifeMapping ? 'View your Life Map' : 'Back to Home'
  const ctaHref = isLifeMapping ? '/life-map?from=session' : '/home'

  return (
    <div
      className="w-full max-w-[90%] rounded-lg border border-primary/15 bg-bg-sage p-5 shadow-sm animate-fade-up"
      style={{ animation: 'fade-in-up 0.4s ease-out both' }}
    >
      <p className="text-[15px] font-medium text-text">
        {title}
      </p>

      {formattedDate && !isCloseDay && !isOpenDay && (
        <p className="mt-1.5 text-sm text-text-secondary">
          Next check-in: {formattedDate}
        </p>
      )}

      <Link
        href={ctaHref}
        className="mt-4 flex items-center justify-center h-10 px-5 bg-primary text-white text-sm font-medium rounded-md
                   hover:bg-primary-hover transition-colors shadow-sm"
      >
        {ctaLabel}
      </Link>
    </div>
  )
}
