'use client'

import { useState } from 'react'
import { InfoCard } from './info-card'

interface CheckinCardProps {
  intention: string
}

export function CheckinCard({ intention }: CheckinCardProps) {
  const [response, setResponse] = useState<string | null>(null)

  if (response) {
    const messages: Record<string, string> = {
      yes: 'Great, keep going!',
      'not-yet': 'No rush. You know what matters.',
      snooze: 'Noted. Check back later.',
    }
    return (
      <InfoCard borderColor="amber">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span className="text-[11px] font-bold tracking-[0.06em] uppercase text-amber-600/80">
              Check-in
            </span>
          </div>
          <p className="text-[14px] text-warm-gray">
            {messages[response]}
          </p>
        </div>
      </InfoCard>
    )
  }

  return (
    <InfoCard borderColor="amber">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          <span className="text-[11px] font-bold tracking-[0.06em] uppercase text-amber-600/80">
            Check-in
          </span>
        </div>
        <p className="text-[14px] text-warm-dark/85 leading-relaxed">
          You set an intention to <span className="italic">{intention}</span>. Still on track?
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setResponse('yes')}
            className="h-8 px-4 text-[13px] font-semibold rounded-xl
                       bg-amber-500 text-white
                       hover:bg-amber-600 active:bg-amber-700
                       transition-colors duration-150"
          >
            Yes
          </button>
          <button
            onClick={() => setResponse('not-yet')}
            className="h-8 px-4 text-[13px] font-semibold rounded-xl
                       bg-warm-dark/[0.04] text-warm-dark/70
                       hover:bg-warm-dark/[0.08]
                       transition-colors duration-150"
          >
            Not yet
          </button>
          <button
            onClick={() => setResponse('snooze')}
            className="h-8 px-3 text-[13px] font-medium text-warm-gray
                       hover:text-warm-dark/70
                       transition-colors duration-150"
          >
            Snooze
          </button>
        </div>
      </div>
    </InfoCard>
  )
}
