import { createClient } from '@/lib/supabase/server'
import { getLifeMappingPrompt, getWeeklyCheckinBasePrompt, getAdHocPrompt, getCloseDayPrompt } from './prompts'
import { getBaselineRatings } from '@/lib/supabase/pulse-check'
import { UserFileSystem } from '@/lib/markdown/user-file-system'
import { DOMAIN_FILE_MAP } from '@/lib/markdown/constants'
import type { SessionType, DomainName } from '@/types/chat'

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
async function fetchAndInjectFileContext(userId: string, exploreDomain?: string, sessionType?: SessionType): Promise<string | null> {
  const supabase = await createClient()
  const ufs = new UserFileSystem(supabase, userId)

  const parts: string[] = ["=== USER'S LIFE CONTEXT ==="]

  // Read all context sources in parallel
  const [sageContext, overview, lifePlan, checkInFilenames, patterns, pulseBaseline, dailyLogFilenames] =
    await Promise.allSettled([
      ufs.readSageContext(),
      ufs.readOverview(),
      ufs.readLifePlan(),
      ufs.listCheckIns(3),
      ufs.readPatterns(),
      getBaselineRatings(supabase, userId),
      ufs.listDailyLogs(7),
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

  // 5. Recent check-ins (parallel reads)
  if (checkInFilenames.status === 'fulfilled' && checkInFilenames.value.length > 0) {
    const checkInResults = await Promise.allSettled(
      checkInFilenames.value.map((filename) => ufs.readCheckIn(filename))
    )
    parts.push('\nRECENT CHECK-INS:')
    for (const result of checkInResults) {
      if (result.status === 'fulfilled' && result.value) {
        const date = result.value.frontmatter.date ?? 'unknown'
        parts.push(`\n--- ${date} ---`)
        parts.push(result.value.content)
      }
    }
  }

  // 6. Flagged domain files — query file_index instead of reading all 8 domains
  const { data: flaggedDomains } = await supabase
    .from('file_index')
    .select('domain_name')
    .eq('user_id', userId)
    .eq('file_type', 'domain')
    .in('status', ['needs_attention', 'in_crisis'])

  if (flaggedDomains && flaggedDomains.length > 0) {
    const flaggedResults = await Promise.allSettled(
      flaggedDomains.map((row) => ufs.readDomain(row.domain_name))
    )
    for (const result of flaggedResults) {
      if (result.status === 'fulfilled' && result.value) {
        const name = result.value.frontmatter.domain ?? 'unknown'
        const status = result.value.frontmatter.status ?? 'needs_attention'
        parts.push(`\n=== ${name.toUpperCase()} (${status.replace('_', ' ')}) ===`)
        parts.push(result.value.content)
      }
    }
  }

  // 6b. Explore domain — inject regardless of status (for "Talk to Sage about this" from Life Map)
  if (exploreDomain) {
    const filename = DOMAIN_FILE_MAP[exploreDomain as DomainName]
    if (filename) {
      const alreadyInjected = flaggedDomains?.some((d) => d.domain_name === filename)
      if (!alreadyInjected) {
        try {
          const domainFile = await ufs.readDomain(filename)
          if (domainFile) {
            const name = domainFile.frontmatter.domain ?? exploreDomain
            const status = domainFile.frontmatter.status ?? 'unknown'
            parts.push(`\n=== ${name.toUpperCase()} (${status.replace('_', ' ')}) [EXPLORE TARGET] ===`)
            parts.push(domainFile.content)
          }
        } catch {
          // Domain file may not exist yet — that's fine
        }
      }
    }
  }

  // 7. Active patterns
  if (patterns.status === 'fulfilled' && patterns.value) {
    parts.push('\nACTIVE PATTERNS:')
    parts.push(patterns.value.content)
  }

  // 8. Daily journal context (session-type dependent)
  if (dailyLogFilenames.status === 'fulfilled' && dailyLogFilenames.value.length > 0) {
    const logFilenames = dailyLogFilenames.value

    if (sessionType === 'close_day') {
      // For close_day: inject yesterday's journal (most recent) for continuity
      const lastLog = logFilenames[0] // Already sorted newest-first
      if (lastLog) {
        const dateFromFilename = lastLog.replace('-journal.md', '')
        const logFile = await ufs.readDailyLog(dateFromFilename)
        if (logFile) {
          parts.push(`\n=== YESTERDAY'S JOURNAL (${dateFromFilename}) ===`)
          parts.push(logFile.content)
        }
      }
    } else if (sessionType === 'weekly_checkin') {
      // For weekly check-in: inject all daily logs since last check-in
      let lastCheckInDate: string | null = null
      if (checkInFilenames.status === 'fulfilled' && checkInFilenames.value.length > 0) {
        // Extract date from filename like "2026-02-14-weekly.md"
        const match = checkInFilenames.value[0].match(/^(\d{4}-\d{2}-\d{2})/)
        if (match) lastCheckInDate = match[1]
      }

      const logResults = await Promise.allSettled(
        logFilenames
          .filter((filename) => {
            if (!lastCheckInDate) return true // No check-in yet — include all
            const logDate = filename.replace('-journal.md', '')
            return logDate > lastCheckInDate
          })
          .map((filename) => {
            const dateFromFilename = filename.replace('-journal.md', '')
            return ufs.readDailyLog(dateFromFilename)
          })
      )

      const validLogs = logResults
        .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof ufs.readDailyLog>>> =>
          r.status === 'fulfilled' && r.value !== null
        )
        .map((r) => r.value!)

      if (validLogs.length > 0) {
        parts.push('\n=== DAILY JOURNALS THIS WEEK ===')
        for (const log of validLogs) {
          parts.push(`\n--- ${log.frontmatter.date} (energy: ${log.frontmatter.energy ?? 'unknown'}) ---`)
          parts.push(log.content)
        }
      }
    }
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
  userId: string,
  options?: { exploreDomain?: string }
): Promise<string> {
  let basePrompt: string
  if (sessionType === 'life_mapping') {
    basePrompt = getLifeMappingPrompt()
  } else if (sessionType === 'close_day') {
    basePrompt = getCloseDayPrompt()
  } else if (sessionType === 'ad_hoc') {
    basePrompt = getAdHocPrompt(options?.exploreDomain)
  } else {
    basePrompt = getWeeklyCheckinBasePrompt()
  }

  const fileContext = await fetchAndInjectFileContext(userId, options?.exploreDomain, sessionType)

  if (!fileContext) {
    return basePrompt // New user, no context to inject
  }

  let prompt = `${basePrompt}\n\n${fileContext}`

  if (sessionType === 'weekly_checkin') {
    prompt += `\n\nThe user's pulse check baseline is included above. When discussing domains, reference how things have shifted since their initial self-assessment. For example: "When we first talked, you rated career as 'struggling' — it sounds like things have moved to a better place."`
    prompt += `\n\nIf daily journal entries are available above, use them as the week's narrative. Reference specific observations the user made in their evening reflections rather than asking "how was your week?" cold. For example: "Looking at your week, you mentioned feeling stuck on onboarding three times in your evening reflections — what's going on there?"`
  }

  return prompt
}
