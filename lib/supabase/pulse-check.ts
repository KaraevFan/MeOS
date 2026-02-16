import type { SupabaseClient } from '@supabase/supabase-js'
import type { PulseCheckRating, PulseRating } from '@/types/pulse-check'
import type { DomainStatus } from '@/types/chat'

/** Save all ratings from a pulse check submission */
export async function savePulseCheckRatings(
  supabase: SupabaseClient,
  sessionId: string,
  userId: string,
  ratings: PulseCheckRating[],
  isBaseline: boolean
): Promise<void> {
  const rows = ratings.map((r) => ({
    session_id: sessionId,
    user_id: userId,
    domain_name: r.domain,
    rating: r.rating,
    rating_numeric: r.ratingNumeric,
    is_baseline: isBaseline,
  }))

  const { error } = await supabase
    .from('pulse_check_ratings')
    .insert(rows)

  if (error) throw error
}

/** Get pulse check ratings for a specific session */
export async function getPulseCheckRatings(
  supabase: SupabaseClient,
  sessionId: string
): Promise<PulseCheckRating[]> {
  const { data, error } = await supabase
    .from('pulse_check_ratings')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data || []).map((row) => ({
    domain: row.domain_name as string,
    domainKey: domainToKey(row.domain_name as string),
    rating: row.rating as PulseRating,
    ratingNumeric: row.rating_numeric as number,
  }))
}

/** Get the most recent baseline ratings for a user */
export async function getBaselineRatings(
  supabase: SupabaseClient,
  userId: string
): Promise<PulseCheckRating[] | null> {
  // Find the most recent baseline session_id
  const { data: latest, error: latestError } = await supabase
    .from('pulse_check_ratings')
    .select('session_id')
    .eq('user_id', userId)
    .eq('is_baseline', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestError) throw latestError
  if (!latest) return null

  // Fetch only that session's ratings
  const { data, error } = await supabase
    .from('pulse_check_ratings')
    .select('*')
    .eq('session_id', latest.session_id)
    .eq('is_baseline', true)

  if (error) throw error
  if (!data || data.length === 0) return null

  return data.map((row) => ({
    domain: row.domain_name as string,
    domainKey: domainToKey(row.domain_name as string),
    rating: row.rating as PulseRating,
    ratingNumeric: row.rating_numeric as number,
  }))
}

export type TrendDirection = 'improving' | 'declining' | 'steady'

/**
 * Get trend direction for each domain by comparing the two most recent ratings.
 * Returns null for domains with fewer than 2 data points.
 */
export async function getDomainTrends(
  supabase: SupabaseClient,
  userId: string
): Promise<Record<string, TrendDirection | null>> {
  const { data, error } = await supabase
    .from('pulse_check_ratings')
    .select('domain_name, rating_numeric, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  if (!data || data.length === 0) return {}

  // Group by domain and take the two most recent per domain
  const byDomain = new Map<string, number[]>()
  for (const row of data) {
    const name = row.domain_name as string
    const ratings = byDomain.get(name) || []
    if (ratings.length < 2) {
      ratings.push(row.rating_numeric as number)
      byDomain.set(name, ratings)
    }
  }

  const trends: Record<string, TrendDirection | null> = {}
  for (const [domain, ratings] of byDomain) {
    if (ratings.length < 2) {
      trends[domain] = null
    } else {
      // ratings[0] is the latest, ratings[1] is the previous
      const [latest, previous] = ratings
      if (latest > previous) trends[domain] = 'improving'
      else if (latest < previous) trends[domain] = 'declining'
      else trends[domain] = 'steady'
    }
  }

  return trends
}

/**
 * Get the most recent rating per domain for pre-populating re-rating cards.
 */
export async function getLatestRatingsPerDomain(
  supabase: SupabaseClient,
  userId: string
): Promise<PulseCheckRating[]> {
  const { data, error } = await supabase
    .from('pulse_check_ratings')
    .select('domain_name, rating, rating_numeric, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  if (!data || data.length === 0) return []

  // Take the most recent per domain
  const seen = new Set<string>()
  const latest: PulseCheckRating[] = []
  for (const row of data) {
    const name = row.domain_name as string
    if (!seen.has(name)) {
      seen.add(name)
      latest.push({
        domain: name,
        domainKey: domainToKey(name),
        rating: row.rating as PulseRating,
        ratingNumeric: row.rating_numeric as number,
      })
    }
  }

  return latest
}

/** Map pulse check rating to life map domain status */
export function pulseRatingToDomainStatus(rating: PulseRating): DomainStatus {
  switch (rating) {
    case 'thriving': return 'thriving'
    case 'good': return 'stable'
    case 'okay': return 'stable'
    case 'struggling': return 'needs_attention'
    case 'in_crisis': return 'in_crisis'
  }
}

function domainToKey(domain: string): string {
  return domain.toLowerCase().replace(/[^a-z]+/g, '_').replace(/(^_|_$)/g, '')
}
