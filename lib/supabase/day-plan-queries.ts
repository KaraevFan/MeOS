import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  DayPlan,
  Capture,
  DayPlanWithCaptures,
  CaptureClassification,
  CaptureSource,
} from '@/types/day-plan'

/**
 * Get today's day plan, creating one if it doesn't exist.
 * Uses ON CONFLICT(user_id, date) for idempotent upsert.
 */
export async function getOrCreateTodayDayPlan(
  supabase: SupabaseClient,
  userId: string
): Promise<DayPlan> {
  const today = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD local time

  // Try to fetch first (avoids unnecessary writes)
  const { data: existing } = await supabase
    .from('day_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle()

  if (existing) return existing as DayPlan

  // Create if not exists
  const { data: created, error } = await supabase
    .from('day_plans')
    .upsert(
      { user_id: userId, date: today },
      { onConflict: 'user_id,date' }
    )
    .select()
    .single()

  if (error) throw new Error(`Failed to create day plan: ${error.message}`)
  return created as DayPlan
}

/**
 * Get a day plan for a specific date (returns null if none exists).
 */
export async function getDayPlan(
  supabase: SupabaseClient,
  userId: string,
  date: string
): Promise<DayPlan | null> {
  const { data } = await supabase
    .from('day_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle()

  return (data as DayPlan) ?? null
}

/**
 * Partial update of a day plan row.
 */
export async function updateDayPlan(
  supabase: SupabaseClient,
  userId: string,
  date: string,
  updates: Partial<Pick<DayPlan,
    'intention' | 'energy_level' | 'morning_session_id' | 'morning_completed_at' |
    'evening_session_id' | 'evening_completed_at' | 'evening_reflection' |
    'open_threads' | 'priorities' | 'briefing_data'
  >>
): Promise<DayPlan | null> {
  const { data, error } = await supabase
    .from('day_plans')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('date', date)
    .select()
    .maybeSingle()

  if (error) throw new Error(`Failed to update day plan: ${error.message}`)
  return (data as DayPlan) ?? null
}

/**
 * Get day plan with all its captures for the Day Plan view.
 */
export async function getDayPlanWithCaptures(
  supabase: SupabaseClient,
  userId: string,
  date: string
): Promise<DayPlanWithCaptures> {
  const today = date || new Date().toLocaleDateString('en-CA')

  const [dayPlanResult, capturesResult, streakCount] = await Promise.all([
    getDayPlan(supabase, userId, today),
    getCapturesForDate(supabase, userId, today),
    getStreak(supabase, userId),
  ])

  return {
    dayPlan: dayPlanResult,
    captures: capturesResult,
    streak: streakCount,
  }
}

/**
 * Get captures for a specific date (by day_plan_id or by created_at date range).
 */
export async function getCapturesForDate(
  supabase: SupabaseClient,
  userId: string,
  date: string
): Promise<Capture[]> {
  // First try via day_plan_id
  const dayPlan = await getDayPlan(supabase, userId, date)

  if (dayPlan) {
    const { data } = await supabase
      .from('captures')
      .select('*')
      .eq('day_plan_id', dayPlan.id)
      .order('created_at', { ascending: true })

    // Also get orphan captures for today (day_plan_id is null, created today)
    const { data: orphans } = await supabase
      .from('captures')
      .select('*')
      .eq('user_id', userId)
      .is('day_plan_id', null)
      .gte('created_at', `${date}T00:00:00`)
      .lt('created_at', `${date}T23:59:59.999`)
      .order('created_at', { ascending: true })

    return [...(data ?? []), ...(orphans ?? [])] as Capture[]
  }

  // No day plan yet — get all captures created today
  const { data } = await supabase
    .from('captures')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', `${date}T00:00:00`)
    .lt('created_at', `${date}T23:59:59.999`)
    .order('created_at', { ascending: true })

  return (data ?? []) as Capture[]
}

/**
 * Create a capture and link to today's day plan if it exists.
 */
export async function createCapture(
  supabase: SupabaseClient,
  userId: string,
  data: {
    content: string
    source?: CaptureSource
    classification?: CaptureClassification
    auto_tags?: string[]
  }
): Promise<Capture> {
  const today = new Date().toLocaleDateString('en-CA')

  // Link to today's day plan if it exists
  const dayPlan = await getDayPlan(supabase, userId, today)

  const { data: capture, error } = await supabase
    .from('captures')
    .insert({
      user_id: userId,
      day_plan_id: dayPlan?.id ?? null,
      content: data.content,
      source: data.source ?? 'manual',
      classification: data.classification ?? null,
      auto_tags: data.auto_tags ?? [],
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to create capture: ${error.message}`)
  return capture as Capture
}

/**
 * Toggle a capture's completed state (for task captures).
 */
export async function toggleCaptureCompleted(
  supabase: SupabaseClient,
  captureId: string,
  userId: string
): Promise<boolean> {
  // Fetch current state
  const { data: capture } = await supabase
    .from('captures')
    .select('completed')
    .eq('id', captureId)
    .eq('user_id', userId)
    .single()

  if (!capture) return false

  const { error } = await supabase
    .from('captures')
    .update({ completed: !capture.completed })
    .eq('id', captureId)
    .eq('user_id', userId)

  return !error
}

/**
 * Toggle a priority's completed state in the day_plans.priorities JSONB.
 * Uses an atomic Postgres RPC to avoid read-modify-write race conditions.
 */
export async function togglePriorityCompleted(
  supabase: SupabaseClient,
  userId: string,
  date: string,
  rank: number
): Promise<boolean> {
  const { data, error } = await supabase.rpc('toggle_priority_completed', {
    p_user_id: userId,
    p_date: date,
    p_rank: rank,
  })

  if (error) {
    console.error('[togglePriorityCompleted] RPC error:', error.message)
    return false
  }
  return data === true
}

/**
 * Resolve an open thread in the day_plans.open_threads JSONB.
 * Uses an atomic Postgres RPC to avoid read-modify-write race conditions.
 */
export async function resolveThread(
  supabase: SupabaseClient,
  userId: string,
  date: string,
  threadText: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc('resolve_open_thread', {
    p_user_id: userId,
    p_date: date,
    p_thread_text: threadText,
  })

  if (error) {
    console.error('[resolveThread] RPC error:', error.message)
    return false
  }
  return data === true
}

/**
 * Count consecutive days with morning_completed_at, working backward from today.
 * Returns 0 if today has no morning session yet.
 */
export async function getStreak(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  // Fetch recent day plans with morning_completed_at, ordered by date descending
  const { data } = await supabase
    .from('day_plans')
    .select('date, morning_completed_at')
    .eq('user_id', userId)
    .not('morning_completed_at', 'is', null)
    .order('date', { ascending: false })
    .limit(60) // Max streak lookback

  if (!data || data.length === 0) return 0

  // Check if today is in the list
  const today = new Date().toLocaleDateString('en-CA')
  const dates = data.map((d) => d.date as string)

  // Start counting from today (or yesterday if today's session hasn't happened yet)
  let startDate = today
  if (!dates.includes(today)) {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    startDate = yesterday.toLocaleDateString('en-CA')
    if (!dates.includes(startDate)) return 0
  }

  // Count consecutive days backward
  let streak = 0
  const checkDate = new Date(startDate + 'T12:00:00') // Noon to avoid DST issues

  while (streak < dates.length) {
    const dateStr = checkDate.toLocaleDateString('en-CA')
    if (!dates.includes(dateStr)) break
    streak++
    checkDate.setDate(checkDate.getDate() - 1)
  }

  return streak
}

/**
 * Update a capture's classification and tags (called after AI classification).
 */
export async function updateCaptureClassification(
  supabase: SupabaseClient,
  captureId: string,
  userId: string,
  classification: CaptureClassification,
  autoTags: string[]
): Promise<boolean> {
  const { error } = await supabase
    .from('captures')
    .update({ classification, auto_tags: autoTags })
    .eq('id', captureId)
    .eq('user_id', userId)

  return !error
}
