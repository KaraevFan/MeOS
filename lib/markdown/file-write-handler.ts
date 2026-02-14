import type { FileUpdateData, SessionType } from '@/types/chat'
import type { UserFileSystem } from './user-file-system'
import {
  DOMAIN_FILE_MAP,
  SESSION_WRITE_PERMISSIONS,
  MAX_FILE_UPDATE_BLOCKS_PER_MESSAGE,
  FILE_TYPES,
} from './constants'
import type { DomainName } from '@/types/chat'

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
    // Unknown session type — be permissive (allow all valid paths)
    return true
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
          await ufs.writeDomain(filename, update.content, {
            domain: filename,
            updated_by: 'sage',
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

  return results.map((result, i) => {
    if (result.status === 'fulfilled') {
      return result.value
    }
    return {
      success: false,
      path: resolveFileUpdatePath(updates[i]) ?? 'unknown',
      error: String(result.reason),
    }
  })
}
