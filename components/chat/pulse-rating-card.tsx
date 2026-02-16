'use client'

import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { PULSE_DOMAINS, PULSE_RATING_OPTIONS } from '@/types/pulse-check'
import type { PulseCheckRating, PulseRating } from '@/types/pulse-check'

interface PulseRatingCardProps {
  previousRatings?: PulseCheckRating[]
  onSubmit: (ratings: PulseCheckRating[]) => void
  onSkip: () => void
  isSubmitting: boolean
}

const RATING_COLORS: Record<PulseRating, string> = {
  thriving: 'bg-status-thriving text-white',
  good: 'bg-accent-sage text-white',
  okay: 'bg-primary text-white',
  struggling: 'bg-accent-terra text-white',
  in_crisis: 'bg-status-crisis text-white',
}

export function PulseRatingCard({ previousRatings, onSubmit, onSkip, isSubmitting }: PulseRatingCardProps) {
  // Pre-populate with previous ratings
  const [ratings, setRatings] = useState<Map<string, PulseRating>>(() => {
    const initial = new Map<string, PulseRating>()
    if (previousRatings) {
      for (const r of previousRatings) {
        initial.set(r.domainKey, r.rating)
      }
    }
    return initial
  })

  const handleRate = useCallback((domainKey: string, rating: PulseRating) => {
    setRatings((prev) => {
      const next = new Map(prev)
      next.set(domainKey, rating)
      return next
    })
  }, [])

  const handleSubmit = useCallback(() => {
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
    onSubmit(result)
  }, [ratings, onSubmit])

  const ratedCount = ratings.size

  return (
    <div className="w-full bg-bg-sage rounded-lg border border-border p-4 animate-fade-up">
      <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-3">
        Quick pulse check
      </p>

      <div className="space-y-2.5 max-h-[50vh] overflow-y-auto">
        {PULSE_DOMAINS.map((domain) => {
          const selected = ratings.get(domain.key) || null

          return (
            <div key={domain.key} className="flex items-center gap-2">
              <span className="text-xs font-medium text-text w-28 flex-shrink-0 truncate">
                {domain.label}
              </span>
              <div className="flex gap-1 flex-1">
                {PULSE_RATING_OPTIONS.map((option) => {
                  const isSelected = selected === option.value
                  return (
                    <button
                      key={option.value}
                      onClick={() => handleRate(domain.key, option.value)}
                      disabled={isSubmitting}
                      aria-label={`${domain.label}: ${option.label}`}
                      className={cn(
                        'flex-1 h-8 rounded text-[10px] font-medium transition-all duration-150',
                        'active:scale-95 disabled:opacity-50',
                        isSelected
                          ? cn(RATING_COLORS[option.value], 'shadow-sm')
                          : 'bg-bg border border-border text-text-secondary hover:border-primary/40'
                      )}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <button
          onClick={onSkip}
          disabled={isSubmitting}
          className="text-xs text-text-secondary hover:text-text transition-colors"
        >
          Skip
        </button>
        <button
          onClick={handleSubmit}
          disabled={ratedCount === 0 || isSubmitting}
          className={cn(
            'h-9 px-5 rounded-md text-sm font-medium transition-all duration-150',
            ratedCount > 0 && !isSubmitting
              ? 'bg-primary text-white hover:bg-primary-hover active:scale-95'
              : 'bg-border text-text-secondary cursor-not-allowed'
          )}
        >
          {isSubmitting ? 'Saving...' : 'Done'}
        </button>
      </div>
    </div>
  )
}
