import type {
  ParsedMessage,
  ParsedSegment,
  StructuredBlock,
  DomainSummary,
  LifeMapSynthesis,
  SessionSummary,
  FileUpdateData,
  DomainStatus,
  DomainName,
  SuggestedRepliesData,
  InlineCardData,
  IntentionCardData,
  DayPlanDataBlock,
} from '@/types/chat'
import { FILE_TYPES } from '@/lib/markdown/constants'
import type { FileType } from '@/lib/markdown/constants'
import { z } from 'zod'

/** Zod schema for runtime validation of AI-generated [DAY_PLAN_DATA] JSON */
const DayPlanDataSchema = z.object({
  energy_level: z.enum(['fired_up', 'focused', 'neutral', 'low', 'stressed']).optional(),
  intention: z.string().optional(),
  priorities: z.array(z.object({
    rank: z.number(),
    text: z.string(),
    completed: z.boolean(),
  })).optional(),
  open_threads: z.array(z.object({
    text: z.string(),
    source_session_type: z.string().optional(),
    source_date: z.string().optional(),
    provenance_label: z.string().optional(),
    status: z.enum(['open', 'resolved']),
  })).optional(),
})

const VALID_FILE_TYPES: Set<string> = new Set(Object.values(FILE_TYPES))
const VALID_STATUSES: DomainStatus[] = ['thriving', 'stable', 'needs_attention', 'in_crisis']

// ============================================
// Legacy block tags (kept for backward compat rendering)
// ============================================

const LEGACY_BLOCK_TAGS = [
  { open: '[DOMAIN_SUMMARY]', close: '[/DOMAIN_SUMMARY]', type: 'domain_summary' as const },
  { open: '[LIFE_MAP_SYNTHESIS]', close: '[/LIFE_MAP_SYNTHESIS]', type: 'life_map_synthesis' as const },
  { open: '[SESSION_SUMMARY]', close: '[/SESSION_SUMMARY]', type: 'session_summary' as const },
]

// ============================================
// FILE_UPDATE block parsing
// ============================================

/**
 * Two-step FILE_UPDATE parsing: match the full tag, then extract key="value" pairs.
 * Order-independent — attributes can appear in any order.
 */
const FILE_UPDATE_TAG_REGEX = /\[FILE_UPDATE\s+([^\]]+)\]/
const FILE_UPDATE_CLOSE = '[/FILE_UPDATE]'
function parseFileUpdateAttributes(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  for (const m of attrString.matchAll(/(\w+)="([^"]*)"/g)) {
    attrs[m[1]] = m[2]
  }
  return attrs
}

/** [REFLECTION_PROMPT] block markers */
const REFLECTION_PROMPT_OPEN = '[REFLECTION_PROMPT]'
const REFLECTION_PROMPT_CLOSE = '[/REFLECTION_PROMPT]'

/** [SUGGESTED_REPLIES] block markers */
const SUGGESTED_REPLIES_OPEN = '[SUGGESTED_REPLIES]'
const SUGGESTED_REPLIES_CLOSE = '[/SUGGESTED_REPLIES]'

/** [INLINE_CARD] block markers */
const INLINE_CARD_TAG_REGEX = /\[INLINE_CARD\s+([^\]]+)\]/
const INLINE_CARD_CLOSE = '[/INLINE_CARD]'

/** [INTENTION_CARD] block markers */
const INTENTION_CARD_OPEN = '[INTENTION_CARD]'
const INTENTION_CARD_CLOSE = '[/INTENTION_CARD]'

/** [DAY_PLAN_DATA] block markers — structured JSON for Postgres writes */
const DAY_PLAN_DATA_OPEN = '[DAY_PLAN_DATA]'
const DAY_PLAN_DATA_CLOSE = '[/DAY_PLAN_DATA]'

function parseFileUpdateBlock(openTag: string, body: string): FileUpdateData | null {
  const tagMatch = openTag.match(FILE_UPDATE_TAG_REGEX)
  if (!tagMatch) return null

  const attrs = parseFileUpdateAttributes(tagMatch[1])
  const fileType = attrs['type']

  if (!fileType) return null

  // Reject unknown file types (prevents prompt injection of arbitrary types)
  if (!VALID_FILE_TYPES.has(fileType)) {
    console.warn(`[Parser] Rejected unknown FILE_UPDATE type: "${fileType}"`)
    return null
  }

  const name = attrs['name'] || undefined
  const previewLine = attrs['preview_line'] || undefined
  const statusRaw = attrs['status'] || undefined

  // Validate status if present
  let status: DomainStatus | undefined
  if (statusRaw) {
    if (VALID_STATUSES.includes(statusRaw as DomainStatus)) {
      status = statusRaw as DomainStatus
    } else {
      console.warn(
        `[Parser] Invalid FILE_UPDATE status "${statusRaw}" for type="${fileType}" name="${name ?? 'n/a'}" — ignoring status`
      )
    }
  }

  // Collect additional attributes (beyond type, name, preview_line, status)
  const knownKeys = new Set(['type', 'name', 'preview_line', 'status'])
  const extraAttrs: Record<string, string> = {}
  for (const [key, value] of Object.entries(attrs)) {
    if (!knownKeys.has(key)) {
      extraAttrs[key] = value
    }
  }

  return {
    fileType: fileType as FileType,
    name,
    content: body.trim(),
    ...(previewLine ? { previewLine } : {}),
    ...(status ? { status } : {}),
    ...(Object.keys(extraAttrs).length > 0 ? { attributes: extraAttrs } : {}),
  }
}

// ============================================
// Legacy block parsing (unchanged)
// ============================================

function parseKeyValueLines(content: string): Record<string, string> {
  const result: Record<string, string> = {}
  const lines = content.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const colonIndex = trimmed.indexOf(':')
    if (colonIndex === -1) continue

    const key = trimmed.slice(0, colonIndex).trim()
    const value = trimmed.slice(colonIndex + 1).trim()
    result[key] = value
  }

  return result
}

function parseCommaSeparated(value: string | undefined): string[] {
  if (!value) return []
  return value.split(',').map((s) => s.trim()).filter(Boolean)
}

function parseDomainSummary(fields: Record<string, string>): DomainSummary {
  const statusRaw = (fields['Status'] || '').toLowerCase().trim()
  const status: DomainStatus = VALID_STATUSES.includes(statusRaw as DomainStatus)
    ? (statusRaw as DomainStatus)
    : 'stable'

  return {
    domain: (fields['Domain'] || '') as DomainName,
    currentState: fields['Current state'] || '',
    whatsWorking: parseCommaSeparated(fields["What's working"]),
    whatsNotWorking: parseCommaSeparated(fields["What's not working"]),
    keyTension: fields['Key tension'] || '',
    statedIntention: fields['Stated intention'] || '',
    status,
  }
}

function parseLifeMapSynthesis(fields: Record<string, string>): LifeMapSynthesis {
  return {
    narrative: fields['Narrative'] || '',
    primaryCompoundingEngine: fields['Primary compounding engine'] || '',
    quarterlyPriorities: parseCommaSeparated(fields['Quarterly priorities']),
    keyTensions: parseCommaSeparated(fields['Key tensions']),
    antiGoals: parseCommaSeparated(fields['Anti-goals']),
  }
}

function parseSessionSummaryData(fields: Record<string, string>): SessionSummary {
  const energyRaw = fields['Energy level']
  const energyLevel = energyRaw ? parseInt(energyRaw, 10) : null

  return {
    date: fields['Date'] || '',
    sentiment: fields['Sentiment'] || '',
    energyLevel: energyLevel && !isNaN(energyLevel) ? energyLevel : null,
    keyThemes: parseCommaSeparated(fields['Key themes']),
    commitments: parseCommaSeparated(fields['Commitments']),
    lifeMapUpdates: fields['Life map updates'] || '',
    patternsObserved: fields['Patterns observed'] || '',
  }
}

function parseLegacyBlockContent(type: 'domain_summary' | 'life_map_synthesis' | 'session_summary', content: string): StructuredBlock {
  const fields = parseKeyValueLines(content)

  switch (type) {
    case 'domain_summary':
      return { type, data: parseDomainSummary(fields) }
    case 'life_map_synthesis':
      return { type, data: parseLifeMapSynthesis(fields) }
    case 'session_summary':
      return { type, data: parseSessionSummaryData(fields) }
  }
}

// ============================================
// Main parser
// ============================================

/**
 * Parse a complete message into an array of segments (text and structured blocks).
 * Handles both new [FILE_UPDATE] blocks and legacy [DOMAIN_SUMMARY] etc. blocks.
 * Malformed blocks (no closing tag) fall back to text.
 */
export function parseMessage(content: string): ParsedMessage {
  const segments: ParsedSegment[] = []
  let remaining = content

  while (remaining.length > 0) {
    // Find the earliest opening tag
    let earliestOpen = -1
    let matchType: 'file_update' | 'reflection_prompt' | 'suggested_replies' | 'inline_card' | 'intention_card' | 'day_plan_data' | 'legacy' = 'legacy'
    let matchedLegacyTag: (typeof LEGACY_BLOCK_TAGS)[number] | null = null
    let fileUpdateOpenMatch: RegExpExecArray | null = null
    let inlineCardOpenMatch: RegExpExecArray | null = null

    // Check for [FILE_UPDATE ...] opening tag
    const fuMatch = FILE_UPDATE_TAG_REGEX.exec(remaining)
    if (fuMatch && fuMatch.index !== undefined) {
      const fuIdx = remaining.indexOf(fuMatch[0])
      if (fuIdx !== -1) {
        earliestOpen = fuIdx
        matchType = 'file_update'
        fileUpdateOpenMatch = fuMatch
      }
    }

    // Check for [REFLECTION_PROMPT] tag
    const rpIdx = remaining.indexOf(REFLECTION_PROMPT_OPEN)
    if (rpIdx !== -1 && (earliestOpen === -1 || rpIdx < earliestOpen)) {
      earliestOpen = rpIdx
      matchType = 'reflection_prompt'
      fileUpdateOpenMatch = null
      matchedLegacyTag = null
    }

    // Check for [SUGGESTED_REPLIES] tag
    const srIdx = remaining.indexOf(SUGGESTED_REPLIES_OPEN)
    if (srIdx !== -1 && (earliestOpen === -1 || srIdx < earliestOpen)) {
      earliestOpen = srIdx
      matchType = 'suggested_replies'
      fileUpdateOpenMatch = null
      matchedLegacyTag = null
    }

    // Check for [INLINE_CARD ...] tag
    const icMatch = INLINE_CARD_TAG_REGEX.exec(remaining)
    if (icMatch && icMatch.index !== undefined) {
      const icIdx = remaining.indexOf(icMatch[0])
      if (icIdx !== -1 && (earliestOpen === -1 || icIdx < earliestOpen)) {
        earliestOpen = icIdx
        matchType = 'inline_card'
        inlineCardOpenMatch = icMatch
        fileUpdateOpenMatch = null
        matchedLegacyTag = null
      }
    }

    // Check for [INTENTION_CARD] tag
    const intentIdx = remaining.indexOf(INTENTION_CARD_OPEN)
    if (intentIdx !== -1 && (earliestOpen === -1 || intentIdx < earliestOpen)) {
      earliestOpen = intentIdx
      matchType = 'intention_card'
      fileUpdateOpenMatch = null
      matchedLegacyTag = null
      inlineCardOpenMatch = null
    }

    // Check for [DAY_PLAN_DATA] tag
    const dpdIdx = remaining.indexOf(DAY_PLAN_DATA_OPEN)
    if (dpdIdx !== -1 && (earliestOpen === -1 || dpdIdx < earliestOpen)) {
      earliestOpen = dpdIdx
      matchType = 'day_plan_data'
      fileUpdateOpenMatch = null
      matchedLegacyTag = null
      inlineCardOpenMatch = null
    }

    // Check legacy tags
    for (const tag of LEGACY_BLOCK_TAGS) {
      const idx = remaining.indexOf(tag.open)
      if (idx !== -1 && (earliestOpen === -1 || idx < earliestOpen)) {
        earliestOpen = idx
        matchType = 'legacy'
        matchedLegacyTag = tag
        fileUpdateOpenMatch = null
        inlineCardOpenMatch = null
      }
    }

    if (earliestOpen === -1) {
      // No more blocks — rest is text
      const text = remaining.trim()
      if (text) {
        segments.push({ type: 'text', content: text })
      }
      break
    }

    if (matchType === 'file_update' && fileUpdateOpenMatch) {
      // Parse FILE_UPDATE block
      const openTagFull = fileUpdateOpenMatch[0]
      const closeIndex = remaining.indexOf(FILE_UPDATE_CLOSE, earliestOpen + openTagFull.length)

      if (closeIndex === -1) {
        // Malformed — no closing tag, treat rest as text
        const text = remaining.trim()
        if (text) {
          segments.push({ type: 'text', content: text })
        }
        break
      }

      // Add text before the block
      const textBefore = remaining.slice(0, earliestOpen).trim()
      if (textBefore) {
        segments.push({ type: 'text', content: textBefore })
      }

      // Parse the block
      const blockBody = remaining.slice(earliestOpen + openTagFull.length, closeIndex)
      const fileUpdate = parseFileUpdateBlock(openTagFull, blockBody)

      if (fileUpdate) {
        segments.push({ type: 'block', blockType: 'file_update', data: fileUpdate })
      } else {
        // Failed to parse — treat as text
        segments.push({ type: 'text', content: remaining.slice(earliestOpen, closeIndex + FILE_UPDATE_CLOSE.length) })
      }

      remaining = remaining.slice(closeIndex + FILE_UPDATE_CLOSE.length)
    } else if (matchType === 'reflection_prompt') {
      // Parse [REFLECTION_PROMPT] block
      const closeIndex = remaining.indexOf(REFLECTION_PROMPT_CLOSE, earliestOpen + REFLECTION_PROMPT_OPEN.length)
      if (closeIndex === -1) {
        const text = remaining.trim()
        if (text) {
          segments.push({ type: 'text', content: text })
        }
        break
      }

      const textBefore = remaining.slice(0, earliestOpen).trim()
      if (textBefore) {
        segments.push({ type: 'text', content: textBefore })
      }

      const blockContent = remaining.slice(earliestOpen + REFLECTION_PROMPT_OPEN.length, closeIndex).trim()
      segments.push({ type: 'block', blockType: 'reflection_prompt', data: { content: blockContent } })

      remaining = remaining.slice(closeIndex + REFLECTION_PROMPT_CLOSE.length)
    } else if (matchType === 'suggested_replies') {
      // Parse [SUGGESTED_REPLIES] block
      const closeIndex = remaining.indexOf(SUGGESTED_REPLIES_CLOSE, earliestOpen + SUGGESTED_REPLIES_OPEN.length)
      if (closeIndex === -1) {
        const text = remaining.trim()
        if (text) segments.push({ type: 'text', content: text })
        break
      }

      const textBefore = remaining.slice(0, earliestOpen).trim()
      if (textBefore) segments.push({ type: 'text', content: textBefore })

      const blockContent = remaining.slice(earliestOpen + SUGGESTED_REPLIES_OPEN.length, closeIndex).trim()
      const replies = blockContent.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 3)
      if (replies.length > 0) {
        segments.push({ type: 'block', blockType: 'suggested_replies', data: { replies } satisfies SuggestedRepliesData })
      }

      remaining = remaining.slice(closeIndex + SUGGESTED_REPLIES_CLOSE.length)
    } else if (matchType === 'inline_card' && inlineCardOpenMatch) {
      // Parse [INLINE_CARD type="..."] block
      const openTagFull = inlineCardOpenMatch[0]
      const closeIndex = remaining.indexOf(INLINE_CARD_CLOSE, earliestOpen + openTagFull.length)
      if (closeIndex === -1) {
        const text = remaining.trim()
        if (text) segments.push({ type: 'text', content: text })
        break
      }

      const textBefore = remaining.slice(0, earliestOpen).trim()
      if (textBefore) segments.push({ type: 'text', content: textBefore })

      const attrs = parseFileUpdateAttributes(inlineCardOpenMatch[1])
      const cardType = attrs['type']
      if (cardType === 'calendar') {
        const blockContent = remaining.slice(earliestOpen + openTagFull.length, closeIndex).trim()
        const items = blockContent.split('\n').map((l) => l.trim()).filter(Boolean)
        segments.push({ type: 'block', blockType: 'inline_card', data: { cardType: 'calendar', items } satisfies InlineCardData })
      }

      remaining = remaining.slice(closeIndex + INLINE_CARD_CLOSE.length)
    } else if (matchType === 'intention_card') {
      // Parse [INTENTION_CARD] block
      const closeIndex = remaining.indexOf(INTENTION_CARD_CLOSE, earliestOpen + INTENTION_CARD_OPEN.length)
      if (closeIndex === -1) {
        const text = remaining.trim()
        if (text) segments.push({ type: 'text', content: text })
        break
      }

      const textBefore = remaining.slice(0, earliestOpen).trim()
      if (textBefore) segments.push({ type: 'text', content: textBefore })

      const intention = remaining.slice(earliestOpen + INTENTION_CARD_OPEN.length, closeIndex).trim()
      if (intention) {
        segments.push({ type: 'block', blockType: 'intention_card', data: { intention } satisfies IntentionCardData })
      }

      remaining = remaining.slice(closeIndex + INTENTION_CARD_CLOSE.length)
    } else if (matchType === 'day_plan_data') {
      // Parse [DAY_PLAN_DATA] block — JSON payload for Postgres writes (not rendered in UI)
      const closeIndex = remaining.indexOf(DAY_PLAN_DATA_CLOSE, earliestOpen + DAY_PLAN_DATA_OPEN.length)
      if (closeIndex === -1) {
        const text = remaining.trim()
        if (text) segments.push({ type: 'text', content: text })
        break
      }

      const textBefore = remaining.slice(0, earliestOpen).trim()
      if (textBefore) segments.push({ type: 'text', content: textBefore })

      const jsonStr = remaining.slice(earliestOpen + DAY_PLAN_DATA_OPEN.length, closeIndex).trim()
      try {
        const raw = JSON.parse(jsonStr)
        const result = DayPlanDataSchema.safeParse(raw)
        if (result.success) {
          segments.push({ type: 'block', blockType: 'day_plan_data', data: result.data as DayPlanDataBlock })
        } else {
          console.warn('[Parser] DAY_PLAN_DATA failed validation:', result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', '))
        }
      } catch {
        console.warn('[Parser] Failed to parse DAY_PLAN_DATA JSON:', jsonStr.slice(0, 100))
      }

      remaining = remaining.slice(closeIndex + DAY_PLAN_DATA_CLOSE.length)
    } else if (matchType === 'legacy' && matchedLegacyTag) {
      // Parse legacy block
      const closeIndex = remaining.indexOf(matchedLegacyTag.close, earliestOpen + matchedLegacyTag.open.length)
      if (closeIndex === -1) {
        const text = remaining.trim()
        if (text) {
          segments.push({ type: 'text', content: text })
        }
        break
      }

      const textBefore = remaining.slice(0, earliestOpen).trim()
      if (textBefore) {
        segments.push({ type: 'text', content: textBefore })
      }

      const blockContent = remaining.slice(earliestOpen + matchedLegacyTag.open.length, closeIndex)
      const block = parseLegacyBlockContent(matchedLegacyTag.type, blockContent)
      segments.push({ type: 'block', blockType: block.type, data: block.data } as ParsedSegment)

      remaining = remaining.slice(closeIndex + matchedLegacyTag.close.length)
    } else {
      // No match found, treat everything as text
      const text = remaining.trim()
      if (text) {
        segments.push({ type: 'text', content: text })
      }
      break
    }
  }

  if (segments.length === 0) {
    return { segments: [{ type: 'text', content }] }
  }

  return { segments }
}

// ============================================
// Streaming parser
// ============================================

export function parseStreamingChunk(accumulated: string): {
  displayText: string
  pendingBlock: boolean
  completedBlock: StructuredBlock | null
} {
  // Check for FILE_UPDATE blocks first
  const fuMatch = FILE_UPDATE_TAG_REGEX.exec(accumulated)
  if (fuMatch) {
    const openIdx = accumulated.indexOf(fuMatch[0])
    const closeIdx = accumulated.indexOf(FILE_UPDATE_CLOSE, openIdx)

    if (closeIdx === -1) {
      return {
        displayText: accumulated.slice(0, openIdx).trim(),
        pendingBlock: true,
        completedBlock: null,
      }
    }

    const textBefore = accumulated.slice(0, openIdx).trim()
    const blockBody = accumulated.slice(openIdx + fuMatch[0].length, closeIdx)
    const fileUpdate = parseFileUpdateBlock(fuMatch[0], blockBody)

    if (fileUpdate) {
      return {
        displayText: textBefore,
        pendingBlock: false,
        completedBlock: { type: 'file_update', data: fileUpdate },
      }
    }
  }

  // Check [REFLECTION_PROMPT] block
  const rpOpenIdx = accumulated.indexOf(REFLECTION_PROMPT_OPEN)
  if (rpOpenIdx !== -1) {
    const rpCloseIdx = accumulated.indexOf(REFLECTION_PROMPT_CLOSE, rpOpenIdx)
    if (rpCloseIdx === -1) {
      return {
        displayText: accumulated.slice(0, rpOpenIdx).trim(),
        pendingBlock: true,
        completedBlock: null,
      }
    }

    const textBefore = accumulated.slice(0, rpOpenIdx).trim()
    const blockContent = accumulated.slice(rpOpenIdx + REFLECTION_PROMPT_OPEN.length, rpCloseIdx).trim()
    return {
      displayText: textBefore,
      pendingBlock: false,
      completedBlock: { type: 'reflection_prompt', data: { content: blockContent } },
    }
  }

  // Check [SUGGESTED_REPLIES] block
  const srOpenIdx = accumulated.indexOf(SUGGESTED_REPLIES_OPEN)
  if (srOpenIdx !== -1) {
    const srCloseIdx = accumulated.indexOf(SUGGESTED_REPLIES_CLOSE, srOpenIdx)
    if (srCloseIdx === -1) {
      return {
        displayText: accumulated.slice(0, srOpenIdx).trim(),
        pendingBlock: true,
        completedBlock: null,
      }
    }

    const textBefore = accumulated.slice(0, srOpenIdx).trim()
    const blockContent = accumulated.slice(srOpenIdx + SUGGESTED_REPLIES_OPEN.length, srCloseIdx).trim()
    const replies = blockContent.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 3)
    return {
      displayText: textBefore,
      pendingBlock: false,
      completedBlock: replies.length > 0 ? { type: 'suggested_replies', data: { replies } } : null,
    }
  }

  // Check [INLINE_CARD ...] block
  const icMatch = INLINE_CARD_TAG_REGEX.exec(accumulated)
  if (icMatch) {
    const icOpenIdx = accumulated.indexOf(icMatch[0])
    const icCloseIdx = accumulated.indexOf(INLINE_CARD_CLOSE, icOpenIdx)
    if (icCloseIdx === -1) {
      return {
        displayText: accumulated.slice(0, icOpenIdx).trim(),
        pendingBlock: true,
        completedBlock: null,
      }
    }

    const textBefore = accumulated.slice(0, icOpenIdx).trim()
    const attrs = parseFileUpdateAttributes(icMatch[1])
    const cardType = attrs['type']
    if (cardType === 'calendar') {
      const blockContent = accumulated.slice(icOpenIdx + icMatch[0].length, icCloseIdx).trim()
      const items = blockContent.split('\n').map((l) => l.trim()).filter(Boolean)
      return {
        displayText: textBefore,
        pendingBlock: false,
        completedBlock: { type: 'inline_card', data: { cardType: 'calendar', items } },
      }
    }
  }

  // Check [INTENTION_CARD] block
  const intentOpenIdx = accumulated.indexOf(INTENTION_CARD_OPEN)
  if (intentOpenIdx !== -1) {
    const intentCloseIdx = accumulated.indexOf(INTENTION_CARD_CLOSE, intentOpenIdx)
    if (intentCloseIdx === -1) {
      return {
        displayText: accumulated.slice(0, intentOpenIdx).trim(),
        pendingBlock: true,
        completedBlock: null,
      }
    }

    const textBefore = accumulated.slice(0, intentOpenIdx).trim()
    const intention = accumulated.slice(intentOpenIdx + INTENTION_CARD_OPEN.length, intentCloseIdx).trim()
    return {
      displayText: textBefore,
      pendingBlock: false,
      completedBlock: intention ? { type: 'intention_card', data: { intention } } : null,
    }
  }

  // Check [DAY_PLAN_DATA] block
  const dpdOpenIdx = accumulated.indexOf(DAY_PLAN_DATA_OPEN)
  if (dpdOpenIdx !== -1) {
    const dpdCloseIdx = accumulated.indexOf(DAY_PLAN_DATA_CLOSE, dpdOpenIdx)
    if (dpdCloseIdx === -1) {
      return {
        displayText: accumulated.slice(0, dpdOpenIdx).trim(),
        pendingBlock: true,
        completedBlock: null,
      }
    }

    const textBefore = accumulated.slice(0, dpdOpenIdx).trim()
    const jsonStr = accumulated.slice(dpdOpenIdx + DAY_PLAN_DATA_OPEN.length, dpdCloseIdx).trim()
    try {
      const raw = JSON.parse(jsonStr)
      const result = DayPlanDataSchema.safeParse(raw)
      if (result.success) {
        return {
          displayText: textBefore,
          pendingBlock: false,
          completedBlock: { type: 'day_plan_data', data: result.data as DayPlanDataBlock },
        }
      } else {
        console.warn('[Parser] Streaming DAY_PLAN_DATA failed validation:', result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', '))
      }
    } catch {
      // Malformed JSON — skip the block
    }
  }

  // Check legacy tags
  for (const tag of LEGACY_BLOCK_TAGS) {
    const openIndex = accumulated.indexOf(tag.open)
    if (openIndex === -1) continue

    const closeIndex = accumulated.indexOf(tag.close, openIndex)
    if (closeIndex === -1) {
      return {
        displayText: accumulated.slice(0, openIndex).trim(),
        pendingBlock: true,
        completedBlock: null,
      }
    }

    const textBefore = accumulated.slice(0, openIndex).trim()
    const blockContent = accumulated.slice(openIndex + tag.open.length, closeIndex)
    const block = parseLegacyBlockContent(tag.type, blockContent)

    return {
      displayText: textBefore,
      pendingBlock: false,
      completedBlock: block,
    }
  }

  return {
    displayText: accumulated,
    pendingBlock: false,
    completedBlock: null,
  }
}
