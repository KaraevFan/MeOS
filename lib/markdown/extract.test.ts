import { describe, it, expect } from 'vitest'
import { extractCommitments, extractMarkdownSection, extractBulletList } from './extract'

describe('extractMarkdownSection', () => {
  it('extracts a section by heading', () => {
    const content = `# Title\n## Active Commitments\nSome content here.\n## Next Section\nOther content.`
    const result = extractMarkdownSection(content, 'Active Commitments')
    expect(result).toBe('Some content here.')
  })

  it('returns null when heading not found', () => {
    const result = extractMarkdownSection('# Title\nSome text', 'Missing')
    expect(result).toBeNull()
  })

  it('captures everything to end of content if no following heading', () => {
    const content = `## Section\nLine 1\nLine 2`
    const result = extractMarkdownSection(content, 'Section')
    expect(result).toBe('Line 1\nLine 2')
  })
})

describe('extractBulletList', () => {
  it('extracts bullet items from a section', () => {
    const content = `## Priorities\n- First\n- Second\n- Third\n## Next`
    const result = extractBulletList(content, 'Priorities')
    expect(result).toEqual(['First', 'Second', 'Third'])
  })

  it('returns empty array when section missing', () => {
    const result = extractBulletList('## Other\nSome text', 'Priorities')
    expect(result).toEqual([])
  })

  it('ignores non-bullet lines', () => {
    const content = `## Items\nNot a bullet\n- Bullet one\nAlso not\n- Bullet two`
    const result = extractBulletList(content, 'Items')
    expect(result).toEqual(['Bullet one', 'Bullet two'])
  })
})

describe('extractCommitments', () => {
  const WELL_FORMED = `## Active Commitments

### Launch side project
**Why it matters:** Building toward financial independence.
**Status:** in_progress

#### Next Steps
- [x] Register domain *(done)*
- [ ] Build landing page *(active)*
- [ ] Set up analytics *(upcoming)*

### Daily exercise habit
**Why it matters:** Energy and mental clarity.
**Status:** not_started

#### Next Steps
- [ ] Buy running shoes *(active)*
- [ ] Plan weekly schedule *(upcoming)*`

  it('parses well-formed commitments', () => {
    const result = extractCommitments(WELL_FORMED)
    expect(result).toHaveLength(2)

    expect(result[0].label).toBe('Launch side project')
    expect(result[0].whyItMatters).toBe('Building toward financial independence.')
    expect(result[0].status).toBe('in_progress')
    expect(result[0].nextSteps).toHaveLength(3)
    expect(result[0].nextSteps[0]).toEqual({ label: 'Register domain', status: 'done' })
    expect(result[0].nextSteps[1]).toEqual({ label: 'Build landing page', status: 'active' })
    expect(result[0].nextSteps[2]).toEqual({ label: 'Set up analytics', status: 'upcoming' })

    expect(result[1].label).toBe('Daily exercise habit')
    expect(result[1].status).toBe('not_started')
    expect(result[1].nextSteps).toHaveLength(2)
  })

  it('returns empty array when "Active Commitments" section is missing', () => {
    const content = `## Quarter Theme\nSome theme\n## Boundaries\n- No X`
    const result = extractCommitments(content)
    expect(result).toEqual([])
  })

  it('returns empty array for empty "Active Commitments" section', () => {
    const content = `## Active Commitments\n\n## Next Section`
    const result = extractCommitments(content)
    expect(result).toEqual([])
  })

  it('handles missing "Why it matters" field', () => {
    const content = `## Active Commitments\n\n### Some commitment\n**Status:** in_progress\n\n#### Next Steps\n- [ ] Do thing *(active)*`
    const result = extractCommitments(content)
    expect(result).toHaveLength(1)
    expect(result[0].whyItMatters).toBeNull()
    expect(result[0].status).toBe('in_progress')
    expect(result[0].nextSteps).toHaveLength(1)
  })

  it('handles missing "Next Steps" section', () => {
    const content = `## Active Commitments\n\n### Some commitment\n**Why it matters:** Important.\n**Status:** complete`
    const result = extractCommitments(content)
    expect(result).toHaveLength(1)
    expect(result[0].nextSteps).toEqual([])
    expect(result[0].status).toBe('complete')
  })

  it('handles missing status (defaults to not_started)', () => {
    const content = `## Active Commitments\n\n### No status commitment\n**Why it matters:** Reasons.`
    const result = extractCommitments(content)
    expect(result).toHaveLength(1)
    expect(result[0].status).toBe('not_started')
  })

  it('normalizes "completed" to "complete"', () => {
    const content = `## Active Commitments\n\n### Done thing\n**Status:** completed`
    const result = extractCommitments(content)
    expect(result[0].status).toBe('complete')
  })

  it('handles unknown status values (defaults to not_started)', () => {
    const content = `## Active Commitments\n\n### Unknown status\n**Status:** paused`
    const result = extractCommitments(content)
    expect(result[0].status).toBe('not_started')
  })

  it('handles "Why it matters" with colon-inside-bold variant', () => {
    const content = `## Active Commitments\n\n### Variant\n**Why it matters**: Focus and clarity.\n**Status:** in_progress`
    const result = extractCommitments(content)
    expect(result[0].whyItMatters).toBe('Focus and clarity.')
  })

  it('treats checked checkboxes as done even without annotation', () => {
    const content = `## Active Commitments\n\n### Task\n**Status:** in_progress\n\n#### Next Steps\n- [x] Already done\n- [ ] Not yet`
    const result = extractCommitments(content)
    expect(result[0].nextSteps[0]).toEqual({ label: 'Already done', status: 'done' })
    expect(result[0].nextSteps[1]).toEqual({ label: 'Not yet', status: 'upcoming' })
  })

  it('handles extra whitespace in commitment blocks', () => {
    const content = `## Active Commitments\n\n###   Spaced out commitment  \n\n**Why it matters:**   Some reason.  \n**Status:**   in_progress  `
    const result = extractCommitments(content)
    expect(result).toHaveLength(1)
    expect(result[0].label).toBe('Spaced out commitment')
    expect(result[0].whyItMatters).toBe('Some reason.')
  })

  it('handles content with no h2 Active Commitments at all', () => {
    const content = `# Life Plan\n\nSome intro text.\n\n## Quarter Theme\nFocus on health.`
    const result = extractCommitments(content)
    expect(result).toEqual([])
  })
})
