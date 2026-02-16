import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface ReengagementContent {
  reflectionPrompts: string[]
  day1Notification: { title: string; body: string }
  day3Notification: { title: string; body: string }
  checkinReminder: { title: string; body: string }
}

const GENERATION_PROMPT = `You just finished a conversation session. Based on the recent messages, generate re-engagement content for the user.

Output ONLY valid JSON matching this exact structure (no markdown, no explanation):
{
  "reflectionPrompts": ["prompt1", "prompt2", "prompt3"],
  "day1Notification": { "title": "Sage", "body": "..." },
  "day3Notification": { "title": "Sage", "body": "..." },
  "checkinReminder": { "title": "Sage", "body": "..." }
}

Rules:
- reflectionPrompts: 3 warm "something to sit with" prompts drawn from specific session content. NOT action items. Examples: "You said your career feels like it's plateauing — what would 'growing' actually look like?" These appear on the home screen.
- day1Notification body: Personal, references something specific from the session. Start with "I've been thinking about..." or similar. Max 120 characters.
- day3Notification body: Lighter, less specific. Something like "No rush. Your life map is here whenever you want it." Max 100 characters.
- checkinReminder body: References a specific commitment or priority. "Ready to check in on [commitment]?" Max 120 characters.
- All titles should be "Sage".
- All content should sound like Sage — warm, personal, not like a system notification.`

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: {
    sessionId: string
    sessionType: string
    recentMessages: { role: string; content: string }[]
  }

  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { sessionId, sessionType, recentMessages } = body

  // Verify session ownership
  const { data: session } = await supabase
    .from('sessions')
    .select('id, user_id')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()

  if (!session) {
    return new Response(JSON.stringify({ error: 'Session not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    // Build context from recent messages
    const conversationSummary = recentMessages
      .map((m) => `${m.role === 'user' ? 'User' : 'Sage'}: ${m.content.slice(0, 500)}`)
      .join('\n\n')

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: GENERATION_PROMPT,
      messages: [{
        role: 'user',
        content: `Session type: ${sessionType}\n\nRecent conversation:\n${conversationSummary}`,
      }],
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

    let content: ReengagementContent
    try {
      content = JSON.parse(responseText) as ReengagementContent
    } catch {
      // Fallback to template-based content if JSON parsing fails
      content = {
        reflectionPrompts: [
          'What came up in your session that you want to sit with?',
          'Is there something you said that surprised you?',
          'What feels most true about where you are right now?',
        ],
        day1Notification: {
          title: 'Sage',
          body: "I've been thinking about our conversation. How are things landing today?",
        },
        day3Notification: {
          title: 'Sage',
          body: 'No rush. Your life map is here whenever you want it.',
        },
        checkinReminder: {
          title: 'Sage',
          body: "It's been a week. Ready for a quick check-in?",
        },
      }
    }

    // Store reflection prompts
    if (content.reflectionPrompts && content.reflectionPrompts.length > 0) {
      const promptRows = content.reflectionPrompts.slice(0, 3).map((text) => ({
        user_id: user.id,
        session_id: sessionId,
        prompt_text: text,
      }))

      await supabase.from('reflection_prompts').insert(promptRows)
    }

    // Schedule notifications
    const now = new Date()
    const notifications = []

    // Day 1 notification (24 hours)
    const day1At = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    notifications.push({
      user_id: user.id,
      session_id: sessionId,
      notification_type: 'day_1',
      title: content.day1Notification.title,
      body: content.day1Notification.body,
      url: '/home',
      scheduled_for: day1At.toISOString(),
    })

    // Day 3 conditional notification (72 hours) — gated on inactivity
    const day3At = new Date(now.getTime() + 72 * 60 * 60 * 1000)
    notifications.push({
      user_id: user.id,
      session_id: sessionId,
      notification_type: 'day_3',
      title: content.day3Notification.title,
      body: content.day3Notification.body,
      url: '/home',
      scheduled_for: day3At.toISOString(),
      gate_condition: { require_inactive_since: now.toISOString() },
    })

    // Check-in reminder (6.5 days — 12 hours before check-in is due)
    const reminderAt = new Date(now.getTime() + (6.5 * 24 * 60 * 60 * 1000))
    notifications.push({
      user_id: user.id,
      session_id: sessionId,
      notification_type: 'checkin_reminder',
      title: content.checkinReminder.title,
      body: content.checkinReminder.body,
      url: '/home',
      scheduled_for: reminderAt.toISOString(),
    })

    await supabase.from('scheduled_notifications').insert(notifications)

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Failed to generate re-engagement content:', err)
    return new Response(JSON.stringify({ error: 'Generation failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
