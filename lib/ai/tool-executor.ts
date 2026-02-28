import type { SupabaseClient } from '@supabase/supabase-js'
import {
  handleFileUpdate,
  resolveFileUpdatePath,
  markCapturesFoldedForToolUse,
} from '@/lib/markdown/file-write-handler'
import { UserFileSystem } from '@/lib/markdown/user-file-system'
import { FILE_TYPES, SESSION_WRITE_PERMISSIONS } from '@/lib/markdown/constants'
import type { FileType } from '@/lib/markdown/constants'
import { completeSession } from '@/lib/supabase/sessions'
import { getOrCreateTodayDayPlan, updateDayPlan } from '@/lib/supabase/day-plan-queries'
import { captureException } from '@/lib/monitoring/sentry'
import { addDaysIso } from '@/lib/utils'
import type { FileUpdateData, SessionType, StructuredArcType, CompletedArc, SessionMetadata } from '@/types/chat'
import type { EnergyLevel } from '@/types/day-plan'

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
  /** Mutable counter tracking tool calls within this request. Passed by reference via object wrapper. */
  toolCallCount: { value: number }
}

export interface ToolResult {
  success: boolean
  data?: Record<string, unknown>
  error?: string
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
  // Rate limit: max tool calls per request (counter lives in context, not module scope)
  context.toolCallCount.value++
  if (context.toolCallCount.value > MAX_TOOL_CALLS_PER_REQUEST) {
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

  // Validate file_type against allowed set
  const validFileTypes = Object.values(FILE_TYPES) as string[]
  if (!validFileTypes.includes(fileType)) {
    return { success: false, error: `Invalid file_type: "${fileType}". Must be one of: ${validFileTypes.join(', ')}` }
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

  // Validate attributes is an object if provided
  const attributes = (input.attributes !== null && typeof input.attributes === 'object' && !Array.isArray(input.attributes))
    ? input.attributes as Record<string, unknown>
    : undefined

  // Validate file_name doesn't contain path traversal
  if (fileName && (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\'))) {
    return { success: false, error: 'file_name must not contain path separators or traversal sequences' }
  }

  // Validate file_name is a YYYY-MM-DD date for date-based file types
  const DATE_FILE_TYPES = ['daily-log', 'day-plan', 'check-in']
  if (fileName && DATE_FILE_TYPES.includes(fileType)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fileName)) {
      return { success: false, error: `file_name must be a YYYY-MM-DD date for ${fileType} file type` }
    }
  }

  // Validate status against domain status enum if provided
  const VALID_DOMAIN_STATUSES = ['thriving', 'stable', 'needs_attention', 'in_crisis'] as const
  const rawStatus = attributes?.status
  const validatedStatus = (typeof rawStatus === 'string' && (VALID_DOMAIN_STATUSES as readonly string[]).includes(rawStatus))
    ? rawStatus as FileUpdateData['status']
    : undefined

  // Build FileUpdateData from tool input (bridge to existing handler)
  const fileData: FileUpdateData = {
    fileType: fileType as FileType,
    name: fileName,
    content,
    status: validatedStatus,
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

  // Post-processing: dual-write day plan data to Postgres for the Day page.
  // Storage write (above) saves the markdown narrative; this writes structured fields
  // so the Day Plan page can display intention, energy, session linkage.
  if (result.success && fileType === 'day-plan') {
    await writeDayPlanToPostgres(attributes, context).catch((err) => {
      captureException(err, {
        tags: { tool: 'save_file', stage: 'day_plan_postgres_write' },
        extra: { sessionId: context.sessionId },
      })
    })
  }

  // Post-processing: dual-write evening journal data to Postgres for the Day page.
  // Same pattern as day-plan dual-write: Storage holds the markdown, Postgres holds structured fields.
  if (result.success && fileType === 'daily-log') {
    await writeJournalToPostgres(content, attributes, context).catch((err: unknown) => {
      captureException(err, {
        tags: { tool: 'save_file', stage: 'journal_postgres_write' },
        extra: { sessionId: context.sessionId },
      })
    })
  }

  if (!result.success) {
    return { success: false, error: result.error ?? 'File write failed' }
  }

  // Include domainUpdate data when a domain file has updated_rating —
  // the route emits this as an SSE event so the client can update the spider chart live.
  const responseData: Record<string, unknown> = { path: result.path, bytes: content.length }
  if (fileType === 'domain' && attributes?.updated_rating && fileData.name) {
    const rating = Math.round(Number(attributes.updated_rating))
    if (rating >= 1 && rating <= 5) {
      responseData.domainUpdate = { domain: fileData.name, updatedRating: rating }
    }
  }

  return {
    success: true,
    data: responseData,
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
  // Defense-in-depth: user_id filter alongside RLS (consistent with completeSession)
  const { data: session } = await context.supabase
    .from('sessions')
    .select('status')
    .eq('id', context.sessionId)
    .eq('user_id', context.userId)
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

    const existingArcs: CompletedArc[] = Array.isArray(context.metadata.completed_arcs)
      ? context.metadata.completed_arcs as CompletedArc[]
      : []
    const completedArcs = [...existingArcs, { mode: context.activeMode, completed_at: new Date().toISOString() }]

    await context.supabase.from('sessions')
      .update({
        metadata: {
          ...context.metadata,
          active_mode: null,
          completed_arcs: completedArcs,
        },
      })
      .eq('id', context.sessionId)
      .eq('user_id', context.userId)

    return {
      success: true,
      data: {
        completed_arc: context.activeMode,
        message: `${context.activeMode} arc completed. Returning to open conversation.`,
      },
    }
  }

  // Session completion (pass userId for defense-in-depth beyond RLS)
  await completeSession(context.supabase, context.sessionId, context.userId)

  // Clean up pending_completion flag if it exists
  if (context.metadata.pending_completion) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { pending_completion: _, ...cleanMetadata } = context.metadata
    await context.supabase.from('sessions')
      .update({ metadata: cleanMetadata })
      .eq('id', context.sessionId)
      .eq('user_id', context.userId)
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
    .eq('user_id', context.userId)

  return {
    success: true,
    data: {
      arc_type: arcType,
      message: `Entered ${arcType} arc.`,
    },
  }
}

const VALID_ENERGY_LEVELS: readonly string[] = ['fired_up', 'focused', 'neutral', 'low', 'stressed']

/**
 * Write structured day plan fields to Postgres day_plans table.
 * Called as post-processing after the Storage markdown write succeeds.
 * Failure here is non-fatal — logged to Sentry but does not fail the tool call.
 */
async function writeDayPlanToPostgres(
  attributes: Record<string, unknown> | undefined,
  context: ToolExecutionContext
): Promise<void> {
  const dayPlan = await getOrCreateTodayDayPlan(context.supabase, context.userId, context.timezone)

  const updateData: Record<string, unknown> = {
    morning_session_id: context.sessionId,
    morning_completed_at: new Date().toISOString(),
  }

  // Extract flat attributes that Claude passes via tool input
  const intention = attributes?.intention
  if (typeof intention === 'string' && intention.length > 0) {
    updateData.intention = intention
  }

  const energyLevel = attributes?.energy
  if (typeof energyLevel === 'string' && VALID_ENERGY_LEVELS.includes(energyLevel)) {
    updateData.energy_level = energyLevel as EnergyLevel
  }

  await updateDayPlan(context.supabase, context.userId, dayPlan.date, updateData)
}

/**
 * Write evening journal fields to Postgres day_plans table.
 * Called as post-processing after the Storage markdown write succeeds for daily-log files.
 * Failure here is non-fatal — logged to Sentry but does not fail the tool call.
 */
async function writeJournalToPostgres(
  content: string,
  attributes: Record<string, unknown> | undefined,
  context: ToolExecutionContext
): Promise<void> {
  const dayPlan = await getOrCreateTodayDayPlan(context.supabase, context.userId, context.timezone)

  // Extract first paragraph as summary (same logic as journal-card.tsx)
  const summaryLines = content.split('\n').filter((l) => l.trim() && !l.startsWith('#'))
  const summary = summaryLines[0]?.trim() ?? content.slice(0, 200)

  const updateData: Record<string, unknown> = {
    evening_session_id: context.sessionId,
    evening_completed_at: new Date().toISOString(),
    evening_reflection: {
      mood: typeof attributes?.mood_signal === 'string' ? attributes.mood_signal : null,
      energy: typeof attributes?.energy === 'string' ? attributes.energy : null,
      sage_synthesis: summary,
      went_well: [],
      carry_forward: [],
    },
  }

  await updateDayPlan(context.supabase, context.userId, dayPlan.date, updateData)
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
