'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface RatingScaleProps {
  value: number | null
  onSelect: (value: number) => void
}

const LABELS = ['Rough', 'Struggling', 'Okay', 'Good', 'Thriving']

// Gradient hint colors (unselected state) — visible color gradient across scale
const HINT_COLORS = [
  'bg-status-crisis/35',     // Rough
  'bg-status-attention/35',  // Struggling
  'bg-primary/30',           // Okay
  'bg-accent-sage/35',       // Good
  'bg-accent-sage/45',       // Thriving
]

// Selected state colors
const SELECTED_COLORS = [
  'bg-status-crisis',     // Rough — #B05A5A
  'bg-status-attention',  // Struggling — #C17B5D
  'bg-primary',           // Okay — #D97706
  'bg-accent-sage',       // Good — #7D8E7B
  'bg-accent-sage',       // Thriving — #7D8E7B
]

// Selected glow shadows
const SELECTED_SHADOWS = [
  '0 0 12px rgba(176, 90, 90, 0.35)',
  '0 0 12px rgba(193, 123, 93, 0.35)',
  '0 0 12px rgba(212, 165, 116, 0.35)',
  '0 0 12px rgba(125, 142, 123, 0.35)',
  '0 0 14px rgba(125, 142, 123, 0.45)',
]

// Label text colors (match selected circle)
const LABEL_COLORS = [
  'text-status-crisis',
  'text-status-attention',
  'text-primary',
  'text-accent-sage',
  'text-accent-sage',
]

export function RatingScale({ value, onSelect }: RatingScaleProps) {
  return (
    <div className="flex flex-col items-center gap-2.5">
      {/* End labels */}
      <div className="flex justify-between w-full max-w-[280px] px-1">
        <span className="text-[10px] uppercase tracking-[0.08em] text-text font-semibold">
          Rough
        </span>
        <span className="text-[10px] uppercase tracking-[0.08em] text-text font-semibold">
          Thriving
        </span>
      </div>

      {/* Scale */}
      <div className="relative flex items-center justify-between w-full max-w-[280px]" role="radiogroup" aria-label="Rating scale">
        {/* Connecting line — gradient from crisis to sage */}
        <div
          className="absolute inset-x-[22px] top-1/2 -translate-y-1/2 h-[1.5px] opacity-20"
          style={{
            background: 'linear-gradient(to right, #B05A5A, #C17B5D, #D97706, #7D8E7B, #7D8E7B)',
          }}
        />

        {LABELS.map((label, i) => {
          const isSelected = value === i
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(i)}
              aria-label={`Rate as ${label}`}
              aria-checked={isSelected}
              role="radio"
              className="relative w-12 h-12 flex items-center justify-center z-10"
            >
              {/* Unselected circle — gradient hint color */}
              <div
                className={cn(
                  'w-[44px] h-[44px] rounded-full border-[1.5px] transition-opacity duration-200',
                  isSelected ? 'opacity-0' : `border-border opacity-100 ${HINT_COLORS[i]}`
                )}
              />

              {/* Selected indicator — status color + number + glow */}
              {isSelected && (
                <motion.div
                  className="absolute inset-0 flex items-center justify-center"
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', damping: 14, stiffness: 220 }}
                >
                  <div
                    className={cn('w-[44px] h-[44px] rounded-full flex items-center justify-center', SELECTED_COLORS[i])}
                    style={{ boxShadow: SELECTED_SHADOWS[i] }}
                  >
                    <span className="text-white text-sm font-semibold leading-none">{i + 1}</span>
                  </div>
                </motion.div>
              )}
            </button>
          )
        })}
      </div>

      {/* Selected label — color matches selected circle */}
      <div className="h-5">
        <AnimatePresence mode="wait">
          {value !== null && (
            <motion.p
              key={value}
              className={cn('text-[13px] font-medium tracking-wide text-center', LABEL_COLORS[value])}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25 }}
            >
              {LABELS[value]}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
