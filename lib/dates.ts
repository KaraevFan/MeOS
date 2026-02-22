const DEFAULT_TIMEZONE = 'UTC'

/** YYYY-MM-DD in the given timezone */
export function getLocalDateString(timezone: string = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date())
}

/** Shift a YYYY-MM-DD date string by N days (DST-safe via UTC calendar arithmetic). */
export function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + days))
  return date.toISOString().split('T')[0]
}

/** YYYY-MM-DD for yesterday in the given timezone (DST-safe via calendar arithmetic). */
export function getYesterdayDateString(timezone: string = DEFAULT_TIMEZONE): string {
  return shiftDate(getLocalDateString(timezone), -1)
}

/** Day of week name in the given timezone */
export function getLocalDayOfWeek(timezone: string = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'long' }).format(new Date())
}

/** Current hour (0-23) in the given timezone. Alias for getHourInTimezone(new Date(), tz). */
export function getLocalHour(timezone: string = DEFAULT_TIMEZONE): number {
  return getHourInTimezone(new Date(), timezone)
}

/**
 * Midnight boundary as ISO string for Postgres timestamptz comparisons.
 * Returns e.g. "2026-02-21T00:00:00+09:00" for Asia/Tokyo.
 */
export function getLocalMidnight(date: string, timezone: string = DEFAULT_TIMEZONE): string {
  const offset = getTimezoneOffset(date, timezone)
  return `${date}T00:00:00${offset}`
}

/**
 * End-of-day boundary as ISO string for Postgres timestamptz comparisons.
 * Returns e.g. "2026-02-21T23:59:59.999+09:00" for Asia/Tokyo.
 */
export function getLocalEndOfDay(date: string, timezone: string = DEFAULT_TIMEZONE): string {
  const offset = getTimezoneOffset(date, timezone)
  return `${date}T23:59:59.999${offset}`
}

/**
 * Format a timestamp (ISO string or Date) as a localized time string in the given timezone.
 * e.g. "2:30 PM"
 */
export function formatTimeInTimezone(
  timestamp: string | Date,
  timezone: string = DEFAULT_TIMEZONE,
): string {
  const d = typeof timestamp === 'string' ? new Date(timestamp) : timestamp
  return d.toLocaleTimeString('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
  })
}

/**
 * Get the hour (0-23) of a timestamp in the given timezone.
 */
export function getHourInTimezone(
  timestamp: string | Date,
  timezone: string = DEFAULT_TIMEZONE,
): number {
  const d = typeof timestamp === 'string' ? new Date(timestamp) : timestamp
  return parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    }).format(d),
    10,
  )
}

/**
 * YYYY-MM-DD for the Monday of the current week in the given timezone.
 * Uses ISO week convention (Monday = start of week).
 */
export function getStartOfWeek(timezone: string = DEFAULT_TIMEZONE): string {
  const today = getLocalDateString(timezone)
  const [y, m, d] = today.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  // getUTCDay: 0=Sun, 1=Mon ... 6=Sat → shift so Mon=0
  const dayOfWeek = date.getUTCDay()
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  return shiftDate(today, -daysToMonday)
}

/** Extract "+09:00" style offset for a given date in a timezone. */
function getTimezoneOffset(date: string, timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'longOffset',
  })
  const parts = formatter.formatToParts(new Date(`${date}T12:00:00`))
  const offsetPart = parts.find((p) => p.type === 'timeZoneName')
  const raw = offsetPart?.value ?? 'GMT'
  // "GMT+09:00" → "+09:00", "GMT" → "+00:00"
  const offset = raw.replace('GMT', '')
  return offset || '+00:00'
}
