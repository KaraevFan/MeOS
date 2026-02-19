'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { DOMAIN_SHORT_NAMES } from '@/lib/constants'
import type { DomainName } from '@/types/chat'

interface DomainSlotCompactProps {
  name: string
  iconName: string
  rating: number | null  // 1–5 from pulse check
  explored: boolean
  justCompleted: boolean
}

const SLOT_SPRING = { stiffness: 300, damping: 15 }

export function DomainSlotCompact({ name, iconName, rating, explored, justCompleted }: DomainSlotCompactProps) {
  const displayName = DOMAIN_SHORT_NAMES[name as DomainName] ?? name

  return (
    <motion.div
      className="flex flex-col items-center gap-0.5"
      initial={justCompleted ? { scale: 0.8 } : false}
      animate={{ scale: 1 }}
      transition={justCompleted ? { type: 'spring', ...SLOT_SPRING } : undefined}
    >
      <motion.div
        className={cn(
          'w-9 h-9 rounded-xl flex items-center justify-center',
          explored ? 'bg-primary/10' : 'bg-text-secondary/[0.08]'
        )}
        animate={justCompleted ? { scale: [1, 1.2, 1] } : undefined}
        transition={justCompleted ? { duration: 0.5, ease: 'easeOut' } : undefined}
      >
        <DomainIcon
          name={iconName}
          className={cn(
            'w-[18px] h-[18px]',
            explored ? 'text-primary' : 'text-text-secondary/60'
          )}
          strokeWidth={explored ? 2 : 1.5}
        />
      </motion.div>
      <span className="text-[10px] text-text-secondary text-center leading-tight truncate max-w-[56px]">
        {displayName}
      </span>
      {explored && rating != null && (
        <span className="text-[9px] font-bold text-primary leading-none">
          {rating}/5
        </span>
      )}
    </motion.div>
  )
}

/** Inline SVG icons for the 8 life domains — matches Lucide icon style */
function DomainIcon({ name, className, strokeWidth = 2 }: { name: string; className?: string; strokeWidth?: number }) {
  const props = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
  }

  switch (name) {
    case 'Briefcase':
      return (
        <svg {...props}>
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
          <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
        </svg>
      )
    case 'Heart':
      return (
        <svg {...props}>
          <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
        </svg>
      )
    case 'Activity':
      return (
        <svg {...props}>
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      )
    case 'DollarSign':
      return (
        <svg {...props}>
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
        </svg>
      )
    case 'BookOpen':
      return (
        <svg {...props}>
          <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
          <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
        </svg>
      )
    case 'Palette':
      return (
        <svg {...props}>
          <circle cx="13.5" cy="6.5" r="0.5" fill="currentColor" />
          <circle cx="17.5" cy="10.5" r="0.5" fill="currentColor" />
          <circle cx="8.5" cy="7.5" r="0.5" fill="currentColor" />
          <circle cx="6.5" cy="12" r="0.5" fill="currentColor" />
          <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 011.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
        </svg>
      )
    case 'Gamepad2':
      return (
        <svg {...props}>
          <line x1="6" y1="11" x2="10" y2="11" />
          <line x1="8" y1="9" x2="8" y2="13" />
          <line x1="15" y1="12" x2="15.01" y2="12" />
          <line x1="18" y1="10" x2="18.01" y2="10" />
          <path d="M17.32 5H6.68a4 4 0 00-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 003 3c1.11 0 2.08-.402 2.592-1.286l.608-.957C8.74 15.848 9.792 15 11 15h2c1.208 0 2.26.848 2.8 1.757l.608.957C16.92 18.598 17.89 19 19 19a3 3 0 003-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0017.32 5z" />
        </svg>
      )
    case 'Compass':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
        </svg>
      )
    default:
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
        </svg>
      )
  }
}
