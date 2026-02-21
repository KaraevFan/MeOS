import { createClient } from '@/lib/supabase/server'
import { exchangeCodeForTokens, storeCalendarIntegration } from '@/lib/calendar/google-calendar'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

/**
 * GET /api/calendar/callback?code=...&state=...
 * Handles the OAuth callback from Google after calendar consent.
 * Verifies CSRF state, exchanges code for tokens, stores integration.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // User denied consent — redirect home silently
  if (error) {
    return NextResponse.redirect(`${origin}/home`)
  }

  // Verify CSRF state
  const cookieStore = await cookies()
  const storedState = cookieStore.get('calendar_oauth_state')?.value

  if (!state || !storedState || state !== storedState) {
    console.error('[calendar] CSRF state mismatch in callback')
    return NextResponse.redirect(`${origin}/home?calendar=error`)
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/home?calendar=error`)
  }

  // Clear state cookie
  const response = NextResponse.redirect(`${origin}/home?calendar=connected`)
  response.cookies.set('calendar_oauth_state', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/calendar/callback',
    maxAge: 0,
  })

  // Verify authenticated session
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${origin}/login`)
  }

  try {
    const redirectUri = `${origin}/api/calendar/callback`
    const tokens = await exchangeCodeForTokens(code, redirectUri)

    if (!tokens.accessToken) {
      console.error('[calendar] No access token received from Google')
      return NextResponse.redirect(`${origin}/home?calendar=error`)
    }

    await storeCalendarIntegration(
      user.id,
      tokens.accessToken,
      tokens.refreshToken,
      tokens.expiresAt
    )

    return response
  } catch (err) {
    console.error('[calendar] Token exchange failed:', err)
    return NextResponse.redirect(`${origin}/home?calendar=error`)
  }
}
