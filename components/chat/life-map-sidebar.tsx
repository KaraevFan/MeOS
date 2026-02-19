'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { RadarChart } from '@/components/ui/radar-chart'
import { useSidebarContext } from './sidebar-context'
import { ALL_DOMAINS, DOMAIN_SHORT_NAMES } from '@/lib/constants'
import { STORAGE_BUCKET } from '@/lib/markdown/constants'
import { cn } from '@/lib/utils'
import type { DomainName, DomainStatus } from '@/types/chat'

/** Narrower type — sidebar only needs domain + numeric rating, not the full PulseCheckRating */
interface SidebarPulseRating {
  domain: string
  ratingNumeric: number
}

interface FileIndexRow {
  file_path: string
  file_type: string
  domain_name: string | null
  status: string | null
  frontmatter: Record<string, unknown> | null
  last_updated: string
}

interface DomainSlot {
  domain: DomainName
  state: 'unexplored' | 'active' | 'explored'
  previewLine?: string
  status?: DomainStatus
  pulseRating?: number
}

interface LifeMapSidebarProps {
  userId: string
}

const supabase = createClient()

const STATUS_DOT_COLORS: Record<string, string> = {
  thriving: 'bg-status-thriving',
  stable: 'bg-accent-sage',
  needs_attention: 'bg-primary',
  in_crisis: 'bg-status-crisis',
}

const PULSE_DOT_COLORS: Record<number, string> = {
  5: 'bg-status-thriving/60',
  4: 'bg-accent-sage/60',
  3: 'bg-primary/60',
  2: 'bg-accent-terra/60',
  1: 'bg-status-crisis/60',
}

export function LifeMapSidebar({ userId }: LifeMapSidebarProps) {
  const { activeDomain } = useSidebarContext()

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar-collapsed') === 'true'
    }
    return false
  })
  const [fileIndex, setFileIndex] = useState<FileIndexRow[]>([])
  const [insightsContent, setInsightsContent] = useState<string | null>(null)
  const [pulseRatings, setPulseRatings] = useState<SidebarPulseRating[]>([])

  // Persist collapsed state
  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(collapsed))
  }, [collapsed])

  const fetchInsightsContent = useCallback(async () => {
    const fullPath = `users/${userId}/sage/session-insights.md`
    const { data } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(fullPath)

    if (data) {
      const text = await data.text()
      // Strip frontmatter if present
      const bodyMatch = text.match(/^---[\s\S]*?---\s*([\s\S]*)$/)
      setInsightsContent(bodyMatch ? bodyMatch[1].trim() : text.trim())
    }
  }, [userId])

  // Fetch initial data
  useEffect(() => {
    async function fetchInitialData() {
      // Fetch file_index entries for domain and session-insights types
      const { data: indexData } = await supabase
        .from('file_index')
        .select('file_path, file_type, domain_name, status, frontmatter, last_updated')
        .eq('user_id', userId)
        .in('file_type', ['domain', 'session-insights'])

      if (indexData) {
        setFileIndex(indexData as FileIndexRow[])

        // If session-insights exists, read the file content
        const insightsRow = indexData.find((r) => r.file_type === 'session-insights')
        if (insightsRow) {
          fetchInsightsContent()
        }
      }

      // Fetch baseline pulse ratings
      const { data: latestRating } = await supabase
        .from('pulse_check_ratings')
        .select('session_id')
        .eq('user_id', userId)
        .eq('is_baseline', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (latestRating) {
        const { data: ratings } = await supabase
          .from('pulse_check_ratings')
          .select('domain_name, rating_numeric')
          .eq('session_id', latestRating.session_id)
          .eq('is_baseline', true)

        if (ratings) {
          setPulseRatings(
            ratings.map((r) => ({
              domain: r.domain_name as string,
              ratingNumeric: r.rating_numeric as number,
            }))
          )
        }
      }
    }

    fetchInitialData()
  }, [userId, fetchInsightsContent])

  // Supabase Realtime subscription for file_index changes
  useEffect(() => {
    const channel = supabase
      .channel('sidebar-file-index')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'file_index',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = (payload.new || payload.old) as FileIndexRow | undefined
          if (!row) return

          if (row.file_type === 'domain') {
            setFileIndex((prev) => {
              const existing = prev.findIndex((r) => r.file_path === row.file_path)
              if (existing >= 0) {
                const updated = [...prev]
                updated[existing] = row
                return updated
              }
              return [...prev, row]
            })
          } else if (row.file_type === 'session-insights') {
            fetchInsightsContent()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, fetchInsightsContent])

  // Build domain slot data
  const pulseMap = new Map(pulseRatings.map((r) => [r.domain, r.ratingNumeric]))
  const domainFileIndex = new Map(
    fileIndex
      .filter((r) => r.file_type === 'domain' && r.domain_name)
      .map((r) => [r.domain_name!, r])
  )

  const slots: DomainSlot[] = ALL_DOMAINS.map((domain) => {
    const indexRow = domainFileIndex.get(domain)
    const isActive = activeDomain === domain

    if (isActive) {
      return {
        domain,
        state: 'active' as const,
        pulseRating: pulseMap.get(domain),
      }
    }

    if (indexRow) {
      return {
        domain,
        state: 'explored' as const,
        previewLine: (indexRow.frontmatter?.preview_line as string) || undefined,
        status: (indexRow.status as DomainStatus) || 'stable',
        pulseRating: pulseMap.get(domain),
      }
    }

    return {
      domain,
      state: 'unexplored' as const,
      pulseRating: pulseMap.get(domain),
    }
  })

  const exploredCount = slots.filter((s) => s.state === 'explored').length
  const exploredDomains = slots.filter((s) => s.state === 'explored').map((s) => s.domain)

  // Build radar chart data from pulse ratings
  const ratingsMap: Record<number, number> = {}
  ALL_DOMAINS.forEach((domain, i) => {
    const rating = pulseMap.get(domain)
    if (rating !== undefined) {
      ratingsMap[i] = rating - 1 // RadarChart uses 0-based for maxRating=5
    }
  })

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="hidden lg:flex w-10 h-full items-center justify-center bg-bg-card border-l border-border hover:bg-bg-card/80 transition-colors"
        aria-label="Expand sidebar"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-text-secondary">
          <path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    )
  }

  return (
    <div className="hidden lg:flex flex-col w-[320px] h-full bg-bg-card border-l border-border overflow-y-auto">
      {/* Header with collapse toggle */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h3 className="text-sm font-semibold text-text tracking-tight">Life Map</h3>
        <button
          onClick={() => setCollapsed(true)}
          className="p-1 rounded hover:bg-bg transition-colors"
          aria-label="Collapse sidebar"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-text-secondary">
            <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Compact Radar Chart */}
      {pulseRatings.length > 0 && (
        <div className="px-6 pb-2">
          <RadarChart
            domains={ALL_DOMAINS}
            ratings={ratingsMap}
            maxRating={4}
            size={200}
            exploredDomains={exploredDomains}
            labels={ALL_DOMAINS.map(d => DOMAIN_SHORT_NAMES[d])}
          />
        </div>
      )}

      {/* Progress bar */}
      <div className="px-4 pb-3">
        <p className="text-xs text-text-secondary mb-1.5">{exploredCount} of {ALL_DOMAINS.length} explored</p>
        <div className="h-1.5 bg-border rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${(exploredCount / ALL_DOMAINS.length) * 100}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Domain slots */}
      <div className="flex-1 px-3 space-y-1">
        <AnimatePresence mode="popLayout">
          {slots.map((slot) => (
            <DomainSlotCard key={slot.domain} slot={slot} />
          ))}
        </AnimatePresence>
      </div>

      {/* Emerging Patterns */}
      {insightsContent && exploredCount >= 2 && (
        <motion.div
          className="px-4 py-3 border-t border-border"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
            Emerging Patterns
          </h4>
          <p className="text-xs text-text leading-relaxed whitespace-pre-line">
            {insightsContent}
          </p>
        </motion.div>
      )}
    </div>
  )
}

function DomainSlotCard({ slot }: { slot: DomainSlot }) {
  if (slot.state === 'active') {
    return (
      <motion.div
        layout
        className="flex items-start gap-2 px-3 py-2 rounded-lg border border-primary/20 bg-primary/5"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <motion.div
          className="mt-1 w-2 h-2 rounded-full bg-primary"
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-text truncate">{slot.domain}</p>
          <p className="text-[10px] text-primary italic">Exploring...</p>
        </div>
      </motion.div>
    )
  }

  if (slot.state === 'explored') {
    const dotColor = STATUS_DOT_COLORS[slot.status || 'stable'] || STATUS_DOT_COLORS.stable
    return (
      <motion.div
        layout
        className="flex items-start gap-2 px-3 py-2 rounded-lg border border-border/50 bg-bg/50"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className={cn('mt-1 w-2 h-2 rounded-full', dotColor)} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-text truncate">{slot.domain}</p>
          {slot.previewLine && (
            <p className="text-[10px] text-text-secondary truncate">{slot.previewLine}</p>
          )}
        </div>
      </motion.div>
    )
  }

  // Unexplored
  const pulseDot = slot.pulseRating ? PULSE_DOT_COLORS[slot.pulseRating] || PULSE_DOT_COLORS[3] : 'bg-border'
  return (
    <div className="flex items-start gap-2 px-3 py-2 rounded-lg border border-dashed border-border/40">
      <div className={cn('mt-1 w-2 h-2 rounded-full', pulseDot)} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-text-secondary truncate">{slot.domain}</p>
        <p className="text-[10px] text-text-secondary/50">Not explored</p>
      </div>
    </div>
  )
}
