import { google } from 'googleapis'
import { createClient } from '@/lib/supabase/server'
import { getLocalMidnight, getLocalEndOfDay } from '@/lib/dates'
import { CalendarIntegrationSchema } from './types'
import type { CalendarEvent, CalendarIntegration } from './types'

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly'

function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
}

/**
 * Fetch today's calendar events for a user.
 * Returns empty array if no integration exists, token is expired and can't refresh,
 * or any API error occurs. Never throws — callers can always safely call this.
 */
export async function getCalendarEvents(userId: string, date: string, timezone: string = 'UTC'): Promise<CalendarEvent[]> {
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

    // Per-request client to avoid credential leaks between concurrent users
    const client = createOAuth2Client()
    client.setCredentials({ access_token: token })
    const calendar = google.calendar({ version: 'v3', auth: client })

    const startOfDay = getLocalMidnight(date, timezone)
    const endOfDay = getLocalEndOfDay(date, timezone)

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

  const MAX_RETRIES = 2

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const client = createOAuth2Client()
      client.setCredentials({ refresh_token: integration.refresh_token })
      const { credentials } = await client.refreshAccessToken()

      if (!credentials.access_token) {
        console.warn('[calendar] Refresh returned no access token, removing integration')
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      const isPermanent = message.includes('invalid_grant') || message.includes('invalid_client')

      if (isPermanent) {
        console.error('[calendar] Permanent token refresh failure, removing integration:', message)
        await removeIntegration(userId)
        return null
      }

      // Transient error — retry
      if (attempt < MAX_RETRIES) {
        console.warn(`[calendar] Token refresh attempt ${attempt + 1} failed (transient), retrying:`, message)
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
      } else {
        console.error(`[calendar] Token refresh failed after ${MAX_RETRIES + 1} attempts:`, message)
        return null
      }
    }
  }

  return null
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
      scopes: [CALENDAR_SCOPE],
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,provider',
    })
}

/**
 * Generate Google OAuth authorization URL for incremental calendar consent.
 * Used by /api/calendar/connect to redirect the user to Google's consent screen.
 */
export function generateCalendarAuthUrl(redirectUri: string, state: string): string {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  )
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [CALENDAR_SCOPE],
    state,
  })
}

/**
 * Exchange an authorization code for tokens after Google OAuth callback.
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<{ accessToken: string; refreshToken: string | null; expiresAt: string | null }> {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  )
  const { tokens } = await client.getToken(code)
  return {
    accessToken: tokens.access_token ?? '',
    refreshToken: tokens.refresh_token ?? null,
    expiresAt: tokens.expiry_date
      ? new Date(tokens.expiry_date).toISOString()
      : null,
  }
}

/**
 * Revoke Google OAuth token and remove integration.
 * Revocation is best-effort — integration is deleted regardless.
 */
export async function revokeAndRemoveIntegration(userId: string): Promise<void> {
  const supabase = await createClient()
  const { data: integration } = await supabase
    .from('integrations')
    .select('access_token')
    .eq('user_id', userId)
    .eq('provider', 'google_calendar')
    .single()

  if (integration?.access_token) {
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${integration.access_token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
    } catch {
      console.warn('[calendar] Token revocation failed (best-effort)')
    }
  }

  await removeIntegration(userId)
}
