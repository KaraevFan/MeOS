'use client'

import { motion } from 'framer-motion'
import { RadarChart } from '@/components/ui/radar-chart'
import { DomainSlotCompact } from './domain-slot-compact'
import { ALL_DOMAINS, RADAR_ABBREVIATED_LABELS } from '@/lib/constants'
import type { DomainName } from '@/types/chat'

export interface PillDomain {
  name: DomainName
  iconName: string
  rating: number | null  // 1–5 from pulse check
  explored: boolean
  insight: string | null
}

interface LifeMapPillShelfProps {
  domains: PillDomain[]
  lastCompletedDomain: string | null
  insightsContent: string | null
  exploredCount: number
  pulseRatings: Map<string, number>
  onClose: () => void
}

const SHELF_SPRING = { stiffness: 200, damping: 25 }

/** Domain → icon mapping (matches spec) */
const DOMAIN_ICONS: Record<string, string> = {
  'Career / Work': 'Briefcase',
  'Relationships': 'Heart',
  'Health / Body': 'Activity',
  'Finances': 'DollarSign',
  'Learning / Growth': 'BookOpen',
  'Creative Pursuits': 'Palette',
  'Play / Fun / Adventure': 'Gamepad2',
  'Meaning / Purpose': 'Compass',
}

export function getIconForDomain(domain: string): string {
  return DOMAIN_ICONS[domain] ?? 'Compass'
}

export function LifeMapPillShelf({
  domains,
  lastCompletedDomain,
  insightsContent,
  exploredCount,
  pulseRatings,
  onClose,
}: LifeMapPillShelfProps) {
  // Build radar chart data
  const ratingsMap: Record<number, number> = {}
  ALL_DOMAINS.forEach((domain, i) => {
    const rating = pulseRatings.get(domain)
    if (rating !== undefined) {
      ratingsMap[i] = rating - 1 // RadarChart uses 0-based for maxRating=4
    }
  })
  const exploredDomains = domains.filter((d) => d.explored).map((d) => d.name)

  return (
    <motion.div
      className="rounded-2xl bg-bg-card border border-border shadow-md p-4 relative"
      initial={{ opacity: 0, height: 0, y: -10 }}
      animate={{ opacity: 1, height: 'auto', y: 0 }}
      exit={{ opacity: 0, height: 0, y: -10 }}
      transition={{ type: 'spring', ...SHELF_SPRING }}
      style={{ maxHeight: 'calc(100vh - 180px)', overflowY: 'auto' }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-3 right-3 w-7 h-7 rounded-full bg-text-secondary/[0.08] flex items-center justify-center hover:bg-text-secondary/[0.15] transition-colors"
        aria-label="Close life map panel"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Spider chart */}
      <div className="flex justify-center px-6 mb-3">
        <RadarChart
          domains={ALL_DOMAINS as unknown as string[]}
          ratings={ratingsMap}
          maxRating={4}
          size={180}
          exploredDomains={exploredDomains}
          labels={RADAR_ABBREVIATED_LABELS}
        />
      </div>

      {/* Domain grid — 4 columns */}
      <div className="grid grid-cols-4 gap-3 mb-3">
        {domains.map((domain) => (
          <DomainSlotCompact
            key={domain.name}
            name={domain.name}
            iconName={domain.iconName}
            rating={domain.rating}
            explored={domain.explored}
            justCompleted={lastCompletedDomain === domain.name}
          />
        ))}
      </div>

      {/* Emerging patterns — only when >= 2 explored */}
      {insightsContent && exploredCount >= 2 && (
        <div className="border-t border-border/50 pt-3">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary/70 mb-1.5">
            Emerging Patterns
          </h4>
          <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-line">
            {insightsContent}
          </p>
        </div>
      )}
    </motion.div>
  )
}
