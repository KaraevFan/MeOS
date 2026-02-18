import { createClient } from '@/lib/supabase/server'
import { getLifeMappingPrompt, getWeeklyCheckinBasePrompt, getAdHocPrompt, getCloseDayPrompt } from './prompts'
import { loadSkill } from './skill-loader'
import { getBaselineRatings } from '@/lib/supabase/pulse-check'
import { UserFileSystem } from '@/lib/markdown/user-file-system'
import { DOMAIN_FILE_MAP } from '@/lib/markdown/constants'
import { getCalendarEvents } from '@/lib/calendar/google-calendar'
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

  // 8. Calendar events (open_day only)
  if (sessionType === 'open_day') {
    try {
      const today = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local time
      const events = await getCalendarEvents(userId, today)
      if (events.length > 0) {
        parts.push('\nTODAY\'S CALENDAR:')
        for (const event of events) {
          const start = event.allDay ? 'All day' : new Date(event.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
          const end = event.allDay ? '' : ` – ${new Date(event.endTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
          parts.push(`- ${start}${end}  ${event.title}`)
        }
      }
    } catch {
      // Calendar not connected or error — graceful degradation
    }

    // Yesterday's day plan + journal cross-reference (for carry-forward)
    try {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toLocaleDateString('en-CA')
      const [yesterdayDayPlan, yesterdayLog] = await Promise.all([
        ufs.readDayPlan(yesterdayStr).catch(() => null),
        ufs.readDailyLog(yesterdayStr).catch(() => null),
      ])
      if (yesterdayDayPlan) {
        parts.push(`\n=== YESTERDAY'S DAY PLAN (${yesterdayStr}) ===`)
        if (yesterdayDayPlan.frontmatter.intention) {
          parts.push(`Intention: "${yesterdayDayPlan.frontmatter.intention}"`)
          parts.push(`Status: ${yesterdayDayPlan.frontmatter.status ?? 'unknown'}`)
          // Check journal for intention fulfillment signal
          if (yesterdayLog?.frontmatter.intention_fulfilled) {
            parts.push(`Intention fulfilled: ${yesterdayLog.frontmatter.intention_fulfilled}`)
          }
        }
        parts.push(yesterdayDayPlan.content)
      }
    } catch {
      // No yesterday day plan — that's fine
    }
  }

  // 8b. Today's day plan (close_day: reference the morning intention)
  if (sessionType === 'close_day') {
    try {
      const todayStr = new Date().toLocaleDateString('en-CA')
      const todayDayPlan = await ufs.readDayPlan(todayStr)
      if (todayDayPlan) {
        parts.push(`\n=== TODAY'S DAY PLAN (${todayStr}) ===`)
        if (todayDayPlan.frontmatter.intention) {
          parts.push(`Morning intention: "${todayDayPlan.frontmatter.intention}"`)
        }
        parts.push(todayDayPlan.content)
      }
    } catch {
      // No day plan today — user may not have done open_day
    }
  }

  // 8b2. Today's captures (close_day: fold into evening synthesis)
  if (sessionType === 'close_day') {
    try {
      const todayStr = new Date().toLocaleDateString('en-CA')
      const captureFilenames = await ufs.listCaptures(todayStr, 10) // max 10 for token budget
      if (captureFilenames.length > 0) {
        const captureResults = await Promise.allSettled(
          captureFilenames.map((filename) => ufs.readCapture(filename))
        )
        const validCaptures = captureResults
          .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof ufs.readCapture>>> =>
            r.status === 'fulfilled' && r.value !== null
          )
          .map((r) => r.value!)

        if (validCaptures.length > 0) {
          parts.push(`\n=== TODAY'S QUICK CAPTURES (${validCaptures.length} shown) ===`)
          for (const capture of validCaptures) {
            const time = new Date(capture.frontmatter.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
            const mode = capture.frontmatter.input_mode === 'voice' ? ' [voice]' : ''
            // Strip block tags to prevent prompt injection from user content
            const sanitized = capture.content.replace(/\[\/?(FILE_UPDATE|DOMAIN_SUMMARY|LIFE_MAP_SYNTHESIS|SESSION_SUMMARY)[^\]]*\]/g, '')
            parts.push(`- ${time}${mode}: "${sanitized}"`)
          }
        }
      }
    } catch {
      // No captures — that's fine
    }
  }

  // 8c. Daily journal context (session-type dependent)
  if (dailyLogFilenames.status === 'fulfilled' && dailyLogFilenames.value.length > 0) {
    const logFilenames = dailyLogFilenames.value

    if (sessionType === 'close_day') {
      // For close_day: inject yesterday's journal for continuity (skip today's log)
      const todayStr = new Date().toISOString().split('T')[0]
      const yesterdayLog = logFilenames.find((f) => {
        const dateFromFile = f.replace('-journal.md', '')
        return dateFromFile !== todayStr
      })
      if (yesterdayLog) {
        const dateFromFilename = yesterdayLog.replace('-journal.md', '')
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
 * Expire stale open_day sessions for a user. Called from the API route
 * before building close_day context, separated from prompt building to
 * keep buildConversationContext free of write side-effects.
 */
export async function expireStaleOpenDaySessions(userId: string): Promise<void> {
  const supabase = await createClient()
  const todayStr = new Date().toLocaleDateString('en-CA')
  await supabase
    .from('sessions')
    .update({ status: 'expired' })
    .eq('user_id', userId)
    .eq('session_type', 'open_day')
    .eq('status', 'active')
    .lt('created_at', `${todayStr}T23:59:59Z`)
}

/**
 * Build the full system prompt for a conversation.
 * Tries skill file first (skills/{session-type}.md), falls back to prompts.ts.
 * Injects life context from markdown files for all session types.
 *
 * Pure read-only — no database writes. Side effects like session expiry
 * should be handled by the caller (see expireStaleOpenDaySessions).
 */
export async function buildConversationContext(
  sessionType: SessionType,
  userId: string,
  options?: { exploreDomain?: string }
): Promise<string> {
  // Try skill file first, fall back to prompts.ts
  const skill = loadSkill(sessionType)
  let basePrompt: string

  if (skill) {
    basePrompt = skill.prompt
  } else if (sessionType === 'life_mapping') {
    basePrompt = getLifeMappingPrompt()
  } else if (sessionType === 'close_day') {
    basePrompt = getCloseDayPrompt()
  } else if (sessionType === 'open_day') {
    // Shouldn't reach here if skill file exists, but safety fallback
    basePrompt = 'You are Sage, conducting a morning "Open the Day" session. Help the user commit to one clear intention for the day.'
  } else if (sessionType === 'ad_hoc') {
    basePrompt = getAdHocPrompt(options?.exploreDomain)
  } else {
    basePrompt = getWeeklyCheckinBasePrompt()
  }

  // Add FILE_UPDATE format instructions if not already in skill prompt
  if (skill) {
    basePrompt += getFileUpdateFormatInstructions()
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

/**
 * FILE_UPDATE format instructions appended to skill-based prompts.
 */
function getFileUpdateFormatInstructions(): string {
  return `

Output format — [FILE_UPDATE] blocks:
When you create or update user data, output it as [FILE_UPDATE] blocks. The system handles file storage and metadata (YAML frontmatter) — you write only the markdown body.

Block syntax:
[FILE_UPDATE type="<file_type>" name="<optional_name>"]
<markdown body content — no YAML frontmatter>
[/FILE_UPDATE]

Available file types:
- type="domain" name="<Domain Name>" — Update a life domain
- type="overview" — Update the life map overview
- type="life-plan" — Update the life plan
- type="check-in" — Create a check-in summary
- type="daily-log" name="{YYYY-MM-DD}" — Create a daily journal entry (supports energy, mood_signal, domains_touched attributes)
- type="day-plan" name="{YYYY-MM-DD}" — Create or update a day plan
- type="sage-context" — Update your working model of the user
- type="sage-patterns" — Update observed patterns

Critical rules:
- Do NOT include YAML frontmatter. The system adds metadata automatically.
- Write the FULL file content, not a partial update. Each block replaces the entire file body.
- Emit each [FILE_UPDATE] block as its own section.`
}
