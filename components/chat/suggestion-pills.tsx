'use client'

import { cn } from '@/lib/utils'

export interface SuggestionPill {
  label: string
  value: string
  variant?: 'default' | 'primary'
}

interface SuggestionPillsProps {
  pills: SuggestionPill[]
  onSelect: (value: string) => void
  disabled?: boolean
}

export function SuggestionPills({ pills, onSelect, disabled }: SuggestionPillsProps) {
  const visible = pills.slice(0, 3)
  if (visible.length === 0) return null

  return (
    <div className="flex gap-2 px-4 py-2 animate-fade-in-up">
      {visible.map((pill) => (
        <button
          key={pill.value}
          type="button"
          onClick={() => onSelect(pill.value)}
          disabled={disabled}
          className={cn(
            'flex-1 min-w-0 truncate px-4 py-2.5 text-sm font-medium rounded-full min-h-[44px]',
            'active:scale-95 transition-all duration-150',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            pill.variant === 'primary'
              ? 'bg-primary border border-primary text-white hover:bg-primary-hover'
              : 'bg-bg border border-border text-text hover:bg-primary hover:text-white hover:border-primary'
          )}
          title={pill.label}
        >
          {pill.label}
        </button>
      ))}
    </div>
  )
}
