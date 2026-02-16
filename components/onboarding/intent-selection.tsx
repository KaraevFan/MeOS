'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface IntentSelectionProps {
  onSelect: (intent: string) => void
  initialIntent?: string | null
}

const INTENTS = [
  { label: 'Things are good — I want to be more intentional', value: 'intentional' },
  { label: "I'm starting something new", value: 'new_start' },
  { label: "I'm feeling stuck or scattered", value: 'stuck' },
  { label: "I'm going through a tough time", value: 'tough_time' },
  { label: 'Just exploring', value: 'exploring' },
]

// Lucide-style inline SVG icons (no emojis per MeOS design system)
function SproutIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M7 20h10" />
      <path d="M10 20c5.5-2.5.8-6.4 3-10" />
      <path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z" />
      <path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z" />
    </svg>
  )
}

function RocketIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  )
}

function OrbitIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="3" />
      <circle cx="19" cy="5" r="2" />
      <circle cx="5" cy="19" r="2" />
      <path d="M10.4 21.9a10 10 0 0 0 9.941-15.416" />
      <path d="M13.5 2.1a10 10 0 0 0-9.841 15.416" />
    </svg>
  )
}

function WavesIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
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

const ICONS = [SproutIcon, RocketIcon, OrbitIcon, WavesIcon, SparklesIcon]

const ease = [0.25, 0.46, 0.45, 0.94] as const

export function IntentSelection({ onSelect, initialIntent }: IntentSelectionProps) {
  const [selected, setSelected] = useState<string | null>(initialIntent ?? null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
  }, [])

  function handleSelect(value: string) {
    setSelected(value)
    timeoutRef.current = setTimeout(() => onSelect(value), 300)
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
        What&apos;s going on in your world right now?
      </motion.h1>

      {/* Subtext */}
      <motion.p
        className="text-[15px] text-text-secondary mb-10"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15, ease }}
      >
        Pick whatever fits best — there&apos;s no wrong answer.
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
              <span className={cn('text-[15px] leading-snug', isSelected ? 'text-primary font-medium' : 'text-text')}>
                {intent.label}
              </span>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
