'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { SuggestionPill } from './suggestion-pills'

/** Emoji decoration lookup — purely cosmetic, not a data dependency. */
const MOOD_EMOJI: Record<string, string> = {
  'energized': '\uD83D\uDD25',
  'good': '\uD83D\uDE0A',
  'neutral': '\uD83D\uDE10',
  'low': '\uD83D\uDE14',
  'rough': '\uD83D\uDE23',
}

function getEmoji(label: string): string | undefined {
  const key = label.toLowerCase().replace(/^[\p{Emoji}\s]+/u, '').trim()
  return MOOD_EMOJI[key]
}

interface EnergyCheckCardProps {
  pills: SuggestionPill[]
  onSelect: (value: string) => void
  disabled?: boolean
}

export function EnergyCheckCard({ pills, onSelect, disabled }: EnergyCheckCardProps) {
  const [selectedValue, setSelectedValue] = useState<string | null>(null)

  function handleSelect(pill: SuggestionPill) {
    if (selectedValue || disabled) return
    setSelectedValue(pill.value)
    onSelect(pill.value)
  }

  return (
    <div className="px-4 py-2 animate-fade-in-up">
      <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm p-4">
        <p className="pb-3 text-[13px] font-medium tracking-wide text-text-secondary">
          How are you showing up today?
        </p>
        <div className="flex flex-wrap gap-2">
          {pills.map((pill) => {
            const emoji = getEmoji(pill.label)
            const isSelected = selectedValue === pill.value
            const isDisabled = selectedValue !== null && !isSelected

            return (
              <button
                key={pill.value}
                type="button"
                onClick={() => handleSelect(pill)}
                disabled={disabled || selectedValue !== null}
                className={cn(
                  'flex items-center gap-1.5 px-3.5 h-11 rounded-full',
                  'text-[14px] whitespace-nowrap',
                  'border transition-all duration-150',
                  isSelected
                    ? 'bg-primary/10 border-primary/30 text-primary font-semibold'
                    : isDisabled
                      ? 'opacity-30 border-border/50 bg-bg'
                      : 'border-border bg-bg hover:bg-primary/5 active:bg-primary/10',
                )}
              >
                {emoji && (
                  <span className="text-base leading-none">{emoji}</span>
                )}
                <span>{pill.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
