// Supabase Edge Function: send-notifications
// Runs on a cron schedule (hourly). Processes pending scheduled_notifications,
// checks gate conditions (e.g., Day 3 requires inactivity), and sends via Web Push.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:hello@meos.app'

type PushResult = 'sent' | 'expired' | 'error'

// Initialize web-push once at module scope (lazy — set on first use)
let webpushInitialized = false

async function initWebPush() {
  if (webpushInitialized) return
  const webpush = await import('npm:web-push@3.6.7')
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!)
  webpushInitialized = true
}

async function sendWebPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
): Promise<PushResult> {
  try {
    await initWebPush()
    const webpush = await import('npm:web-push@3.6.7')
    await webpush.sendNotification(subscription, payload)
    return 'sent'
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number }).statusCode
    if (statusCode === 410 || statusCode === 404) {
      return 'expired'
    }
    console.error('Web push send error:', err)
    return 'error'
  }
}

interface GateCondition {
  require_inactive_since?: string
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  if (!VAPID_PRIVATE_KEY || !VAPID_PUBLIC_KEY) {
    console.warn('VAPID keys not configured — skipping notification send')
    return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'no_vapid_keys' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Fetch pending notifications that are due
  const now = new Date().toISOString()
  const { data: notifications, error: fetchError } = await supabase
    .from('scheduled_notifications')
    .select('*')
    .is('sent_at', null)
    .is('cancelled_at', null)
    .lte('scheduled_for', now)
    .order('scheduled_for', { ascending: true })
    .limit(100)

  if (fetchError || !notifications) {
    console.error('Failed to fetch notifications:', fetchError)
    return new Response(JSON.stringify({ error: 'Failed to fetch notifications' }), { status: 500 })
  }

  let sent = 0
  let skipped = 0
  let failed = 0

  for (const notification of notifications) {
    // Check gate conditions
    if (notification.gate_condition) {
      const gate = notification.gate_condition as GateCondition
      if (gate.require_inactive_since) {
        // Check if user has been active since the gate time
        const { data: userData } = await supabase
          .from('users')
          .select('last_active_at')
          .eq('id', notification.user_id)
          .single()

        if (userData?.last_active_at) {
          const lastActive = new Date(userData.last_active_at)
          const gateSince = new Date(gate.require_inactive_since)
          if (lastActive > gateSince) {
            // User has been active — cancel this notification
            await supabase
              .from('scheduled_notifications')
              .update({ cancelled_at: now })
              .eq('id', notification.id)
            skipped++
            continue
          }
        }
      }
    }

    // Get push subscriptions for this user
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, keys')
      .eq('user_id', notification.user_id)

    if (!subscriptions || subscriptions.length === 0) {
      // No subscriptions — mark as sent anyway (nothing to send to)
      await supabase
        .from('scheduled_notifications')
        .update({ sent_at: now })
        .eq('id', notification.id)
      skipped++
      continue
    }

    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      url: notification.url,
    })

    let anySent = false
    for (const sub of subscriptions) {
      const result = await sendWebPush(
        { endpoint: sub.endpoint, keys: sub.keys },
        payload,
      )

      if (result === 'sent') {
        anySent = true
      } else if (result === 'expired') {
        // Only delete subscription when definitively expired (410/404)
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('id', sub.id)
      }
      // 'error' — transient failure, leave subscription intact
    }

    // Mark notification as sent
    await supabase
      .from('scheduled_notifications')
      .update({ sent_at: now })
      .eq('id', notification.id)

    if (anySent) {
      sent++
    } else {
      failed++
    }
  }

  return new Response(
    JSON.stringify({ ok: true, processed: notifications.length, sent, skipped, failed }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
