'use client'

import type { SuggestedRepliesData } from '@/types/chat'

interface SuggestedReplyButtonsProps {
  data: SuggestedRepliesData
  onSelect: (text: string) => void
  disabled?: boolean
}

export function SuggestedReplyButtons({ data, onSelect, disabled }: SuggestedReplyButtonsProps) {
  return (
    <div
      className="flex flex-wrap gap-2 px-4 py-2 animate-fade-up"
      style={{ animation: 'fade-in-up 0.3s ease-out both' }}
    >
      {data.replies.map((reply) => (
        <button
          key={reply}
          onClick={() => onSelect(reply)}
          disabled={disabled}
          className="px-4 py-2.5 text-sm font-medium text-text rounded-full
                     bg-bg border border-border
                     hover:bg-primary hover:text-white hover:border-primary
                     active:bg-primary-hover active:text-white active:border-primary-hover
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors duration-150"
        >
          {reply}
        </button>
      ))}
    </div>
  )
}
