'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LifeMapPillShelf, getIconForDomain } from './life-map-pill-shelf'
import type { PillDomain } from './life-map-pill-shelf'
import { useSidebarContext } from './sidebar-context'
import { createClient } from '@/lib/supabase/client'
import { ALL_DOMAINS } from '@/lib/constants'
import { STORAGE_BUCKET } from '@/lib/markdown/constants'
import { cn } from '@/lib/utils'
import type { DomainName } from '@/types/chat'

// ─── Tunable constants ───
const AUTO_EXPAND_DURATION = 3000 // ms — primary tuning knob
const FLASH_TEXT_DURATION = 2000  // ms
const DOT_FILL_DURATION = 0.4    // seconds

interface FileIndexRow {
  file_path: string
  file_type: string
  domain_name: string | null
  status: string | null
  frontmatter: Record<string, unknown> | null
  last_updated: string
}

const supabase = createClient()

interface LifeMapProgressPillProps {
  userId: string
  domainsExplored: Set<DomainName>
  pulseCheckRatings: Array<{ domain: string; ratingNumeric: number }> | null
}

export function LifeMapProgressPill({ userId, domainsExplored, pulseCheckRatings }: LifeMapProgressPillProps) {
  const { isStreaming, lastCompletedDomain } = useSidebarContext()
  const [isExpanded, setIsExpanded] = useState(false)
  const [flashText, setFlashText] = useState<string | null>(null)
  const [insightsContent, setInsightsContent] = useState<string | null>(null)
  const [fileIndex, setFileIndex] = useState<FileIndexRow[]>([])
  const autoCollapseRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const userOpenedRef = useRef(false) // tracks whether user manually opened the shelf

  const exploredCount = domainsExplored.size

  // Build pulse rating lookup
  const pulseMap = useMemo(
    () => new Map((pulseCheckRatings ?? []).map((r) => [r.domain, r.ratingNumeric])),
    [pulseCheckRatings]
  )

  // Fetch file_index + insights on mount
  useEffect(() => {
    async function fetchData() {
      const { data: indexData } = await supabase
        .from('file_index')
        .select('file_path, file_type, domain_name, status, frontmatter, last_updated')
        .eq('user_id', userId)
        .in('file_type', ['domain', 'session-insights'])

      if (indexData) {
        setFileIndex(indexData as FileIndexRow[])
        const insightsRow = indexData.find((r) => r.file_type === 'session-insights')
        if (insightsRow) {
          fetchInsights()
        }
      }
    }

    async function fetchInsights() {
      const fullPath = `users/${userId}/sage/session-insights.md`
      const { data } = await supabase.storage.from(STORAGE_BUCKET).download(fullPath)
      if (data) {
        const text = await data.text()
        const bodyMatch = text.match(/^---[\s\S]*?---\s*([\s\S]*)$/)
        setInsightsContent(bodyMatch ? bodyMatch[1].trim() : text.trim())
      }
    }

    fetchData()
  }, [userId])

  // Realtime subscription for file_index changes
  useEffect(() => {
    const channel = supabase
      .channel('pill-file-index')
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
            // Re-fetch insights content
            const fullPath = `users/${userId}/sage/session-insights.md`
            supabase.storage.from(STORAGE_BUCKET).download(fullPath).then(({ data }) => {
              if (data) {
                data.text().then((text) => {
                  const bodyMatch = text.match(/^---[\s\S]*?---\s*([\s\S]*)$/)
                  setInsightsContent(bodyMatch ? bodyMatch[1].trim() : text.trim())
                })
              }
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  // Auto-expand on domain completion
  useEffect(() => {
    if (!lastCompletedDomain) return

    // Flash text always shows
    setFlashText(`${lastCompletedDomain.split('/')[0].trim()} added!`)
    const flashTimer = setTimeout(() => setFlashText(null), FLASH_TEXT_DURATION)

    if (!isExpanded) {
      // Auto-expand
      userOpenedRef.current = false
      setIsExpanded(true)
      autoCollapseRef.current = setTimeout(() => {
        setIsExpanded(false)
        autoCollapseRef.current = null
      }, AUTO_EXPAND_DURATION)
    }
    // If already expanded by user, don't auto-collapse

    return () => {
      clearTimeout(flashTimer)
      if (autoCollapseRef.current) {
        clearTimeout(autoCollapseRef.current)
        autoCollapseRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastCompletedDomain])

  // Cancel auto-collapse on manual interaction
  const cancelAutoCollapse = useCallback(() => {
    if (autoCollapseRef.current) {
      clearTimeout(autoCollapseRef.current)
      autoCollapseRef.current = null
    }
  }, [])

  const handleToggle = useCallback(() => {
    cancelAutoCollapse()
    if (isExpanded) {
      setIsExpanded(false)
      userOpenedRef.current = false
    } else {
      setIsExpanded(true)
      userOpenedRef.current = true
    }
  }, [isExpanded, cancelAutoCollapse])

  const handleClose = useCallback(() => {
    cancelAutoCollapse()
    setIsExpanded(false)
    userOpenedRef.current = false
  }, [cancelAutoCollapse])

  // Build domain data for the shelf (memoized to avoid rebuilding on every streaming tick)
  const domains: PillDomain[] = useMemo(() => {
    const domainFileIndex = new Map(
      fileIndex
        .filter((r) => r.file_type === 'domain' && r.domain_name)
        .map((r) => [r.domain_name!, r])
    )

    return ALL_DOMAINS.map((name) => {
      const indexRow = domainFileIndex.get(name)
      return {
        name,
        iconName: getIconForDomain(name),
        rating: pulseMap.get(name) ?? null,
        explored: domainsExplored.has(name),
        insight: indexRow ? ((indexRow.frontmatter?.preview_line as string) || null) : null,
      }
    })
  }, [fileIndex, domainsExplored, pulseMap])

  // Display text for the pill
  const displayText = flashText ?? `${exploredCount} of ${ALL_DOMAINS.length}`

  return (
    <div className="flex-shrink-0 px-4 py-1.5 relative z-20">
      {/* Collapsed pill */}
      <motion.button
        onClick={handleToggle}
        className={cn(
          'w-full h-11 rounded-full flex items-center gap-2 px-3',
          'bg-bg border border-border/80',
          'transition-shadow duration-300',
          isStreaming && 'shadow-[0_0_8px_rgba(217,119,6,0.15)] border-primary/20'
        )}
        animate={lastCompletedDomain ? { scale: [1, 1.02, 1] } : undefined}
        transition={lastCompletedDomain ? { duration: 0.6, ease: 'easeInOut' } : undefined}
        aria-expanded={isExpanded}
        aria-controls="life-map-shelf"
      >
        {/* Shimmer overlay when streaming */}
        {isStreaming && (
          <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
            <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-primary/[0.06] to-transparent" />
          </div>
        )}

        {/* Sparkle icon */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-primary flex-shrink-0">
          <path d="M12 0L14.59 8.41L23 12L14.59 15.59L12 24L9.41 15.59L1 12L9.41 8.41L12 0Z" />
        </svg>

        {/* Label */}
        <span className="text-[13px] font-medium text-text flex-shrink-0">Life Map</span>

        {/* Dot indicators */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {ALL_DOMAINS.map((domain) => {
            const isExplored = domainsExplored.has(domain)
            const isJustCompleted = lastCompletedDomain === domain
            return (
              <motion.div
                key={domain}
                className={cn(
                  'w-2.5 h-2.5 rounded-full',
                  isExplored ? 'bg-primary' : 'bg-text-secondary/20'
                )}
                animate={isJustCompleted ? { scale: [0, 1.3, 1] } : undefined}
                transition={isJustCompleted ? { duration: DOT_FILL_DURATION, ease: 'easeOut' } : undefined}
              />
            )
          })}
        </div>

        {/* Count / flash text */}
        <span className="text-[13px] font-medium text-text-secondary ml-auto flex-shrink-0">
          {displayText}
        </span>

        {/* Chevron */}
        <motion.svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-text-secondary/60 flex-shrink-0"
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.3 }}
        >
          <polyline points="6 9 12 15 18 9" />
        </motion.svg>
      </motion.button>

      {/* Expanded shelf + backdrop */}
      <AnimatePresence>
        {isExpanded && (
          <>
            {/* Backdrop — covers chat area below pill */}
            <motion.div
              className="fixed inset-0 z-30 bg-text/[0.15]"
              style={{ top: 'auto', bottom: 0, height: '100vh' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={handleClose}
              aria-hidden="true"
            />

            {/* Shelf panel */}
            <div
              id="life-map-shelf"
              className="relative z-30 mt-2"
              role="dialog"
              aria-label="Life map progress"
              onClick={cancelAutoCollapse}
            >
              <LifeMapPillShelf
                domains={domains}
                lastCompletedDomain={lastCompletedDomain}
                insightsContent={insightsContent}
                exploredCount={exploredCount}
                pulseRatings={pulseMap}
                onClose={handleClose}
              />
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
