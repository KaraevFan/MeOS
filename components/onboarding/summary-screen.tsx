'use client'

import { motion } from 'framer-motion'
import { RadarChart } from './radar-chart'

interface SummaryScreenProps {
  domains: string[]
  ratings: Record<number, number>
  onStart: () => void
  onEditRatings: () => void
  isSubmitting?: boolean
  submitError?: string | null
}

function getRadarCommentary(ratings: Record<number, number>): string {
  const values = Object.values(ratings)
  if (values.length === 0) {
    return "Ready to explore what's underneath?"
  }

  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length
  const stddev = Math.sqrt(variance)

  // High variance takes priority — it's the most interesting pattern
  if (stddev > 1.0) {
    return "Interesting — some areas are really strong while others are pulling for attention. Let's explore that."
  }
  // Ratings are 0-4 (index-based), so 3.5+ means mostly Good/Thriving
  if (mean >= 3.5) {
    return "You're doing well across the board — let's figure out where to focus your energy for the biggest impact."
  }
  // Mostly low
  if (mean <= 1.5) {
    return "It sounds like things have been tough lately. That's exactly why mapping it out helps — let's find where to start."
  }
  // Mid-range
  return "Looks like things are generally okay but there might be room to dig deeper. Let's find out what's underneath."
}

const ease = [0.25, 0.46, 0.45, 0.94] as const

export function SummaryScreen({
  domains,
  ratings,
  onStart,
  onEditRatings,
  isSubmitting,
  submitError,
}: SummaryScreenProps) {
  const commentary = getRadarCommentary(ratings)

  return (
    <div className="flex flex-col items-center min-h-[100dvh] px-6 pt-16 pb-12 relative z-10">
      {/* Heading */}
      <motion.h1
        className="text-[32px] font-bold text-text mb-2 text-center"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
      >
        Here&apos;s your life snapshot
      </motion.h1>

      <motion.p
        className="text-[15px] text-text-secondary/60 mb-8 italic"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        a map, not a grade
      </motion.p>

      {/* Radar Chart */}
      <motion.div
        className="w-full max-w-[360px] mb-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        <RadarChart domains={domains} ratings={ratings} maxRating={4} />
      </motion.div>

      {/* Sage observation — now dynamic */}
      <motion.p
        className="text-[15px] text-text-secondary italic text-center max-w-[280px] leading-relaxed mb-10"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.5 }}
      >
        {commentary}
      </motion.p>

      {/* Error message */}
      {submitError && (
        <motion.p
          className="text-accent-terra text-sm text-center mb-4 max-w-[320px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {submitError}
        </motion.p>
      )}

      {/* CTA Button */}
      <motion.button
        type="button"
        className="w-full max-w-[320px] py-4 bg-primary text-white font-medium text-base rounded-full shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg active:bg-primary-hover transition-colors disabled:opacity-50"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1, duration: 0.5, ease }}
        whileTap={{ scale: 0.97 }}
        onClick={onStart}
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Setting up...' : submitError ? 'Try Again' : 'Start Conversation'}
      </motion.button>

      {/* Edit ratings link */}
      <motion.button
        type="button"
        className="mt-4 text-[13px] text-text-secondary underline underline-offset-2 decoration-text-secondary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1, duration: 0.4 }}
        onClick={onEditRatings}
      >
        Edit ratings
      </motion.button>
    </div>
  )
}
