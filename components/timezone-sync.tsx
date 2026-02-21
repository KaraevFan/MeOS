'use client'

import { useEffect } from 'react'
import { TIMEZONE_COOKIE_NAME } from '@/lib/constants'

/**
 * Client component that detects the user's timezone and syncs it
 * to both a cookie (for immediate server-side access) and the DB
 * (for persistence and background jobs).
 *
 * Renders nothing — mount in the authenticated layout.
 */
export function TimezoneSync() {
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const current = document.cookie
      .split('; ')
      .find((c) => c.startsWith(`${TIMEZONE_COOKIE_NAME}=`))
      ?.split('=')[1]

    if (current !== tz) {
      document.cookie = `${TIMEZONE_COOKIE_NAME}=${tz}; path=/; max-age=31536000; SameSite=Lax; Secure`

      // Sync to DB (fire-and-forget)
      fetch('/api/user/timezone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone: tz }),
      }).catch(() => {})
    }
  }, [])

  return null
}
