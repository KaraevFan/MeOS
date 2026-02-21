import type { SupabaseClient } from '@supabase/supabase-js'
import { getLocalDateString, getLocalMidnight, getHourInTimezone } from '@/lib/dates'

/**
 * Schedule a mid-day nudge notification for 2pm in the user's timezone.
 * Fire-and-forget — failures are logged, not thrown to the caller.
 * Only schedules if 2pm is still in the future today.
 */
export async function scheduleMidDayNudge(
  supabase: SupabaseClient,
  userId: string,
  intention: string,
  timezone: string = 'UTC'
): Promise<void> {
  const now = new Date()
  const todayStr = getLocalDateString(timezone)

  // Don't schedule if 2pm has already passed in user's timezone
  if (getHourInTimezone(now, timezone) >= 14) return

  // Compute 2pm in user's timezone by parsing the midnight offset
  const midnightStr = getLocalMidnight(todayStr, timezone) // e.g. "2026-02-21T00:00:00+09:00"
  const nudgeTime = new Date(midnightStr)
  nudgeTime.setTime(nudgeTime.getTime() + 14 * 60 * 60 * 1000) // Add 14 hours to midnight

  // Check if a midday_nudge is already scheduled for today (prevent duplicates)
  const { data: existing } = await supabase
    .from('scheduled_notifications')
    .select('id')
    .eq('user_id', userId)
    .eq('notification_type', 'midday_nudge')
    .gte('scheduled_for', midnightStr)
    .is('cancelled_at', null)
    .limit(1)
    .maybeSingle()

  if (existing) return // Already scheduled

  await supabase
    .from('scheduled_notifications')
    .insert({
      user_id: userId,
      notification_type: 'midday_nudge',
      title: 'Mid-day check-in',
      body: `You set an intention to "${intention}". Still on track?`,
      url: '/home',
      scheduled_for: nudgeTime.toISOString(),
    })
}
