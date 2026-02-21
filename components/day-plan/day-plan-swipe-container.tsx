'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { DayPlanView } from './day-plan-view'
import type { DayPlanWithCaptures } from '@/types/day-plan'

interface DayPlanSwipeContainerProps {
  initialDate: string
  today: string
  initialData: DayPlanWithCaptures
}

/** Decrement a YYYY-MM-DD date string by one day (DST-safe via noon trick). */
function prevDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d - 1))
  return date.toISOString().split('T')[0]
}

/** Increment a YYYY-MM-DD date string by one day (DST-safe via noon trick). */
function nextDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + 1))
  return date.toISOString().split('T')[0]
}

// Swipe gesture thresholds
const SWIPE_THRESHOLD = 50
const SWIPE_MAX_VERTICAL = 60
// 30-day lookback max
const MAX_LOOKBACK_DAYS = 30

export function DayPlanSwipeContainer({ initialDate, today, initialData }: DayPlanSwipeContainerProps) {
  const [currentDate, setCurrentDate] = useState(initialDate)
  const [data, setData] = useState<DayPlanWithCaptures>(initialData)
  const [isLoading, setIsLoading] = useState(false)

  // Touch tracking refs
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  // Compute earliest allowed date (30 days before today)
  const earliestDate = (() => {
    const [y, m, d] = today.split('-').map(Number)
    const date = new Date(Date.UTC(y, m - 1, d - MAX_LOOKBACK_DAYS))
    return date.toISOString().split('T')[0]
  })()

  const canGoBack = currentDate > earliestDate
  const canGoForward = currentDate < today
  const isToday = currentDate === today

  const fetchDayPlan = useCallback(async (date: string) => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/day-plan?date=${date}`)
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch {
      // Keep current data on error
    } finally {
      setIsLoading(false)
    }
  }, [])

  const navigateToDate = useCallback((newDate: string) => {
    if (newDate < earliestDate || newDate > today) return
    setCurrentDate(newDate)
    fetchDayPlan(newDate)
  }, [earliestDate, today, fetchDayPlan])

  const handlePrev = useCallback(() => {
    if (canGoBack) navigateToDate(prevDate(currentDate))
  }, [canGoBack, currentDate, navigateToDate])

  const handleNext = useCallback(() => {
    if (canGoForward) navigateToDate(nextDate(currentDate))
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

  // Format date for the "Return to today" button
  const formatShortDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00')
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

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
      <DayPlanView data={data} date={currentDate} />
    </div>
  )
}
