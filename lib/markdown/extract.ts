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
