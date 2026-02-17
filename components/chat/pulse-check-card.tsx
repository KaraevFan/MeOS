'use client'

import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { PULSE_DOMAINS, PULSE_RATING_OPTIONS } from '@/types/pulse-check'
import type { PulseCheckRating, PulseRating } from '@/types/pulse-check'

interface PulseCheckCardProps {
  onSubmit: (ratings: PulseCheckRating[]) => Promise<void>
  isSubmitting: boolean
  submitError: string | null
  onRetry: () => void
}

const RATING_COLORS: Record<PulseRating, { selected: string; ring: string; tint: string }> = {
  thriving: { selected: 'bg-status-thriving text-white', ring: 'ring-status-thriving/30', tint: 'bg-status-thriving/10' },
  good: { selected: 'bg-accent-sage text-white', ring: 'ring-accent-sage/30', tint: 'bg-accent-sage/10' },
  okay: { selected: 'bg-primary text-white', ring: 'ring-primary/30', tint: 'bg-primary/10' },
  struggling: { selected: 'bg-accent-terra text-white', ring: 'ring-accent-terra/30', tint: 'bg-accent-terra/10' },
  in_crisis: { selected: 'bg-status-crisis text-white', ring: 'ring-status-crisis/30', tint: 'bg-status-crisis/10' },
}

export function PulseCheckCard({ onSubmit, isSubmitting, submitError, onRetry }: PulseCheckCardProps) {
  const [ratings, setRatings] = useState<Map<string, PulseRating>>(new Map())

  const ratedCount = ratings.size
  const canSubmit = ratedCount >= 4 && !isSubmitting

  const handleRate = useCallback((domainKey: string, rating: PulseRating) => {
    setRatings((prev) => {
      const next = new Map(prev)
      next.set(domainKey, rating)
      return next
    })
  }, [])

  const handleSubmit = useCallback(async () => {
    const result: PulseCheckRating[] = []
    for (const domain of PULSE_DOMAINS) {
      const rating = ratings.get(domain.key)
      if (rating) {
        const option = PULSE_RATING_OPTIONS.find((o) => o.value === rating)
        result.push({
          domain: domain.label,
          domainKey: domain.key,
          rating,
          ratingNumeric: option?.numeric ?? 3,
        })
      }
    }
    await onSubmit(result)
  }, [ratings, onSubmit])

  return (
    <div className="w-full bg-amber-50/80 rounded-lg border border-primary/20 p-4 animate-fade-up">
      <h3 className="text-base font-bold text-text tracking-tight mb-3">
        Life Pulse Check
      </h3>

      <div className="space-y-2 max-h-[60vh] overflow-y-auto">
        {PULSE_DOMAINS.map((domain) => {
          const selected = ratings.get(domain.key) || null

          return (
            <div
              key={domain.key}
              role="radiogroup"
              aria-label={`Rate ${domain.label}`}
            >
              <p className="text-sm font-medium text-text mb-1.5">{domain.label}</p>
              <div className="flex gap-1.5">
                {PULSE_RATING_OPTIONS.map((option) => {
                  const isSelected = selected === option.value
                  const colors = RATING_COLORS[option.value]

                  return (
                    <motion.button
                      key={option.value}
                      role="radio"
                      aria-checked={isSelected}
                      aria-label={`${option.numeric} - ${option.label}`}
                      onClick={() => handleRate(domain.key, option.value)}
                      disabled={isSubmitting}
                      whileTap={{ scale: 0.95 }}
                      whileHover={{ scale: 1.02 }}
                      className={cn(
                        'flex-1 min-h-[44px] rounded-md flex flex-col items-center justify-center gap-0.5',
                        'transition-colors duration-150',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        isSelected
                          ? cn(colors.selected, 'shadow-sm')
                          : cn(colors.tint, 'border border-border text-text-secondary hover:border-primary/40')
                      )}
                    >
                      <span className="text-[11px] font-bold leading-none">{option.numeric}</span>
                      <span className="text-[9px] font-medium leading-none">{option.label}</span>
                    </motion.button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-text-secondary">
          {ratedCount} of 8 rated{ratedCount < 4 ? ' (min 4)' : ''}
        </p>
        <button
          onClick={submitError ? onRetry : handleSubmit}
          disabled={!canSubmit}
          className={cn(
            'h-10 px-6 rounded-md text-sm font-medium transition-all duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
            canSubmit
              ? 'bg-primary text-white hover:bg-primary-hover active:scale-95 shadow-sm'
              : 'bg-border text-text-secondary cursor-not-allowed'
          )}
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Saving...
            </span>
          ) : submitError ? (
            'Try again'
          ) : (
            'Done'
          )}
        </button>
      </div>

      {/* Error message */}
      {submitError && (
        <p className="mt-2 text-xs text-status-crisis">
          {submitError}
        </p>
      )}
    </div>
  )
}
