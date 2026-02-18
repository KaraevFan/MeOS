'use client'

import type { IntentionCardData } from '@/types/chat'

interface IntentionCardProps {
  data: IntentionCardData
  onKeep: () => void
  onChange: () => void
  disabled?: boolean
}

export function IntentionCard({ data, onKeep, onChange, disabled }: IntentionCardProps) {
  return (
    <div
      className="w-full max-w-[85%] rounded-lg bg-bg-card border border-border shadow-sm overflow-hidden
                 animate-fade-up"
      style={{ animation: 'fade-in-up 0.3s ease-out both' }}
    >
      <div className="px-4 py-2.5 border-b border-border">
        <p className="text-[11px] font-medium text-text-secondary tracking-wide uppercase">
          Yesterday&apos;s Intention
        </p>
      </div>
      <div className="px-4 py-4">
        <p className="text-[15px] text-text font-medium leading-relaxed">
          &ldquo;{data.intention}&rdquo;
        </p>
      </div>
      <div className="flex gap-3 px-4 pb-4">
        <button
          onClick={onKeep}
          disabled={disabled}
          className="flex-1 h-10 text-sm font-medium rounded-md
                     bg-primary text-white
                     hover:bg-primary-hover
                     active:bg-primary-hover
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors duration-150"
        >
          Keep
        </button>
        <button
          onClick={onChange}
          disabled={disabled}
          className="flex-1 h-10 text-sm font-medium rounded-md
                     bg-transparent text-text border border-border
                     hover:bg-bg-sage
                     active:bg-bg-sage
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors duration-150"
        >
          Change
        </button>
      </div>
    </div>
  )
}
