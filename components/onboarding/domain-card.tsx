'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { RatingScale } from './rating-scale'

interface DomainCardProps {
  domain: string
  rating: number | null
  onRate: (value: number) => void
  isFirst: boolean
  showSageMessage: boolean
  currentIndex: number
  totalDomains: number
  onBack: () => void
}

const ease = [0.25, 0.46, 0.45, 0.94] as const

export function DomainCard({
  domain,
  rating,
  onRate,
  isFirst,
  showSageMessage,
  currentIndex,
  totalDomains,
  onBack,
}: DomainCardProps) {
  return (
    <div className="flex flex-col min-h-[100dvh] relative z-10">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-5 pb-2">
        <motion.button
          type="button"
          onClick={onBack}
          className="p-2 text-text-secondary hover:text-text transition-colors"
          aria-label="Go back"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </motion.button>

        <motion.span
          className="text-[13px] text-text-secondary font-medium"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          {currentIndex + 1} of {totalDomains}
        </motion.span>
      </div>

      {/* Content — centered vertically */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
        {/* Sage message (first domain only) */}
        <AnimatePresence>
          {isFirst && showSageMessage && (
            <motion.p
              className="text-[17px] text-text-secondary/60 italic text-center mb-6 select-none"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5 }}
              style={{ fontStyle: 'italic' }}
            >
              Quick gut check — don&apos;t overthink these.
            </motion.p>
          )}
        </AnimatePresence>

        {/* Domain name */}
        <motion.h2
          className="text-[36px] font-bold text-text text-center mb-14"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          {domain}
        </motion.h2>

        {/* Rating scale */}
        <motion.div
          className="w-full"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2, ease }}
        >
          <RatingScale value={rating} onSelect={onRate} />
        </motion.div>

        {/* Hint text */}
        <AnimatePresence>
          {rating === null && (
            <motion.p
              className="text-[11px] text-text-secondary/50 mt-6 select-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, delay: 0.4 }}
            >
              tap to rate
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
