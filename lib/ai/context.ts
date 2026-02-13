import { createClient } from '@/lib/supabase/server'
import { getLifeMappingPrompt } from './prompts'
import { getBaselineRatings } from '@/lib/supabase/pulse-check'
import type { SessionType } from '@/types/chat'
import type { LifeMap, LifeMapDomain, Pattern } from '@/types/database'
import type { PulseCheckRating } from '@/types/pulse-check'

/**
 * Serialize life map data into a structured text block for the system prompt.
 *
 * Token budget estimate: ~500-1500 tokens for a fully mapped user with 8 domains,
 * synthesis, and 5 session summaries. Well within Claude's context budget and far
 * cheaper than injecting raw transcripts.
 */
function serializeLifeMapContext(
  lifeMap: LifeMap & { domains: LifeMapDomain[] },
  pulseCheckBaseline: PulseCheckRating[] | null,
  recentSessionSummaries: { date: string; summary: string }[],
  activePatterns: Pattern[],
  lastCommitment: string
): string {
  const parts: string[] = ['=== USER\'S LIFE MAP ===']

  // Pulse check baseline
  if (pulseCheckBaseline && pulseCheckBaseline.length > 0) {
    parts.push('\nPULSE CHECK BASELINE:')
    for (const r of pulseCheckBaseline) {
      parts.push(`- ${r.domain}: ${r.rating} (${r.ratingNumeric}/5)`)
    }
  }

  // Explored domains
  const exploredDomains = lifeMap.domains.filter((d) => d.current_state)
  if (exploredDomains.length > 0) {
    parts.push('\nEXPLORED DOMAINS:')
    for (const domain of exploredDomains) {
      parts.push(`---`)
      parts.push(`${domain.domain_name.toUpperCase()} (Status: ${domain.status || 'unknown'})`)
      if (domain.current_state) {
        parts.push(`Current state: ${domain.current_state}`)
      }
      if (domain.whats_working?.length) {
        parts.push(`What's working: ${domain.whats_working.join(', ')}`)
      }
      if (domain.whats_not_working?.length) {
        parts.push(`What's not working: ${domain.whats_not_working.join(', ')}`)
      }
      if (domain.tensions?.length) {
        parts.push(`Key tension: ${domain.tensions.join(', ')}`)
      }
      if (domain.stated_intentions?.length) {
        parts.push(`Stated intention: ${domain.stated_intentions.join(', ')}`)
      }
    }
    parts.push('---')
  }

  // Unexplored domains
  const allDomainNames = [
    'Career / Work', 'Relationships', 'Health / Body', 'Finances',
    'Learning / Growth', 'Creative Pursuits', 'Play / Fun / Adventure', 'Meaning / Purpose',
  ]
  const exploredNames = new Set(exploredDomains.map((d) => d.domain_name))
  const unexplored = allDomainNames.filter((d) => !exploredNames.has(d))
  if (unexplored.length > 0) {
    parts.push(`\nUNEXPLORED DOMAINS: ${unexplored.join(', ')}`)
  }

  // Synthesis
  if (lifeMap.narrative_summary) {
    parts.push('\nSYNTHESIS:')
    parts.push(`Narrative: ${lifeMap.narrative_summary}`)
    if (lifeMap.primary_compounding_engine) {
      parts.push(`Primary Compounding Engine: ${lifeMap.primary_compounding_engine}`)
    }
    if (lifeMap.quarterly_priorities?.length) {
      parts.push(`Quarterly Priorities: ${lifeMap.quarterly_priorities.join(', ')}`)
    }
    if (lifeMap.key_tensions?.length) {
      parts.push(`Key Tensions: ${lifeMap.key_tensions.join(', ')}`)
    }
    if (lifeMap.anti_goals?.length) {
      parts.push(`Anti-Goals: ${lifeMap.anti_goals.join(', ')}`)
    }
  }

  // Recent session history
  if (recentSessionSummaries.length > 0) {
    parts.push('\nRECENT SESSION HISTORY:')
    for (const s of recentSessionSummaries) {
      parts.push(`- [${s.date}]: ${s.summary}`)
    }
  }

  // Active patterns
  if (activePatterns.length > 0) {
    parts.push('\nACTIVE PATTERNS:')
    for (const p of activePatterns) {
      parts.push(`- ${p.description} (seen ${p.occurrence_count}x, related to: ${p.related_domain || 'general'})`)
    }
  }

  // Last commitment
  if (lastCommitment) {
    parts.push(`\nLAST STATED COMMITMENT: ${lastCommitment}`)
  }

  parts.push('=== END LIFE MAP ===')
  return parts.join('\n')
}

/**
 * Fetch all life map data and serialize it for system prompt injection.
 * Returns null if no life map exists (new user).
 */
async function fetchAndSerializeLifeMapContext(userId: string): Promise<string | null> {
  const supabase = await createClient()

  // Get current life map with domains
  const { data: lifeMap } = await supabase
    .from('life_maps')
    .select('*')
    .eq('user_id', userId)
    .eq('is_current', true)
    .single()

  if (!lifeMap) return null

  let domains: LifeMapDomain[] = []
  const { data: domainData } = await supabase
    .from('life_map_domains')
    .select('*')
    .eq('life_map_id', lifeMap.id)

  domains = (domainData || []) as LifeMapDomain[]

  // Check if there's actually any content
  const hasContent = domains.length > 0 || lifeMap.narrative_summary
  if (!hasContent) return null

  // Get pulse check baseline
  const pulseBaseline = await getBaselineRatings(supabase, userId).catch(() => null)

  // Get last 3-5 session summaries
  const { data: recentSessions } = await supabase
    .from('sessions')
    .select('ai_summary, completed_at')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(5)

  const sessionSummaries = (recentSessions || [])
    .filter((s) => s.ai_summary)
    .map((s) => ({
      date: s.completed_at ? new Date(s.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Unknown',
      summary: s.ai_summary as string,
    }))

  // Get active patterns
  const { data: patterns } = await supabase
    .from('patterns')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)

  // Get last commitment
  const { data: lastSession } = await supabase
    .from('sessions')
    .select('commitments_made')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .single()

  const lastCommitment = lastSession?.commitments_made?.[0] || ''

  return serializeLifeMapContext(
    { ...(lifeMap as LifeMap), domains },
    pulseBaseline,
    sessionSummaries,
    (patterns || []) as Pattern[],
    lastCommitment
  )
}

/**
 * Build the full system prompt for a conversation.
 * Injects life map context for ALL session types when the user has data.
 */
export async function buildConversationContext(
  sessionType: SessionType,
  userId: string
): Promise<string> {
  const basePrompt = sessionType === 'life_mapping'
    ? getLifeMappingPrompt()
    : getWeeklyCheckinBasePrompt()

  // Fetch life map context (returns null if no life map exists)
  const lifeMapContext = await fetchAndSerializeLifeMapContext(userId)

  if (!lifeMapContext) {
    return basePrompt // New user, no context to inject
  }

  // Add longitudinal comparison instruction for weekly check-ins
  let prompt = `${basePrompt}\n\n${lifeMapContext}`

  if (sessionType === 'weekly_checkin') {
    prompt += `\n\nThe user's initial pulse check baseline is included in the context above. When discussing domains, reference how things have shifted since their initial self-assessment. For example: "When we first talked, you rated career as 'struggling' — it sounds like things have moved to a better place."`
  }

  return prompt
}

/**
 * Get the weekly check-in base prompt (without context injection).
 * Context is now injected separately by buildConversationContext().
 */
function getWeeklyCheckinBasePrompt(): string {
  return `You are Sage, an AI life partner built into MeOS. You are conducting a weekly check-in with a returning user.

Your goal:
Help the user reflect on their week, check progress against their stated intentions, surface emerging patterns, and set one intention for the coming week.

Session structure:
1. OPENING: Warm, simple. "Hey, welcome back. How are you doing?" Let them talk.
2. REFLECTION: Ask about what happened this week, especially related to their stated priorities and last commitment. If they didn't follow through, explore why with curiosity (not judgment): "What got in the way?"
3. PATTERN SURFACING: If you notice recurring themes across sessions (same obstacle, same avoidance, same energy pattern), name it gently: "I've noticed this is the third week where X came up. Want to dig into that?"
4. ENERGY CHECK: Ask about their energy/mood this week. Track the trend.
5. FORWARD-LOOKING: "What's the one thing you want to be true by next time we talk?"
6. CLOSE: Brief, warm. Update the life map based on anything new.

Critical rules:
- This is NOT a performance review. Never make the user feel judged for not hitting goals.
- Explore obstacles with genuine curiosity. "What got in the way?" is always better than "Why didn't you do it?"
- If the user seems burned out or overwhelmed, suggest scaling back rather than pushing harder.
- Keep it to 5-10 minutes. Don't over-extend. Respect their time.
- Responses should be concise — 2-4 sentences typical.
- After 3+ sessions, start actively looking for and naming patterns.
- Emit each [DOMAIN_SUMMARY] as its own message. Never combine two domain summaries in one response.
- When listing priorities, do NOT include numbering (no "1)", "2)", etc.). The app handles display numbering.

After the session, generate:
[SESSION_SUMMARY]
Date: {today's date}
Sentiment: {overall emotional tone}
Energy level: {1-5 if discussed}
Key themes: {what came up, comma-separated}
Commitments: {what the user said they'd do, comma-separated}
Life map updates: {any changes to domains, priorities, or tensions}
Patterns observed: {any recurring themes across sessions}
[/SESSION_SUMMARY]`
}
