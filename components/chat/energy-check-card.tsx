'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { SuggestionPill } from './suggestion-pills'

/** Emoji decoration lookup — purely cosmetic, not a data dependency. */
const ENERGY_EMOJI: Record<string, string> = {
  'fired up': '\uD83D\uDD25',
  'focused': '\u26A1',
  'neutral': '\uD83D\uDE10',
  'low energy': '\uD83D\uDE34',
  'stressed': '\uD83D\uDE24',
}

function getEmoji(label: string): string | undefined {
  const key = label.toLowerCase().replace(/^[\p{Emoji}\s]+/u, '').trim()
  return ENERGY_EMOJI[key]
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
      <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm">
        <p className="px-4 pt-3.5 pb-2 text-[13px] font-medium tracking-wide text-text-secondary">
          How are you feeling today?
        </p>
        <div className="flex flex-col">
          {pills.map((pill, i) => {
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
                  'flex items-center gap-3 px-4 min-h-[44px] text-left',
                  'transition-all duration-150',
                  i < pills.length - 1 && 'border-b border-border/50',
                  isSelected
                    ? 'bg-primary/10 text-primary font-semibold'
                    : isDisabled
                      ? 'opacity-40'
                      : 'hover:bg-primary/5 active:bg-primary/10',
                )}
              >
                {emoji && (
                  <span className="text-lg leading-none w-6 text-center">{emoji}</span>
                )}
                <span className="text-[15px]">{pill.label}</span>
                {isSelected && (
                  <span className="ml-auto text-primary text-sm">{'\u2713'}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
