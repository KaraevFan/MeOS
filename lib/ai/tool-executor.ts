import type { SupabaseClient } from '@supabase/supabase-js'
import {
  handleFileUpdate,
  resolveFileUpdatePath,
  markCapturesFoldedForToolUse,
} from '@/lib/markdown/file-write-handler'
import { UserFileSystem } from '@/lib/markdown/user-file-system'
import { SESSION_WRITE_PERMISSIONS } from '@/lib/markdown/constants'
import { completeSession } from '@/lib/supabase/sessions'
import { captureException } from '@/lib/monitoring/sentry'
import { addDaysIso } from '@/lib/utils'
import type { FileUpdateData, SessionType, StructuredArcType, CompletedArc, SessionMetadata } from '@/types/chat'

/** Maximum tool calls allowed per request (rate limit within agentic loop) */
const MAX_TOOL_CALLS_PER_REQUEST = 15

export interface ToolExecutionContext {
  userId: string
  sessionId: string
  sessionType: SessionType
  activeMode: StructuredArcType | null
  timezone: string
  supabase: SupabaseClient
  metadata: SessionMetadata
}

export interface ToolResult {
  success: boolean
  data?: Record<string, unknown>
  error?: string
}

/** Track tool call count per request to enforce rate limiting.
 * Safe on Vercel serverless (each invocation gets its own isolate).
 * If moving to a long-lived server, pass this through ToolExecutionContext instead. */
let requestToolCallCount = 0

export function resetToolCallCounter(): void {
  requestToolCallCount = 0
}

/**
 * Execute a tool call and return the result.
 * Enforces session-scoped write permissions and input validation.
 */
export async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolResult> {
  // Rate limit: max tool calls per request
  requestToolCallCount++
  if (requestToolCallCount > MAX_TOOL_CALLS_PER_REQUEST) {
    return { success: false, error: `Rate limit: max ${MAX_TOOL_CALLS_PER_REQUEST} tool calls per request` }
  }

  switch (toolName) {
    case 'save_file':
      return executeSaveFile(toolInput, context)
    case 'complete_session':
      return executeCompleteSession(toolInput, context)
    case 'enter_structured_arc':
      return executeEnterStructuredArc(toolInput, context)
    case 'show_pulse_check':
      // Split-conversation tools are handled at the loop level, not here.
      // This is a fallback in case it reaches the executor.
      return { success: true, data: { type: 'split_conversation', tool: 'show_pulse_check' } }
    case 'show_options':
      return { success: true, data: { type: 'split_conversation', tool: 'show_options' } }
    default:
      return { success: false, error: `Unknown tool: ${toolName}` }
  }
}

/**
 * Execute save_file tool: validate input, resolve path, check permissions, write file.
 */
async function executeSaveFile(
  input: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolResult> {
  // Input validation
  const fileType = input.file_type
  if (typeof fileType !== 'string') {
    return { success: false, error: 'file_type is required and must be a string' }
  }

  const content = input.content
  if (typeof content !== 'string' || content.length === 0) {
    return { success: false, error: 'content is required and must be a non-empty string' }
  }

  // Content length limit (100KB)
  if (content.length > 100_000) {
    return { success: false, error: 'content exceeds maximum length of 100,000 characters' }
  }

  const fileName = typeof input.file_name === 'string' ? input.file_name : undefined
  const attributes = input.attributes as Record<string, unknown> | undefined

  // Validate file_name doesn't contain path traversal
  if (fileName && (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\'))) {
    return { success: false, error: 'file_name must not contain path separators or traversal sequences' }
  }

  // Build FileUpdateData from tool input (bridge to existing handler)
  const fileData: FileUpdateData = {
    fileType: fileType as FileUpdateData['fileType'],
    name: fileName,
    content,
    status: attributes?.status as FileUpdateData['status'],
    previewLine: typeof attributes?.preview_line === 'string' ? attributes.preview_line : undefined,
    attributes: attributes ? normalizeAttributes(attributes) : undefined,
  }

  // Resolve path to check permissions before writing
  const resolvedPath = resolveFileUpdatePath(fileData, context.timezone)
  if (!resolvedPath) {
    return { success: false, error: `Could not resolve file path for type="${fileType}" name="${fileName ?? ''}"` }
  }

  // Check session-scoped write permissions using effective type (active arc mode, not base session type)
  const effectiveType = context.activeMode ?? context.sessionType
  const allowedPrefixes = SESSION_WRITE_PERMISSIONS[effectiveType]
  if (!allowedPrefixes) {
    return { success: false, error: `Unknown session type "${effectiveType}" — write denied` }
  }
  const isPermitted = allowedPrefixes.some((prefix) => resolvedPath.startsWith(prefix) || resolvedPath === prefix)
  if (!isPermitted) {
    return { success: false, error: `Write to ${resolvedPath} not permitted during ${effectiveType} session` }
  }

  // Execute the write (awaiting honestly — Supabase Storage writes are ~50-150ms)
  const ufs = new UserFileSystem(context.supabase, context.userId)
  const result = await handleFileUpdate(ufs, fileData, effectiveType, context.timezone)

  // Post-processing: mark captures as folded when close_day writes a daily log
  if (result.success && fileType === 'daily-log' && effectiveType === 'close_day') {
    await markCapturesFoldedForToolUse(ufs, context.timezone).catch((err) => {
      captureException(err, {
        tags: { tool: 'save_file', stage: 'post_processing' },
        extra: { sessionId: context.sessionId },
      })
    })
  }

  if (!result.success) {
    return { success: false, error: result.error ?? 'File write failed' }
  }

  return {
    success: true,
    data: { path: result.path, bytes: content.length },
  }
}

/**
 * Execute complete_session tool: mark session/arc complete, generate summary.
 */
async function executeCompleteSession(
  input: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolResult> {
  const completionType = input.type
  if (completionType !== 'session' && completionType !== 'arc') {
    return { success: false, error: 'type must be "session" or "arc"' }
  }

  // Check current session status (institutional learning: CHECK constraint)
  const { data: session } = await context.supabase
    .from('sessions')
    .select('status')
    .eq('id', context.sessionId)
    .single()

  if (!session) {
    return { success: false, error: 'Session not found' }
  }

  if (session.status !== 'active') {
    return {
      success: false,
      error: `session_${session.status}`,
      data: { message: `Session is ${session.status}. Cannot complete.` },
    }
  }

  if (completionType === 'arc') {
    // Arc completed within open_conversation — return to base layer
    if (!context.activeMode) {
      return { success: false, error: 'No active arc to complete' }
    }

    const completedArcs: CompletedArc[] = Array.isArray(context.metadata.completed_arcs)
      ? context.metadata.completed_arcs as CompletedArc[]
      : []
    completedArcs.push({ mode: context.activeMode, completed_at: new Date().toISOString() })

    await context.supabase.from('sessions')
      .update({
        metadata: {
          ...context.metadata,
          active_mode: null,
          completed_arcs: completedArcs,
        },
      })
      .eq('id', context.sessionId)

    return {
      success: true,
      data: {
        completed_arc: context.activeMode,
        message: `${context.activeMode} arc completed. Returning to open conversation.`,
      },
    }
  }

  // Session completion
  await completeSession(context.supabase, context.sessionId)

  // Clean up pending_completion flag if it exists
  if (context.metadata.pending_completion) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { pending_completion: _, ...cleanMetadata } = context.metadata
    await context.supabase.from('sessions')
      .update({ metadata: cleanMetadata })
      .eq('id', context.sessionId)
  }

  // Note: summary generation is handled by the route after all text has been streamed.
  // Generating here would cause a double-call since the route also fires generateSessionSummary.

  return {
    success: true,
    data: {
      message: 'Session completed successfully.',
      next_checkin_due: addDaysIso(new Date(), 7),
    },
  }
}

/**
 * Execute enter_structured_arc tool: transition into a structured arc.
 */
async function executeEnterStructuredArc(
  input: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolResult> {
  const arcType = input.arc_type
  const VALID_ARC_TYPES: readonly string[] = ['open_day', 'close_day', 'weekly_checkin', 'life_mapping']

  if (typeof arcType !== 'string' || !VALID_ARC_TYPES.includes(arcType)) {
    return { success: false, error: `Invalid arc_type: ${arcType}. Must be one of: ${VALID_ARC_TYPES.join(', ')}` }
  }

  if (context.sessionType !== 'open_conversation') {
    return { success: false, error: 'Can only enter structured arcs from open_conversation sessions' }
  }

  if (context.activeMode) {
    return { success: false, error: `Already in structured arc: ${context.activeMode}. Complete it first.` }
  }

  await context.supabase.from('sessions')
    .update({
      metadata: { ...context.metadata, active_mode: arcType },
    })
    .eq('id', context.sessionId)

  return {
    success: true,
    data: {
      arc_type: arcType,
      message: `Entered ${arcType} arc.`,
    },
  }
}

/**
 * Normalize tool input attributes to the string Record format expected by FileUpdateData.
 */
function normalizeAttributes(attrs: Record<string, unknown>): Record<string, string> {
  const normalized: Record<string, string> = {}
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null) continue
    if (Array.isArray(value)) {
      normalized[key] = value.join(', ')
    } else {
      normalized[key] = String(value)
    }
  }
  return normalized
}
