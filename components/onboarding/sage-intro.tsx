'use client'

import { motion } from 'framer-motion'

interface SageIntroProps {
  onContinue: () => void
}

const ease = [0.25, 0.46, 0.45, 0.94] as const

export function SageIntro({ onContinue }: SageIntroProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] px-6 pb-12 relative z-10">
      {/* Sage avatar */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease }}
        className="mb-8"
      >
        <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
          <circle cx="36" cy="36" r="36" fill="url(#sage-glow)" opacity="0.15" />
          <circle cx="36" cy="36" r="28" fill="url(#sage-grad)" />
          <circle cx="36" cy="36" r="20" fill="#FAF7F2" opacity="0.12" />
          <circle cx="29" cy="32" r="2" fill="#3D3832" opacity="0.35" />
          <circle cx="43" cy="32" r="2" fill="#3D3832" opacity="0.35" />
          <path d="M30 42 Q36 46 42 42" stroke="#3D3832" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.25" />
          <defs>
            <radialGradient id="sage-glow" cx="0.5" cy="0.5" r="0.5">
              <stop stopColor="#D4A574" />
              <stop offset="1" stopColor="#D4A574" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="sage-grad" cx="0.3" cy="0.3" r="0.7">
              <stop stopColor="#E8C9A0" />
              <stop offset="1" stopColor="#D4A574" />
            </radialGradient>
          </defs>
        </svg>
      </motion.div>

      {/* Heading */}
      <motion.h1
        className="text-[34px] font-bold text-text text-center mb-3"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.25, ease }}
      >
        Hey — I&apos;m Sage.
      </motion.h1>

      {/* Subtext */}
      <motion.p
        className="text-[17px] text-text-secondary text-center max-w-[300px] leading-relaxed"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.45, ease }}
      >
        I&apos;m going to help you build a map of where you are in life right now.
      </motion.p>

      {/* CTA — fixed to bottom */}
      <motion.div
        className="fixed bottom-0 left-0 right-0 px-6 pb-12 pt-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.75, ease }}
      >
        <button
          onClick={onContinue}
          type="button"
          className="w-full max-w-[320px] mx-auto block py-4 bg-primary text-white font-medium text-base rounded-full shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg active:bg-primary-hover transition-colors"
        >
          Let&apos;s go
        </button>
      </motion.div>
    </div>
  )
}
