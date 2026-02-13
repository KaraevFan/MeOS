import type {
  ParsedMessage,
  ParsedSegment,
  StructuredBlock,
  DomainSummary,
  LifeMapSynthesis,
  SessionSummary,
  DomainStatus,
  DomainName,
} from '@/types/chat'

const BLOCK_TAGS = [
  { open: '[DOMAIN_SUMMARY]', close: '[/DOMAIN_SUMMARY]', type: 'domain_summary' as const },
  { open: '[LIFE_MAP_SYNTHESIS]', close: '[/LIFE_MAP_SYNTHESIS]', type: 'life_map_synthesis' as const },
  { open: '[SESSION_SUMMARY]', close: '[/SESSION_SUMMARY]', type: 'session_summary' as const },
]

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

function parseBlockContent(type: 'domain_summary' | 'life_map_synthesis' | 'session_summary', content: string): StructuredBlock {
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

/**
 * Parse a complete message into an array of segments (text and structured blocks).
 * Handles 1, 2, 3+ blocks per message. Malformed blocks (no closing tag) fall back to text.
 */
export function parseMessage(content: string): ParsedMessage {
  const segments: ParsedSegment[] = []
  let remaining = content

  while (remaining.length > 0) {
    // Find the earliest opening tag in remaining text
    let earliestOpen = -1
    let matchedTag: (typeof BLOCK_TAGS)[number] | null = null

    for (const tag of BLOCK_TAGS) {
      const idx = remaining.indexOf(tag.open)
      if (idx !== -1 && (earliestOpen === -1 || idx < earliestOpen)) {
        earliestOpen = idx
        matchedTag = tag
      }
    }

    if (earliestOpen === -1 || !matchedTag) {
      // No more blocks — rest is text
      const text = remaining.trim()
      if (text) {
        segments.push({ type: 'text', content: text })
      }
      break
    }

    // Check for closing tag
    const closeIndex = remaining.indexOf(matchedTag.close, earliestOpen + matchedTag.open.length)
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
    const blockContent = remaining.slice(earliestOpen + matchedTag.open.length, closeIndex)
    const block = parseBlockContent(matchedTag.type, blockContent)
    segments.push({ type: 'block', blockType: block.type, data: block.data } as ParsedSegment)

    // Advance past this block
    remaining = remaining.slice(closeIndex + matchedTag.close.length)
  }

  // If no segments found, return the content as text
  if (segments.length === 0) {
    return { segments: [{ type: 'text', content }] }
  }

  return { segments }
}

export function parseStreamingChunk(accumulated: string): {
  displayText: string
  pendingBlock: boolean
  completedBlock: StructuredBlock | null
} {
  for (const tag of BLOCK_TAGS) {
    const openIndex = accumulated.indexOf(tag.open)
    if (openIndex === -1) continue

    const closeIndex = accumulated.indexOf(tag.close, openIndex)
    if (closeIndex === -1) {
      // Opening tag found but no closing tag yet — block is pending
      return {
        displayText: accumulated.slice(0, openIndex).trim(),
        pendingBlock: true,
        completedBlock: null,
      }
    }

    // Both tags found — block is complete
    const textBefore = accumulated.slice(0, openIndex).trim()
    const blockContent = accumulated.slice(openIndex + tag.open.length, closeIndex)
    const block = parseBlockContent(tag.type, blockContent)

    return {
      displayText: textBefore,
      pendingBlock: false,
      completedBlock: block,
    }
  }

  // No opening tag found
  return {
    displayText: accumulated,
    pendingBlock: false,
    completedBlock: null,
  }
}
