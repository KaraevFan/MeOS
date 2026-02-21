import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDayPlanWithCaptures } from '@/lib/supabase/day-plan-queries'
import { DayPlanView } from '@/components/day-plan/day-plan-view'
import { getUserTimezone } from '@/lib/get-user-timezone'
import { getLocalDateString } from '@/lib/dates'

export default async function DayPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const tz = await getUserTimezone(supabase, user.id)
  const today = getLocalDateString(tz)
  const data = await getDayPlanWithCaptures(supabase, user.id, today, tz)

  return <DayPlanView data={data} />
}
