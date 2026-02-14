/**
 * Utilities for extracting structured data from markdown content.
 * Used by pages that need to convert markdown file content into typed shapes.
 */

/**
 * Extract a markdown section's content by heading text.
 * Returns the content between the matched heading and the next heading of equal or higher level.
 */
export function extractMarkdownSection(content: string, heading: string): string | null {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const headingRegex = new RegExp(`^#{1,3}\\s+${escaped}`, 'm')
  const match = content.match(headingRegex)
  if (!match || match.index === undefined) return null

  const afterHeading = content.slice(match.index + match[0].length)
  const nextHeading = afterHeading.search(/^#{1,3}\s/m)
  const sectionContent = nextHeading === -1 ? afterHeading : afterHeading.slice(0, nextHeading)
  return sectionContent.trim()
}

/**
 * Extract a bullet list from a markdown section.
 */
export function extractBulletList(content: string, heading: string): string[] {
  const section = extractMarkdownSection(content, heading)
  if (!section) return []
  return section
    .split('\n')
    .filter((line) => line.startsWith('- '))
    .map((line) => line.replace(/^-\s+/, '').trim())
}

// ============================================
// Commitment extraction (life-plan/current.md)
// ============================================

export type CommitmentStatus = 'not_started' | 'in_progress' | 'complete'
export type NextStepStatus = 'upcoming' | 'active' | 'done'

export interface NextStep {
  label: string
  status: NextStepStatus
}

export interface Commitment {
  label: string
  whyItMatters: string | null
  status: CommitmentStatus
  nextSteps: NextStep[]
}

/**
 * Extract structured commitments from the "Active Commitments" section of a life plan.
 * Parses the h2→h3→h4 hierarchy:
 *   ## Active Commitments
 *     ### Commitment Name
 *     **Why it matters:** ...
 *     **Status:** not_started
 *       #### Next Steps
 *       - [ ] Step text *(upcoming)*
 *       - [x] Done step *(done)*
 */
export function extractCommitments(content: string): Commitment[] {
  // 1. Extract the full "Active Commitments" section (h2 level)
  const section = extractMarkdownSection(content, 'Active Commitments')
  if (!section) return []

  // 2. Split on h3 headings to find individual commitments
  const commitmentBlocks = section.split(/^###\s+/m).filter((block) => block.trim())

  return commitmentBlocks.map((block) => {
    const lines = block.split('\n')
    const label = lines[0].trim()

    // 3. Parse **Why it matters:** — accept both ":**" and "**:" variants
    const whyMatch = block.match(/\*\*Why it matters[:\s]*\*\*[:\s]*(.+)/i)
    const whyItMatters = whyMatch ? whyMatch[1].trim() : null

    // 4. Parse **Status:** value
    const statusMatch = block.match(/\*\*Status[:\s]*\*\*[:\s]*(\S+)/i)
    const rawStatus = statusMatch ? statusMatch[1].trim() : 'not_started'
    const status = parseCommitmentStatus(rawStatus)

    // 5. Parse next steps (checkbox items after #### Next Steps)
    const nextStepsIdx = block.search(/^####\s+Next Steps/mi)
    const nextSteps: NextStep[] = []

    if (nextStepsIdx !== -1) {
      const stepsContent = block.slice(nextStepsIdx)
      const stepLines = stepsContent.split('\n').filter((line) => /^-\s+\[[ x]\]/.test(line.trim()))

      for (const line of stepLines) {
        const trimmed = line.trim()
        const checked = trimmed.startsWith('- [x]')
        const text = trimmed.replace(/^-\s+\[[ x]\]\s*/, '').trim()

        // Extract status annotation: *(upcoming)*, *(active)*, *(done)*
        const annotationMatch = text.match(/\*\((\w+)\)\*\s*$/)
        const annotation = annotationMatch ? annotationMatch[1] : null
        const cleanLabel = text.replace(/\s*\*\(\w+\)\*\s*$/, '').trim()

        let stepStatus: NextStepStatus
        if (checked || annotation === 'done') {
          stepStatus = 'done'
        } else if (annotation === 'active') {
          stepStatus = 'active'
        } else {
          stepStatus = 'upcoming'
        }

        nextSteps.push({ label: cleanLabel, status: stepStatus })
      }
    }

    return { label, whyItMatters, status, nextSteps }
  })
}

function parseCommitmentStatus(raw: string): CommitmentStatus {
  const normalized = raw.toLowerCase().trim()
  if (normalized === 'in_progress') return 'in_progress'
  if (normalized === 'complete' || normalized === 'completed') return 'complete'
  return 'not_started'
}
