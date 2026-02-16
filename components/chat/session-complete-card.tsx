'use client'

import Link from 'next/link'
import type { SessionType } from '@/types/chat'

interface SessionCompleteCardProps {
  sessionType: SessionType
  nextCheckinDate: string | null
}

export function SessionCompleteCard({ sessionType, nextCheckinDate }: SessionCompleteCardProps) {
  const isLifeMapping = sessionType === 'life_mapping'

  const formattedDate = nextCheckinDate
    ? new Date(nextCheckinDate).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      })
    : null

  return (
    <div
      className="w-full max-w-[90%] rounded-lg border border-primary/15 bg-bg-sage p-5 shadow-sm animate-fade-up"
      style={{ animation: 'fade-in-up 0.4s ease-out both' }}
    >
      <p className="text-[15px] font-medium text-text">
        {isLifeMapping ? 'Your life map is ready.' : 'Check-in saved.'}
      </p>

      {formattedDate && (
        <p className="mt-1.5 text-sm text-text-secondary">
          Next check-in: {formattedDate}
        </p>
      )}

      <Link
        href={isLifeMapping ? '/life-map?from=session' : '/home'}
        className="mt-4 flex items-center justify-center h-10 px-5 bg-primary text-white text-sm font-medium rounded-md
                   hover:bg-primary-hover transition-colors shadow-sm"
      >
        {isLifeMapping ? 'View your Life Map' : 'Back to Home'}
      </Link>
    </div>
  )
}
