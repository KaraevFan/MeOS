'use client'

import { cn } from '@/lib/utils'

interface EnergyOption {
  emoji: string
  label: string
  value: string
}

const ENERGY_OPTIONS: EnergyOption[] = [
  { emoji: '\uD83D\uDD25', label: 'Fired up', value: '\uD83D\uDD25 Fired up' },
  { emoji: '\u26A1', label: 'Focused', value: '\u26A1 Focused' },
  { emoji: '\uD83D\uDE10', label: 'Neutral', value: '\uD83D\uDE10 Neutral' },
  { emoji: '\uD83D\uDE34', label: 'Low energy', value: '\uD83D\uDE34 Low energy' },
  { emoji: '\uD83D\uDE24', label: 'Stressed', value: '\uD83D\uDE24 Stressed' },
]

interface EnergyCheckChipsProps {
  onSelect: (value: string) => void
  disabled?: boolean
}

export function EnergyCheckChips({ onSelect, disabled }: EnergyCheckChipsProps) {
  return (
    <div className="flex gap-2 px-4 py-2 overflow-x-auto animate-fade-in-up">
      {ENERGY_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onSelect(option.value)}
          disabled={disabled}
          className={cn(
            'flex items-center gap-1.5 px-3.5 py-2.5 rounded-full min-h-[44px] whitespace-nowrap',
            'border border-border bg-bg text-text text-sm font-medium',
            'hover:bg-primary hover:text-white hover:border-primary',
            'active:scale-95 transition-all duration-150',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          <span className="text-base leading-none">{option.emoji}</span>
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  )
}
