import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDayPlanWithCaptures } from '@/lib/supabase/day-plan-queries'
import { DayPlanView } from '@/components/day-plan/day-plan-view'

export default async function DayPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const today = new Date().toLocaleDateString('en-CA')
  const data = await getDayPlanWithCaptures(supabase, user.id, today)

  return <DayPlanView data={data} />
}
