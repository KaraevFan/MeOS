import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Schedule a mid-day nudge notification for 2pm local time.
 * Fire-and-forget — failures are logged, not thrown to the caller.
 * Only schedules if 2pm is still in the future today.
 */
export async function scheduleMidDayNudge(
  supabase: SupabaseClient,
  userId: string,
  intention: string
): Promise<void> {
  const now = new Date()
  const todayStr = now.toLocaleDateString('en-CA')

  // Compute 2pm local time today
  const nudgeTime = new Date(now)
  nudgeTime.setHours(14, 0, 0, 0)

  // Don't schedule if 2pm has already passed
  if (nudgeTime <= now) return

  // Check if a midday_nudge is already scheduled for today (prevent duplicates)
  const { data: existing } = await supabase
    .from('scheduled_notifications')
    .select('id')
    .eq('user_id', userId)
    .eq('notification_type', 'midday_nudge')
    .gte('scheduled_for', `${todayStr}T00:00:00`)
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
