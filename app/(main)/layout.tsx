import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BottomTabBar } from '@/components/ui/bottom-tab-bar'
import { AppHeader } from '@/components/ui/app-header'
import { ActivityTracker } from '@/components/activity-tracker'
import { getDisplayName } from '@/lib/utils'

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('users')
    .select('email, display_name, onboarding_completed')
    .eq('id', user.id)
    .single()

  const email = profile?.email || user.email || ''
  const displayName = getDisplayName({
    display_name: profile?.display_name,
    email: profile?.email,
  })
  const onboardingCompleted = profile?.onboarding_completed ?? false

  return (
    <div className="mx-auto max-w-[430px] min-h-[100dvh] bg-bg relative shadow-[0_0_60px_rgba(0,0,0,0.07)]">
      <ActivityTracker />
      <AppHeader email={email} displayName={displayName} />
      <main className="pb-24">
        {children}
      </main>
      <BottomTabBar onboardingCompleted={onboardingCompleted} />
    </div>
  )
}
