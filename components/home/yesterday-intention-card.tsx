'use client'

import { useState } from 'react'
import { InfoCard } from './info-card'

interface YesterdayIntentionCardProps {
  intention: string
  onCompleted: () => void
  onCarryForward: () => void
}

export function YesterdayIntentionCard({ intention, onCompleted, onCarryForward }: YesterdayIntentionCardProps) {
  const [actioned, setActioned] = useState<'completed' | 'carried' | null>(null)

  function handleCompleted() {
    setActioned('completed')
    onCompleted()
  }

  function handleCarryForward() {
    setActioned('carried')
    onCarryForward()
  }

  return (
    <InfoCard borderColor="blue-gray">
      <div className="flex flex-col gap-3">
        <span className="text-[11px] font-bold tracking-[0.06em] uppercase text-blue-gray">
          Yesterday&apos;s Intention
        </span>
        <p className="text-[15px] italic text-warm-dark/80 leading-relaxed">
          &ldquo;{intention}&rdquo;
        </p>

        {actioned === null ? (
          <div className="flex gap-2.5 mt-1">
            <button
              onClick={handleCompleted}
              className="flex-1 h-9 text-[13px] font-semibold rounded-xl
                         bg-sage/15 text-sage
                         hover:bg-sage/25 active:bg-sage/30
                         transition-colors duration-150"
            >
              Completed
            </button>
            <button
              onClick={handleCarryForward}
              className="flex-1 h-9 text-[13px] font-semibold rounded-xl
                         bg-blue-gray/10 text-blue-gray
                         hover:bg-blue-gray/20 active:bg-blue-gray/25
                         transition-colors duration-150"
            >
              Carry forward
            </button>
          </div>
        ) : (
          <p className="text-[13px] text-warm-gray mt-1">
            {actioned === 'completed' ? 'Marked as completed.' : 'Carried forward to today.'}
          </p>
        )}
      </div>
    </InfoCard>
  )
}
