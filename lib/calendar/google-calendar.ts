import { google } from 'googleapis'
import { createClient } from '@/lib/supabase/server'
import { CalendarIntegrationSchema } from './types'
import type { CalendarEvent, CalendarIntegration } from './types'

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
)

/**
 * Fetch today's calendar events for a user.
 * Returns empty array if no integration exists, token is expired and can't refresh,
 * or any API error occurs. Never throws — callers can always safely call this.
 */
export async function getCalendarEvents(userId: string, date: string): Promise<CalendarEvent[]> {
  try {
    const supabase = await createClient()

    // Fetch integration
    const { data: integration } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'google_calendar')
      .single()

    if (!integration) return []

    const parsed = CalendarIntegrationSchema.safeParse(integration)
    if (!parsed.success) {
      console.warn('[calendar] Integration row failed validation:', parsed.error.message)
      return []
    }

    // Check if token needs refresh
    const token = await getValidToken(parsed.data, userId)
    if (!token) return []

    // Set credentials and fetch events
    oauth2Client.setCredentials({ access_token: token })
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

    const startOfDay = `${date}T00:00:00.000Z`
    const endOfDay = `${date}T23:59:59.999Z`

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: startOfDay,
      timeMax: endOfDay,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 20,
    })

    const events = response.data.items ?? []
    return events.map((event): CalendarEvent => ({
      id: event.id ?? '',
      title: event.summary ?? '(No title)',
      startTime: event.start?.dateTime ?? event.start?.date ?? '',
      endTime: event.end?.dateTime ?? event.end?.date ?? '',
      allDay: Boolean(event.start?.date),
      attendees: event.attendees?.map((a) => a.email ?? '').filter(Boolean),
    }))
  } catch (error) {
    console.error('[calendar] Failed to fetch events:', error)
    return []
  }
}

/**
 * Check if a calendar integration exists for a user.
 */
export async function hasCalendarIntegration(userId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('integrations')
    .select('id')
    .eq('user_id', userId)
    .eq('provider', 'google_calendar')
    .single()
  return Boolean(data)
}

/**
 * Get a valid access token, refreshing if needed.
 * Returns null if refresh fails (token permanently revoked).
 */
async function getValidToken(
  integration: CalendarIntegration,
  userId: string
): Promise<string | null> {
  // Check if current token is still valid (with 5-minute buffer)
  if (integration.token_expires_at) {
    const expiresAt = new Date(integration.token_expires_at).getTime()
    const now = Date.now()
    if (expiresAt > now + 5 * 60 * 1000) {
      return integration.access_token
    }
  }

  // Token expired — try refresh
  if (!integration.refresh_token) {
    console.warn('[calendar] No refresh token available, removing integration')
    await removeIntegration(userId)
    return null
  }

  try {
    oauth2Client.setCredentials({ refresh_token: integration.refresh_token })
    const { credentials } = await oauth2Client.refreshAccessToken()

    if (!credentials.access_token) {
      await removeIntegration(userId)
      return null
    }

    // Update stored tokens
    const supabase = await createClient()
    await supabase
      .from('integrations')
      .update({
        access_token: credentials.access_token,
        token_expires_at: credentials.expiry_date
          ? new Date(credentials.expiry_date).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('provider', 'google_calendar')

    return credentials.access_token
  } catch (error) {
    console.error('[calendar] Token refresh failed, removing integration:', error)
    await removeIntegration(userId)
    return null
  }
}

/**
 * Remove a calendar integration (e.g., when token refresh permanently fails).
 */
async function removeIntegration(userId: string): Promise<void> {
  const supabase = await createClient()
  await supabase
    .from('integrations')
    .delete()
    .eq('user_id', userId)
    .eq('provider', 'google_calendar')
}

/**
 * Store or update a calendar integration after OAuth.
 */
export async function storeCalendarIntegration(
  userId: string,
  accessToken: string,
  refreshToken: string | null,
  expiresAt: string | null
): Promise<void> {
  const supabase = await createClient()
  await supabase
    .from('integrations')
    .upsert({
      user_id: userId,
      provider: 'google_calendar',
      access_token: accessToken,
      refresh_token: refreshToken,
      token_expires_at: expiresAt,
      scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,provider',
    })
}
