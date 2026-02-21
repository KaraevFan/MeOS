import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'
import { TIMEZONE_COOKIE_NAME } from '@/lib/constants'

const FALLBACK = 'UTC'

function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/** Read timezone: cookie → DB → UTC fallback. For server components and API routes. */
export async function getUserTimezone(
  supabase?: SupabaseClient,
  userId?: string,
): Promise<string> {
  // 1. Cookie (fast, no DB call)
  try {
    const cookieStore = await cookies()
    const fromCookie = cookieStore.get(TIMEZONE_COOKIE_NAME)?.value
    if (fromCookie && isValidTimezone(fromCookie)) return fromCookie
  } catch {
    // cookies() throws outside of request context (e.g., in background jobs)
  }

  // 2. DB (persistent)
  if (supabase && userId) {
    try {
      const { data } = await supabase
        .from('users')
        .select('timezone')
        .eq('id', userId)
        .single()
      if (data?.timezone && isValidTimezone(data.timezone as string)) return data.timezone as string
    } catch {
      // Graceful fallback
    }
  }

  // 3. Fallback
  return FALLBACK
}
