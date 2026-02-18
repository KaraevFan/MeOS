import { createClient } from '@/lib/supabase/server'
import { storeCalendarIntegration } from '@/lib/calendar/google-calendar'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.session) {
      // Extract and store Google Calendar provider tokens
      const providerToken = data.session.provider_token
      const providerRefreshToken = data.session.provider_refresh_token

      // Check if user record exists, create if not
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('id', user.id)
          .single()

        if (!existingUser) {
          await supabase.from('users').insert({
            id: user.id,
            email: user.email,
          })
        }

        // Store calendar integration if provider tokens are present
        if (providerToken) {
          const expiresAt = data.session.expires_at
            ? new Date(data.session.expires_at * 1000).toISOString()
            : null

          await storeCalendarIntegration(
            user.id,
            providerToken,
            providerRefreshToken ?? null,
            expiresAt
          )
        }
      }

      return NextResponse.redirect(`${origin}/home`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=true`)
}
