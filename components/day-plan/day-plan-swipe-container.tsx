'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { DayPlanView } from './day-plan-view'
import { shiftDate } from '@/lib/dates'
import type { DayPlanWithCaptures } from '@/types/day-plan'
import type { CalendarEvent } from '@/lib/calendar/types'

interface DayPlanSwipeContainerProps {
  initialDate: string
  today: string
  initialData: DayPlanWithCaptures
  calendarEvents?: CalendarEvent[]
  hasCalendarIntegration?: boolean
}

// Swipe gesture thresholds
const SWIPE_THRESHOLD = 50
const SWIPE_MAX_VERTICAL = 60
// 30-day lookback max
const MAX_LOOKBACK_DAYS = 30

/** Format YYYY-MM-DD as "Feb 20" style short date. */
function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00')
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Minimal runtime check that a fetch response looks like DayPlanWithCaptures. */
function isDayPlanResponse(value: unknown): value is DayPlanWithCaptures {
  return (
    typeof value === 'object' &&
    value !== null &&
    'captures' in value &&
    Array.isArray((value as DayPlanWithCaptures).captures)
  )
}

export function DayPlanSwipeContainer({ initialDate, today, initialData, calendarEvents, hasCalendarIntegration }: DayPlanSwipeContainerProps) {
  const router = useRouter()
  const [currentDate, setCurrentDate] = useState(initialDate)
  const [data, setData] = useState<DayPlanWithCaptures>(initialData)
  const [isLoading, setIsLoading] = useState(false)

  // Touch tracking refs
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  // Abort in-flight requests when navigating to a new date
  const abortRef = useRef<AbortController | null>(null)
  // Client-side cache for visited dates (historical dates are immutable)
  const cacheRef = useRef<Map<string, DayPlanWithCaptures>>(new Map())

  // Seed cache with initial server data
  useEffect(() => {
    cacheRef.current.set(initialDate, initialData)
  }, [initialDate, initialData])

  // Compute earliest allowed date (30 days before today) — stable across renders
  const earliestDate = useMemo(() => shiftDate(today, -MAX_LOOKBACK_DAYS), [today])

  const canGoBack = currentDate > earliestDate
  const canGoForward = currentDate < today
  const isToday = currentDate === today

  const fetchDayPlan = useCallback(async (date: string) => {
    // Return cached data immediately if available
    const cached = cacheRef.current.get(date)
    if (cached) {
      setData(cached)
      return
    }

    // Cancel any in-flight request
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsLoading(true)
    try {
      const res = await fetch(`/api/day-plan?date=${date}`, { signal: controller.signal })
      if (res.ok) {
        const json: unknown = await res.json()
        if (isDayPlanResponse(json)) {
          cacheRef.current.set(date, json)
          setData(json)
        }
      }
    } catch (err) {
      // Ignore abort errors; keep current data on network errors
      if (err instanceof DOMException && err.name === 'AbortError') return
    } finally {
      // Only clear loading if this controller wasn't superseded
      if (abortRef.current === controller) {
        setIsLoading(false)
      }
    }
  }, [])

  const navigateToDate = useCallback((newDate: string) => {
    if (newDate < earliestDate || newDate > today) return
    setCurrentDate(newDate)
    fetchDayPlan(newDate)
  }, [earliestDate, today, fetchDayPlan])

  const handlePrev = useCallback(() => {
    if (canGoBack) navigateToDate(shiftDate(currentDate, -1))
  }, [canGoBack, currentDate, navigateToDate])

  const handleNext = useCallback(() => {
    if (canGoForward) navigateToDate(shiftDate(currentDate, 1))
  }, [canGoForward, currentDate, navigateToDate])

  // Touch handlers for swipe
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return
    const touch = e.changedTouches[0]
    const deltaX = touch.clientX - touchStartRef.current.x
    const deltaY = Math.abs(touch.clientY - touchStartRef.current.y)
    touchStartRef.current = null

    // Reject if too much vertical movement (user is scrolling)
    if (deltaY > SWIPE_MAX_VERTICAL) return
    // Reject if not enough horizontal movement
    if (Math.abs(deltaX) < SWIPE_THRESHOLD) return

    if (deltaX < 0) {
      // Swipe left → go to previous day (older)
      handlePrev()
    } else {
      // Swipe right → go to next day (newer)
      handleNext()
    }
  }, [handlePrev, handleNext])

  // When initialData changes (server re-render), sync state
  useEffect(() => {
    if (initialDate === currentDate) {
      setData(initialData)
    }
  }, [initialDate, initialData, currentDate])

  // Force server re-render on mount only when data is known stale
  // (session completion sets this flag; cleared after refresh to avoid repeated fetches)
  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('dayPlanStale')) {
      sessionStorage.removeItem('dayPlanStale')
      router.refresh()
    }
  }, [router])

  // Clean up abort controller on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="relative min-h-full"
    >
      {/* Date navigation arrows */}
      <div className="flex items-center justify-between px-5 pt-6 pb-1">
        <button
          onClick={handlePrev}
          disabled={!canGoBack || isLoading}
          className="p-2 rounded-full text-warm-gray/60 hover:text-warm-gray disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous day"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <div className="text-center">
          <p className="text-[11px] font-medium uppercase tracking-widest text-warm-gray/60">
            {isToday ? 'Your day' : formatShortDate(currentDate)}
          </p>
        </div>

        <button
          onClick={handleNext}
          disabled={!canGoForward || isLoading}
          className="p-2 rounded-full text-warm-gray/60 hover:text-warm-gray disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Next day"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Return to today button — only when viewing past dates */}
      {!isToday && (
        <div className="flex justify-center px-5 pb-2">
          <button
            onClick={() => navigateToDate(today)}
            disabled={isLoading}
            className="text-[12px] font-medium text-primary hover:text-primary-hover transition-colors disabled:opacity-50"
          >
            Return to today
          </button>
        </div>
      )}

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-bg/50 flex items-center justify-center z-10 pointer-events-none">
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {/* Day plan content */}
      <DayPlanView
        data={data}
        date={currentDate}
        calendarEvents={isToday ? calendarEvents : undefined}
        hasCalendarIntegration={isToday ? hasCalendarIntegration : undefined}
      />
    </div>
  )
}
