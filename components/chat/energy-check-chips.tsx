'use client'

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

interface EnergyCheckChipsProps {
  pills: SuggestionPill[]
  onSelect: (value: string) => void
  disabled?: boolean
}

export function EnergyCheckChips({ pills, onSelect, disabled }: EnergyCheckChipsProps) {
  return (
    <div className="flex gap-2 px-4 py-2 overflow-x-auto animate-fade-in-up">
      {pills.map((pill) => {
        const emoji = getEmoji(pill.label)
        return (
          <button
            key={pill.value}
            type="button"
            onClick={() => onSelect(pill.value)}
            disabled={disabled}
            className={cn(
              'flex items-center gap-1.5 px-3.5 py-2.5 rounded-full min-h-[44px] whitespace-nowrap',
              'border border-border bg-bg text-text text-sm font-medium',
              'hover:bg-primary hover:text-white hover:border-primary',
              'active:scale-95 transition-all duration-150',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {emoji && <span className="text-base leading-none">{emoji}</span>}
            <span>{pill.label}</span>
          </button>
        )
      })}
    </div>
  )
}
