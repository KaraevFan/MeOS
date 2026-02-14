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
} from '@/types/chat'
import { FILE_TYPES } from '@/lib/markdown/constants'

const VALID_FILE_TYPES: Set<string> = new Set(Object.values(FILE_TYPES))

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
 * Regex to match [FILE_UPDATE type="..." name="..."] opening tags.
 * type is required, name is optional (absent for singleton files like overview, life-plan).
 */
const FILE_UPDATE_OPEN_REGEX = /\[FILE_UPDATE\s+type="([^"]+)"(?:\s+name="([^"]*)")?\s*\]/
const FILE_UPDATE_CLOSE = '[/FILE_UPDATE]'

function parseFileUpdateBlock(openTag: string, body: string): FileUpdateData | null {
  const match = openTag.match(FILE_UPDATE_OPEN_REGEX)
  if (!match) return null

  const fileType = match[1]

  // Reject unknown file types (prevents prompt injection of arbitrary types)
  if (!VALID_FILE_TYPES.has(fileType)) {
    console.warn(`[Parser] Rejected unknown FILE_UPDATE type: "${fileType}"`)
    return null
  }

  const name = match[2] || undefined

  return {
    fileType,
    name,
    content: body.trim(),
  }
}

// ============================================
// Legacy block parsing (unchanged)
// ============================================

const VALID_STATUSES: DomainStatus[] = ['thriving', 'stable', 'needs_attention', 'in_crisis']

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
    // Find the earliest opening tag: check FILE_UPDATE first, then legacy
    let earliestOpen = -1
    let matchType: 'file_update' | 'legacy' = 'legacy'
    let matchedLegacyTag: (typeof LEGACY_BLOCK_TAGS)[number] | null = null
    let fileUpdateOpenMatch: RegExpExecArray | null = null

    // Check for [FILE_UPDATE ...] opening tag
    const fuMatch = FILE_UPDATE_OPEN_REGEX.exec(remaining)
    if (fuMatch && fuMatch.index !== undefined) {
      const fuIdx = remaining.indexOf(fuMatch[0])
      if (fuIdx !== -1) {
        earliestOpen = fuIdx
        matchType = 'file_update'
        fileUpdateOpenMatch = fuMatch
      }
    }

    // Check legacy tags
    for (const tag of LEGACY_BLOCK_TAGS) {
      const idx = remaining.indexOf(tag.open)
      if (idx !== -1 && (earliestOpen === -1 || idx < earliestOpen)) {
        earliestOpen = idx
        matchType = 'legacy'
        matchedLegacyTag = tag
        fileUpdateOpenMatch = null
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
  const fuMatch = FILE_UPDATE_OPEN_REGEX.exec(accumulated)
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
