import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { getLocalHour } from '@/lib/dates'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Derive a display name with fallback chain:
 * display_name -> email prefix -> null
 */
export function getDisplayName(user: {
  display_name?: string | null
  email?: string | null
}): string | null {
  if (user.display_name) return user.display_name

  const email = user.email || ''
  const name = email.split('@')[0]?.split(/[._+-]/)[0] || null
  if (name) return name.charAt(0).toUpperCase() + name.slice(1)

  return null
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Add days using absolute time math (timezone-safe, no local calendar mutation). */
export function addDaysIso(from: Date | string, days: number): string {
  const base = typeof from === 'string' ? new Date(from) : from
  return new Date(base.getTime() + days * DAY_MS).toISOString()
}

/** Time-of-day greeting string (used by home screen and briefing card). */
export function getTimeGreeting(timezone?: string): string {
  const hour = timezone ? getLocalHour(timezone) : new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

/** Day-diff based on local calendar days for user-facing labels like "Tomorrow". */
export function diffLocalCalendarDays(targetIso: string, now: Date = new Date()): number {
  const target = new Date(targetIso)
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate())
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((targetDay.getTime() - nowDay.getTime()) / DAY_MS)
}
