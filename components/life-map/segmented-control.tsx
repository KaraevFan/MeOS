'use client'

import { cn } from '@/lib/utils'

type Tab = 'where-i-am' | 'what-im-doing'

interface SegmentedControlProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}

export type { Tab }

export function SegmentedControl({ activeTab, onTabChange }: SegmentedControlProps) {
  return (
    <div className="flex bg-bg rounded-lg p-0.5 border border-border">
      <button
        onClick={() => onTabChange('where-i-am')}
        className={cn(
          'flex-1 text-sm font-medium py-2 px-3 rounded-md transition-colors',
          activeTab === 'where-i-am'
            ? 'bg-bg-card text-text shadow-sm'
            : 'text-text-secondary hover:text-text'
        )}
      >
        Where I Am
      </button>
      <button
        onClick={() => onTabChange('what-im-doing')}
        className={cn(
          'flex-1 text-sm font-medium py-2 px-3 rounded-md transition-colors',
          activeTab === 'what-im-doing'
            ? 'bg-bg-card text-text shadow-sm'
            : 'text-text-secondary hover:text-text'
        )}
      >
        What I&apos;m Doing
      </button>
    </div>
  )
}
