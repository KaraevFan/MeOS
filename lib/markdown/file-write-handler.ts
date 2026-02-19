import type { FileUpdateData, SessionType } from '@/types/chat'
import type { UserFileSystem } from './user-file-system'
import {
  DOMAIN_FILE_MAP,
  SESSION_WRITE_PERMISSIONS,
  MAX_FILE_UPDATE_BLOCKS_PER_MESSAGE,
  FILE_TYPES,
} from './constants'
import type { DomainName } from '@/types/chat'
import type { DailyLogFrontmatter, DayPlanFrontmatter } from '@/types/markdown-files'

export interface FileWriteResult {
  success: boolean
  path: string
  error?: string
}

/**
 * Resolve a semantic file update identifier to a concrete file path.
 * Keeps resolution logic out of the parser.
 */
export function resolveFileUpdatePath(update: FileUpdateData): string | null {
  switch (update.fileType) {
    case FILE_TYPES.DOMAIN: {
      if (!update.name) return null
      const filename = DOMAIN_FILE_MAP[update.name as DomainName]
      if (!filename) {
        console.warn(`[FileWriteHandler] Unknown domain name: ${update.name}`)
        return null
      }
      return `life-map/${filename}.md`
    }
    case FILE_TYPES.OVERVIEW:
      return 'life-map/_overview.md'
    case FILE_TYPES.LIFE_PLAN:
      return 'life-plan/current.md'
    case FILE_TYPES.CHECK_IN: {
      // Check-in files need a date-based name
      const date = new Date().toISOString().split('T')[0]
      const type = update.name ?? 'weekly'
      return `check-ins/${date}-${type}.md`
    }
    case FILE_TYPES.SAGE_CONTEXT:
      return 'sage/context.md'
    case FILE_TYPES.SAGE_PATTERNS:
      return 'sage/patterns.md'
    case FILE_TYPES.SESSION_INSIGHTS:
      return 'sage/session-insights.md'
    case FILE_TYPES.DAILY_LOG: {
      const date = update.name ?? new Date().toISOString().split('T')[0]
      return `daily-logs/${date}-journal.md`
    }
    case FILE_TYPES.DAY_PLAN: {
      const date = update.name ?? new Date().toISOString().split('T')[0]
      return `day-plans/${date}.md`
    }
    default:
      console.warn(`[FileWriteHandler] Unknown file type: ${update.fileType}`)
      return null
  }
}

/**
 * Check if a write is permitted for the given session type.
 * Prevents prompt injection from writing to unauthorized paths.
 */
function isWritePermitted(path: string, sessionType: SessionType | string): boolean {
  const allowedPrefixes = SESSION_WRITE_PERMISSIONS[sessionType]
  if (!allowedPrefixes) {
    // Unknown session type — deny by default
    console.warn(`[FileWriteHandler] Unknown session type "${sessionType}" — write denied`)
    return false
  }
  return allowedPrefixes.some((prefix) => path.startsWith(prefix) || path === prefix)
}

/**
 * Handle a single FILE_UPDATE block: resolve path, validate, write to storage.
 */
export async function handleFileUpdate(
  ufs: UserFileSystem,
  update: FileUpdateData,
  sessionType: SessionType | string
): Promise<FileWriteResult> {
  // Resolve semantic identifier to file path
  const resolvedPath = resolveFileUpdatePath(update)
  if (!resolvedPath) {
    return {
      success: false,
      path: `${update.fileType}/${update.name ?? ''}`,
      error: `Could not resolve path for type="${update.fileType}" name="${update.name ?? ''}"`,
    }
  }

  // Check session-scoped write permissions
  if (!isWritePermitted(resolvedPath, sessionType)) {
    console.warn(`[FileWriteHandler] Write denied: ${resolvedPath} not permitted for session type ${sessionType}`)
    return {
      success: false,
      path: resolvedPath,
      error: `Write to ${resolvedPath} not permitted during ${sessionType} session`,
    }
  }

  // Dispatch to the appropriate typed write method
  try {
    switch (update.fileType) {
      case FILE_TYPES.DOMAIN: {
        const filename = DOMAIN_FILE_MAP[update.name as DomainName]
        if (filename) {
          const ratingStr = update.attributes?.updated_rating
          const updatedRating = ratingStr ? Number(ratingStr) : undefined
          const validRating = updatedRating && updatedRating >= 1 && updatedRating <= 5
            ? updatedRating : undefined

          await ufs.writeDomain(filename, update.content, {
            domain: filename,
            updated_by: 'sage',
            ...(update.status ? { status: update.status } : {}),
            ...(update.previewLine ? { preview_line: update.previewLine } : {}),
            ...(validRating ? { score: validRating } : {}),
          })
        }
        break
      }
      case FILE_TYPES.OVERVIEW:
        await ufs.writeOverview(update.content, { updated_by: 'sage' })
        break
      case FILE_TYPES.LIFE_PLAN:
        await ufs.writeLifePlan(update.content, { updated_by: 'sage' })
        break
      case FILE_TYPES.CHECK_IN: {
        const date = new Date().toISOString().split('T')[0]
        await ufs.writeCheckIn(date, update.content, {
          type: 'weekly-check-in',
          date,
        })
        break
      }
      case FILE_TYPES.SAGE_CONTEXT:
        await ufs.writeSageContext(update.content)
        break
      case FILE_TYPES.SAGE_PATTERNS:
        await ufs.writePatterns(update.content)
        break
      case FILE_TYPES.SESSION_INSIGHTS:
        await ufs.writeSessionInsights(update.content)
        break
      case FILE_TYPES.DAILY_LOG: {
        const date = update.name ?? new Date().toISOString().split('T')[0]
        const overrides: Partial<DailyLogFrontmatter> = {}
        const VALID_ENERGY = new Set<DailyLogFrontmatter['energy']>(['high', 'moderate', 'low'])
        if (update.attributes?.energy && VALID_ENERGY.has(update.attributes.energy as DailyLogFrontmatter['energy'])) {
          overrides.energy = update.attributes.energy as DailyLogFrontmatter['energy']
        }
        if (update.attributes?.mood_signal) {
          overrides.mood_signal = update.attributes.mood_signal
        }
        if (update.attributes?.domains_touched) {
          overrides.domains_touched = update.attributes.domains_touched.split(',').map(s => s.trim())
        }
        await ufs.writeDailyLog(date, update.content, overrides)
        break
      }
      case FILE_TYPES.DAY_PLAN: {
        const date = update.name ?? new Date().toISOString().split('T')[0]
        const planOverrides: Partial<DayPlanFrontmatter> = {}
        if (update.attributes?.intention) {
          planOverrides.intention = update.attributes.intention
        }
        if (update.attributes?.carried_forward_from) {
          planOverrides.carried_forward_from = update.attributes.carried_forward_from
        }
        await ufs.writeDayPlan(date, update.content, planOverrides)
        break
      }
      default:
        return {
          success: false,
          path: resolvedPath,
          error: `Unhandled file type: ${update.fileType}`,
        }
    }

    return { success: true, path: resolvedPath }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[FileWriteHandler] Write failed for ${resolvedPath}:`, message)
    return { success: false, path: resolvedPath, error: message }
  }
}

/**
 * Process all FILE_UPDATE blocks from a parsed message.
 * Enforces rate limit. Fires writes and returns results.
 */
export async function handleAllFileUpdates(
  ufs: UserFileSystem,
  updates: FileUpdateData[],
  sessionType: SessionType | string
): Promise<FileWriteResult[]> {
  // Rate limit: max blocks per message
  if (updates.length > MAX_FILE_UPDATE_BLOCKS_PER_MESSAGE) {
    console.warn(
      `[FileWriteHandler] Rate limit: ${updates.length} blocks exceeds max ${MAX_FILE_UPDATE_BLOCKS_PER_MESSAGE}. Truncating.`
    )
    updates = updates.slice(0, MAX_FILE_UPDATE_BLOCKS_PER_MESSAGE)
  }

  // Execute all writes in parallel
  const results = await Promise.allSettled(
    updates.map((update) => handleFileUpdate(ufs, update, sessionType))
  )

  const writeResults = results.map((result, i) => {
    if (result.status === 'fulfilled') {
      return result.value
    }
    return {
      success: false,
      path: resolveFileUpdatePath(updates[i]) ?? 'unknown',
      error: String(result.reason),
    }
  })

  // Post-processing: after close_day writes a journal, mark today's captures as folded
  if (sessionType === 'close_day') {
    const journalWritten = writeResults.some(
      (r) => r.success && r.path.startsWith('daily-logs/')
    )
    if (journalWritten) {
      // Fire-and-forget: don't block the response for capture fold updates
      markCapturesFolded(ufs).catch((err) => {
        console.warn('[FileWriteHandler] Capture fold marking failed:', err instanceof Error ? err.message : String(err))
      })
    }
  }

  return writeResults
}

/**
 * Mark all of today's captures as folded into the journal.
 * Fire-and-forget — failures are logged, not thrown to the caller.
 */
async function markCapturesFolded(ufs: UserFileSystem): Promise<void> {
  const today = new Date().toLocaleDateString('en-CA')
  const filenames = await ufs.listCaptures(today)
  if (filenames.length === 0) return

  await Promise.allSettled(
    filenames.map((filename) =>
      ufs.updateCaptureFrontmatter(filename, { folded_into_journal: true })
    )
  )
}
