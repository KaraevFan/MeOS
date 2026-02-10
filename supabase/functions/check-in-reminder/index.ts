// Supabase Edge Function: check-in-reminder
// Runs on a cron schedule (e.g., daily at 10am UTC)
// Sends push notifications to users who haven't checked in for 7+ days

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // Find users whose last completed session was 7+ days ago
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, email')
    .eq('onboarding_completed', true)

  if (usersError || !users) {
    return new Response(JSON.stringify({ error: 'Failed to fetch users' }), { status: 500 })
  }

  let notified = 0

  for (const user of users) {
    // Check last completed session
    const { data: lastSession } = await supabase
      .from('sessions')
      .select('completed_at')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single()

    if (lastSession?.completed_at && new Date(lastSession.completed_at) > sevenDaysAgo) {
      continue // Checked in recently
    }

    // Try push notification first
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('endpoint, keys')
      .eq('user_id', user.id)

    if (subscriptions && subscriptions.length > 0 && VAPID_PRIVATE_KEY && VAPID_PUBLIC_KEY) {
      for (const sub of subscriptions) {
        try {
          // Web Push API would go here — requires web-push library
          // For MVP, log the intent and implement actual sending when VAPID keys are configured
          console.log(`Would send push to ${sub.endpoint} for user ${user.id}`)
          notified++
        } catch {
          console.error(`Failed to send push to user ${user.id}`)
        }
      }
    } else if (user.email) {
      // Email fallback — integrate with Resend or Supabase email when configured
      console.log(`Would send email reminder to ${user.email}`)
      notified++
    }
  }

  return new Response(
    JSON.stringify({ ok: true, usersChecked: users.length, notified }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
