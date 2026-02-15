'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface IntentSelectionProps {
  onSelect: (intent: string) => void
}

const INTENTS = [
  { label: 'Feeling scattered — need more focus', value: 'scattered' },
  { label: 'Going through a transition', value: 'transition' },
  { label: 'Want more clarity on what matters', value: 'clarity' },
  { label: 'Just curious', value: 'curious' },
]

// Simple inline SVG icons
function ShuffleIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="16 3 21 3 21 8" />
      <line x1="4" y1="20" x2="21" y2="3" />
      <polyline points="21 16 21 21 16 21" />
      <line x1="15" y1="15" x2="21" y2="21" />
      <line x1="4" y1="4" x2="9" y2="9" />
    </svg>
  )
}

function CompassIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z" />
      <path d="M19 15l.5 2 2 .5-2 .5-.5 2-.5-2-2-.5 2-.5z" />
    </svg>
  )
}

const ICONS = [ShuffleIcon, CompassIcon, SearchIcon, SparklesIcon]

const ease = [0.25, 0.46, 0.45, 0.94] as const

export function IntentSelection({ onSelect }: IntentSelectionProps) {
  const [selected, setSelected] = useState<string | null>(null)

  function handleSelect(value: string) {
    setSelected(value)
    setTimeout(() => onSelect(value), 300)
  }

  return (
    <div className="flex flex-col min-h-[100dvh] px-6 pt-20 pb-12 relative z-10">
      {/* Heading */}
      <motion.h1
        className="text-[30px] font-bold text-text mb-2"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
      >
        What brought you here today?
      </motion.h1>

      {/* Subtext */}
      <motion.p
        className="text-[15px] text-text-secondary mb-10"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15, ease }}
      >
        No wrong answers — just helps me know where to start.
      </motion.p>

      {/* Intent pills */}
      <div className="space-y-3">
        {INTENTS.map((intent, i) => {
          const Icon = ICONS[i]
          const isSelected = selected === intent.value
          return (
            <motion.button
              key={intent.value}
              type="button"
              onClick={() => handleSelect(intent.value)}
              aria-pressed={isSelected}
              className={cn(
                'w-full flex items-center gap-3 rounded-2xl border-[1.5px] px-5 py-[18px] text-left transition-colors',
                isSelected
                  ? 'border-primary bg-primary/[0.08]'
                  : 'border-border bg-white/40'
              )}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.2 + i * 0.08, ease }}
              whileTap={{ scale: 0.98 }}
            >
              <Icon className={cn('flex-shrink-0 w-5 h-5', isSelected ? 'text-primary' : 'text-text-secondary')} />
              <span className={cn('text-[15px]', isSelected ? 'text-primary font-medium' : 'text-text')}>
                {intent.label}
              </span>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
