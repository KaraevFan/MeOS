'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface RatingScaleProps {
  value: number | null
  onSelect: (value: number) => void
}

const LABELS = ['Rough', 'Struggling', 'Okay', 'Good', 'Thriving']

export function RatingScale({ value, onSelect }: RatingScaleProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      {/* End labels */}
      <div className="flex justify-between w-full max-w-[280px] px-1">
        <span className="text-[10px] uppercase tracking-[0.08em] text-text-secondary font-medium">
          Rough
        </span>
        <span className="text-[10px] uppercase tracking-[0.08em] text-text-secondary font-medium">
          Thriving
        </span>
      </div>

      {/* Scale */}
      <div className="relative flex items-center justify-between w-full max-w-[280px]" role="radiogroup" aria-label="Rating scale">
        {/* Connecting line */}
        <div className="absolute inset-x-[22px] top-1/2 -translate-y-1/2 h-[1.5px] bg-border opacity-30" />

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
              {/* Unselected circle */}
              <div
                className={cn(
                  'w-[44px] h-[44px] rounded-full border-[1.5px] transition-opacity duration-200',
                  isSelected ? 'opacity-0' : 'border-border opacity-100 bg-bg/60'
                )}
              />

              {/* Selected indicator */}
              {isSelected && (
                <motion.div
                  className="absolute inset-0 flex items-center justify-center"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', damping: 14, stiffness: 220 }}
                >
                  <div
                    className="w-[44px] h-[44px] rounded-full bg-primary"
                    style={{ boxShadow: '0 0 12px rgba(212, 165, 116, 0.35)' }}
                  />
                </motion.div>
              )}
            </button>
          )
        })}
      </div>

      {/* Selected label */}
      <div className="h-6">
        <AnimatePresence mode="wait">
          {value !== null && (
            <motion.p
              key={value}
              className="text-[13px] font-medium text-primary tracking-wide text-center"
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
