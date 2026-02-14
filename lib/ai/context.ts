import { createClient } from '@/lib/supabase/server'
import { getLifeMappingPrompt, getWeeklyCheckinBasePrompt } from './prompts'
import { getBaselineRatings } from '@/lib/supabase/pulse-check'
import { UserFileSystem } from '@/lib/markdown/user-file-system'
import type { SessionType } from '@/types/chat'

/**
 * Fetch user context from markdown files and serialize for system prompt injection.
 * Reads in parallel where possible. Returns null if no files exist (new user).
 *
 * Priority order for token budget:
 * 1. Pulse check baseline (DB, always full)
 * 2. Sage working model (always full)
 * 3. Life map overview (always full)
 * 4. Life plan (always full)
 * 5. Recent check-ins (last 3)
 * 6. Flagged domain files (needs_attention / in_crisis only)
 * 7. Active patterns
 */
async function fetchAndInjectFileContext(userId: string): Promise<string | null> {
  const supabase = await createClient()
  const ufs = new UserFileSystem(supabase, userId)

  const parts: string[] = ["=== USER'S LIFE CONTEXT ==="]

  // Read all context sources in parallel
  const [sageContext, overview, lifePlan, checkInFilenames, patterns, pulseBaseline] =
    await Promise.allSettled([
      ufs.readSageContext(),
      ufs.readOverview(),
      ufs.readLifePlan(),
      ufs.listCheckIns(3),
      ufs.readPatterns(),
      getBaselineRatings(supabase, userId),
    ])

  // 1. Pulse check baseline (still from relational DB)
  if (pulseBaseline.status === 'fulfilled' && pulseBaseline.value && pulseBaseline.value.length > 0) {
    parts.push('\nPULSE CHECK BASELINE:')
    for (const r of pulseBaseline.value) {
      parts.push(`- ${r.domain}: ${r.rating} (${r.ratingNumeric}/5)`)
    }
  }

  // 2. Sage working model
  if (sageContext.status === 'fulfilled' && sageContext.value) {
    parts.push('\nSAGE WORKING MODEL:')
    parts.push(sageContext.value.content)
  }

  // 3. Life map overview
  if (overview.status === 'fulfilled' && overview.value) {
    parts.push('\n=== LIFE MAP ===')
    parts.push(overview.value.content)
  }

  // 4. Life plan
  if (lifePlan.status === 'fulfilled' && lifePlan.value) {
    const quarter = lifePlan.value.frontmatter.quarter ?? 'current'
    parts.push(`\n=== LIFE PLAN (${quarter}) ===`)
    parts.push(lifePlan.value.content)
  }

  // 5. Recent check-ins
  if (checkInFilenames.status === 'fulfilled' && checkInFilenames.value.length > 0) {
    parts.push('\nRECENT CHECK-INS:')
    for (const filename of checkInFilenames.value) {
      const checkIn = await ufs.readCheckIn(filename).catch(() => null)
      if (checkIn) {
        const date = checkIn.frontmatter.date ?? filename
        parts.push(`\n--- ${date} ---`)
        parts.push(checkIn.content)
      }
    }
  }

  // 6. Domain files for domains needing attention
  const domainFiles = await ufs.listFiles('life-map/').catch(() => [] as string[])
  for (const filePath of domainFiles) {
    if (filePath.includes('_overview')) continue
    const filename = filePath.replace('life-map/', '').replace('.md', '')
    const domain = await ufs.readDomain(filename).catch(() => null)
    if (domain && (domain.frontmatter.status === 'needs_attention' || domain.frontmatter.status === 'in_crisis')) {
      const name = domain.frontmatter.domain ?? filename
      parts.push(`\n=== ${name.toUpperCase()} (${domain.frontmatter.status.replace('_', ' ')}) ===`)
      parts.push(domain.content)
    }
  }

  // 7. Active patterns
  if (patterns.status === 'fulfilled' && patterns.value) {
    parts.push('\nACTIVE PATTERNS:')
    parts.push(patterns.value.content)
  }

  parts.push("\n=== END LIFE CONTEXT ===")

  // If only header + footer, no meaningful content was found
  if (parts.length <= 2) return null

  return parts.join('\n')
}

/**
 * Build the full system prompt for a conversation.
 * Injects life context from markdown files for all session types.
 */
export async function buildConversationContext(
  sessionType: SessionType,
  userId: string
): Promise<string> {
  const basePrompt = sessionType === 'life_mapping'
    ? getLifeMappingPrompt()
    : getWeeklyCheckinBasePrompt()

  const fileContext = await fetchAndInjectFileContext(userId)

  if (!fileContext) {
    return basePrompt // New user, no context to inject
  }

  let prompt = `${basePrompt}\n\n${fileContext}`

  if (sessionType === 'weekly_checkin') {
    prompt += `\n\nThe user's pulse check baseline is included above. When discussing domains, reference how things have shifted since their initial self-assessment. For example: "When we first talked, you rated career as 'struggling' — it sounds like things have moved to a better place."`
  }

  return prompt
}
