import { createClient } from '@/lib/supabase/server'
import { getLifeMappingPrompt, getWeeklyCheckinPrompt } from './prompts'
import type { SessionType } from '@/types/chat'
import type { LifeMap, LifeMapDomain, Pattern } from '@/types/database'

export async function buildConversationContext(
  sessionType: SessionType,
  userId: string
): Promise<string> {
  if (sessionType === 'life_mapping') {
    return getLifeMappingPrompt()
  }

  // Weekly check-in — inject full context
  const supabase = await createClient()

  // Get current life map with domains
  const { data: lifeMap } = await supabase
    .from('life_maps')
    .select('*')
    .eq('user_id', userId)
    .eq('is_current', true)
    .single()

  let domains: LifeMapDomain[] = []
  if (lifeMap) {
    const { data } = await supabase
      .from('life_map_domains')
      .select('*')
      .eq('life_map_id', lifeMap.id)

    domains = (data || []) as LifeMapDomain[]
  }

  // Get last 3-5 session summaries
  const { data: recentSessions } = await supabase
    .from('sessions')
    .select('ai_summary')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(5)

  const sessionSummaries = (recentSessions || [])
    .map((s) => s.ai_summary)
    .filter((s): s is string => Boolean(s))

  // Get active patterns
  const { data: patterns } = await supabase
    .from('patterns')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)

  // Get last commitment from most recent session
  const { data: lastSession } = await supabase
    .from('sessions')
    .select('commitments_made')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .single()

  const lastCommitment = lastSession?.commitments_made?.[0] || ''

  const lifeMapWithDomains = {
    ...(lifeMap as LifeMap || {
      id: '',
      user_id: userId,
      is_current: true,
      narrative_summary: null,
      primary_compounding_engine: null,
      quarterly_priorities: null,
      key_tensions: null,
      anti_goals: null,
      failure_modes: null,
      identity_statements: null,
      created_at: '',
      updated_at: '',
    }),
    domains,
  }

  return getWeeklyCheckinPrompt(
    lifeMapWithDomains,
    sessionSummaries,
    (patterns || []) as Pattern[],
    lastCommitment
  )
}
