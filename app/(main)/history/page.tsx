import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SessionList } from '@/components/history/session-list'

export default async function HistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: sessions } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', user.id)
    .in('status', ['completed', 'abandoned'])
    .order('created_at', { ascending: false })

  if (!sessions || sessions.length === 0) {
    return (
      <div className="px-md pt-2xl max-w-lg mx-auto">
        <h1 className="text-xl font-bold tracking-tight mb-2">History</h1>
        <p className="text-text-secondary mb-xl">
          Your conversation history will show up here after your first session with Sage.
        </p>
        <Link
          href="/chat"
          className="inline-flex items-center justify-center h-12 px-6 bg-primary text-white rounded-md font-medium
                     hover:bg-primary-hover transition-colors"
        >
          Talk to Sage
        </Link>
      </div>
    )
  }

  return (
    <div className="px-md pt-lg pb-lg max-w-lg mx-auto space-y-md">
      <h1 className="text-xl font-bold tracking-tight">History</h1>
      <SessionList sessions={sessions} />
    </div>
  )
}
