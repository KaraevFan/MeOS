'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RadarChart } from '@/components/ui/radar-chart'

interface SummaryScreenProps {
  domains: string[]
  ratings: Record<number, number>
  onStart: () => void
  onEditRatings: () => void
  isSubmitting?: boolean
  submitError?: string | null
}

function getFallbackCommentary(ratings: Record<number, number>, domains: string[]): string {
  const entries = domains.map((d, i) => ({ domain: d, score: ratings[i] ?? 3 }))
  const sorted = [...entries].sort((a, b) => a.score - b.score)
  const lowest = sorted[0]
  const highest = sorted[sorted.length - 1]

  if (lowest.score === highest.score) {
    return `You rated everything around ${lowest.score + 1}/5 — a pretty even landscape. Sometimes that means things are stable, sometimes it means nothing's getting enough attention.`
  }

  return `${highest.domain} is where you feel strongest at ${highest.score + 1}/5, while ${lowest.domain} at ${lowest.score + 1}/5 seems to need the most attention. That contrast tells a story.`
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
  const [blurb, setBlurb] = useState<string | null>(null)
  const [blurbLoading, setBlurbLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()

    const domainRatings: Record<string, number> = {}
    domains.forEach((d, i) => {
      // ratings are 0-4 index-based, API expects 1-5
      domainRatings[d] = (ratings[i] ?? 2) + 1
    })

    fetch('/api/generate-blurb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ratings: domainRatings, domains }),
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => setBlurb(data.blurb))
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setBlurb(getFallbackCommentary(ratings, domains))
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setBlurbLoading(false)
      })

    return () => controller.abort()
  }, [domains, ratings])

  const commentary = blurb || getFallbackCommentary(ratings, domains)

  return (
    <div className="flex flex-col items-center min-h-[100dvh] overflow-y-auto px-6 pt-12 pb-10">
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
        className="text-[15px] text-text-secondary/60 mb-6 italic"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        a map, not a grade
      </motion.p>

      {/* Radar Chart — self-contained fixed-height block so labels never overlap content below */}
      <motion.div
        className="w-full max-w-[340px] mb-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        <RadarChart domains={domains} ratings={ratings} maxRating={4} />
      </motion.div>

      {/* Sage observation — natural height, never overlaps chart */}
      <div className="w-full max-w-[300px] mb-8 min-h-[3rem] flex items-start justify-center">
        <AnimatePresence mode="wait">
          {blurbLoading ? (
            <motion.p
              key="loading"
              className="text-[15px] text-text-secondary/50 italic text-center leading-relaxed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              Looking at your ratings...
            </motion.p>
          ) : (
            <motion.p
              key="blurb"
              className="text-[15px] text-text-secondary italic text-center leading-relaxed"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              {commentary}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

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

      <div className="h-6" />
    </div>
  )
}
