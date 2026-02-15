'use client'

import { motion } from 'framer-motion'
import { RadarChart } from './radar-chart'

interface SummaryScreenProps {
  domains: string[]
  ratings: Record<number, number>
  onStart: () => void
  onEditRatings: () => void
}

const ease = [0.25, 0.46, 0.45, 0.94] as const

export function SummaryScreen({
  domains,
  ratings,
  onStart,
  onEditRatings,
}: SummaryScreenProps) {
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

      {/* Sage observation */}
      <motion.p
        className="text-[15px] text-text-secondary italic text-center max-w-[280px] leading-relaxed mb-10"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.5 }}
      >
        I can see some patterns already. Ready to explore?
      </motion.p>

      {/* CTA Button */}
      <motion.button
        type="button"
        className="w-full max-w-[320px] py-4 bg-primary text-white font-medium text-base rounded-full shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg active:bg-primary-hover transition-colors"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1, duration: 0.5, ease }}
        whileTap={{ scale: 0.97 }}
        onClick={onStart}
      >
        Start Conversation
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
