import type { SupabaseClient } from '@supabase/supabase-js'
import type { DomainSummary, LifeMapSynthesis } from '@/types/chat'
import type { LifeMap, LifeMapDomain } from '@/types/database'

export async function getCurrentLifeMap(
  supabase: SupabaseClient,
  userId: string
): Promise<(LifeMap & { domains: LifeMapDomain[] }) | null> {
  const { data: lifeMap } = await supabase
    .from('life_maps')
    .select('*')
    .eq('user_id', userId)
    .eq('is_current', true)
    .maybeSingle()

  if (!lifeMap) return null

  const { data: domains } = await supabase
    .from('life_map_domains')
    .select('*')
    .eq('life_map_id', lifeMap.id)

  return {
    ...(lifeMap as LifeMap),
    domains: (domains || []) as LifeMapDomain[],
  }
}

export async function getOrCreateLifeMap(
  supabase: SupabaseClient,
  userId: string
): Promise<LifeMap> {
  const existing = await getCurrentLifeMap(supabase, userId)
  if (existing) return existing

  const { data, error } = await supabase
    .from('life_maps')
    .insert({
      user_id: userId,
      is_current: true,
    })
    .select()
    .single()

  if (error) throw error
  return data as LifeMap
}

export async function upsertDomain(
  supabase: SupabaseClient,
  lifeMapId: string,
  domain: DomainSummary
) {
  // Check if domain already exists for this life map
  const { data: existing } = await supabase
    .from('life_map_domains')
    .select('id')
    .eq('life_map_id', lifeMapId)
    .eq('domain_name', domain.domain)
    .maybeSingle()

  const domainRow = {
    life_map_id: lifeMapId,
    domain_name: domain.domain,
    current_state: domain.currentState,
    whats_working: domain.whatsWorking,
    whats_not_working: domain.whatsNotWorking,
    tensions: [domain.keyTension].filter(Boolean),
    stated_intentions: [domain.statedIntention].filter(Boolean),
    status: domain.status,
  }

  if (existing) {
    const { error } = await supabase
      .from('life_map_domains')
      .update(domainRow)
      .eq('id', existing.id)

    if (error) throw error
  } else {
    const { error } = await supabase
      .from('life_map_domains')
      .insert(domainRow)

    if (error) throw error
  }
}

export async function updateLifeMapSynthesis(
  supabase: SupabaseClient,
  lifeMapId: string,
  synthesis: LifeMapSynthesis
) {
  const { error } = await supabase
    .from('life_maps')
    .update({
      narrative_summary: synthesis.narrative,
      primary_compounding_engine: synthesis.primaryCompoundingEngine,
      quarterly_priorities: synthesis.quarterlyPriorities,
      key_tensions: synthesis.keyTensions,
      anti_goals: synthesis.antiGoals,
    })
    .eq('id', lifeMapId)

  if (error) throw error
}
