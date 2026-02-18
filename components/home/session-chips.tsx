'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { TimeState } from './home-screen'

interface SessionChipsProps {
  activeState: TimeState
}

const chips: { id: TimeState; label: string; href: string; icon: React.ReactNode }[] = [
  {
    id: 'morning',
    label: 'Open Day',
    href: '/chat?type=open_day',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>
    ),
  },
  {
    id: 'midday',
    label: 'Capture',
    href: '/chat?type=ad_hoc',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
        <path d="M19 10v2a7 7 0 01-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    ),
  },
  {
    id: 'evening',
    label: 'Close Day',
    href: '/chat?type=close_day',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
      </svg>
    ),
  },
]

export function SessionChips({ activeState }: SessionChipsProps) {
  return (
    <div className="flex gap-2 px-6 mt-2 mb-1">
      {chips.map((chip) => {
        const isActive = activeState === chip.id
        return (
          <Link
            key={chip.id}
            href={chip.href}
            className={cn(
              'flex items-center gap-1.5 px-3.5 h-[34px] rounded-full text-[13px] font-semibold transition-all',
              isActive
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-warm-dark/[0.04] text-warm-gray hover:bg-warm-dark/[0.07]'
            )}
          >
            <span className={cn(isActive ? 'text-white' : 'text-warm-gray/70')}>
              {chip.icon}
            </span>
            {chip.label}
          </Link>
        )
      })}
    </div>
  )
}
