import type { SupabaseClient } from '@supabase/supabase-js'
import type { SessionType } from '@/types/chat'

export async function getActiveSession(
  supabase: SupabaseClient,
  userId: string,
  sessionType: SessionType
) {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('session_type', sessionType)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows returned, which is expected
    throw error
  }

  if (!data) return null

  // Load messages
  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('session_id', data.id)
    .order('created_at', { ascending: true })

  return { session: data, messages: messages || [] }
}

export async function createSession(
  supabase: SupabaseClient,
  userId: string,
  sessionType: SessionType
) {
  const { data, error } = await supabase
    .from('sessions')
    .insert({
      user_id: userId,
      session_type: sessionType,
      status: 'active',
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function saveMessage(
  supabase: SupabaseClient,
  sessionId: string,
  role: 'user' | 'assistant',
  content: string,
  hasStructuredBlock: boolean
) {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      session_id: sessionId,
      role,
      content,
      has_structured_block: hasStructuredBlock,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function completeSession(
  supabase: SupabaseClient,
  sessionId: string
) {
  const { error } = await supabase
    .from('sessions')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', sessionId)

  if (error) throw error
}

export async function updateDomainsExplored(
  supabase: SupabaseClient,
  sessionId: string,
  domains: string[]
) {
  const { error } = await supabase
    .from('sessions')
    .update({ domains_explored: domains })
    .eq('id', sessionId)

  if (error) throw error
}

export async function updateSessionSummary(
  supabase: SupabaseClient,
  sessionId: string,
  summary: string,
  themes: string[],
  commitments: string[],
  sentiment: string,
  energyLevel: number | null
) {
  const { error } = await supabase
    .from('sessions')
    .update({
      ai_summary: summary,
      key_themes: themes,
      commitments_made: commitments,
      sentiment,
      energy_level: energyLevel,
    })
    .eq('id', sessionId)

  if (error) throw error
}
