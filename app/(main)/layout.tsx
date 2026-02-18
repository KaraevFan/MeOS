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
    .select('email, display_name')
    .eq('id', user.id)
    .single()

  const email = profile?.email || user.email || ''
  const displayName = getDisplayName({
    display_name: profile?.display_name,
    email: profile?.email,
  })

  return (
    <div className="min-h-screen bg-bg">
      <ActivityTracker />
      <AppHeader email={email} displayName={displayName} />
      <main className="pb-24">
        {children}
      </main>
      <BottomTabBar />
    </div>
  )
}
