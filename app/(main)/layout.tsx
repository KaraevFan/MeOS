import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BottomTabBar } from '@/components/ui/bottom-tab-bar'
import { ActivityTracker } from '@/components/activity-tracker'

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

  return (
    <div className="min-h-screen bg-bg">
      <ActivityTracker />
      <main className="pb-20">
        {children}
      </main>
      <BottomTabBar />
    </div>
  )
}
