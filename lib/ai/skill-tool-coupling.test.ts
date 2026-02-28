import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import {
  SAVE_FILE_TOOL,
  COMPLETE_SESSION_TOOL,
  ENTER_STRUCTURED_ARC_TOOL,
  SHOW_PULSE_CHECK_TOOL,
  SHOW_OPTIONS_TOOL,
} from './tool-definitions'

/** All tool names registered in the tool definitions module */
const KNOWN_TOOL_NAMES = new Set([
  SAVE_FILE_TOOL.name,
  COMPLETE_SESSION_TOOL.name,
  ENTER_STRUCTURED_ARC_TOOL.name,
  SHOW_PULSE_CHECK_TOOL.name,
  SHOW_OPTIONS_TOOL.name,
])

/**
 * Parse YAML frontmatter from a skill markdown file.
 * Returns the tools array from frontmatter, or empty array if missing.
 */
function parseSkillTools(filePath: string): string[] {
  const raw = readFileSync(filePath, 'utf-8')
  const frontmatterMatch = raw.match(/^---\n([\s\S]*?)\n---/)
  if (!frontmatterMatch) return []

  const toolsMatch = frontmatterMatch[1].match(/^tools:\s*\[([^\]]*)\]/m)
  if (!toolsMatch) return []

  return toolsMatch[1].split(',').map((s) => s.trim()).filter(Boolean)
}

describe('skill-tool coupling', () => {
  const skillsDir = join(process.cwd(), 'skills')
  const skillFiles = readdirSync(skillsDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => join(skillsDir, f))

  it('should find at least one skill file', () => {
    expect(skillFiles.length).toBeGreaterThan(0)
  })

  for (const filePath of skillFiles) {
    const filename = filePath.split('/').pop()!

    it(`${filename}: all frontmatter tools exist in tool definitions`, () => {
      const tools = parseSkillTools(filePath)
      for (const toolName of tools) {
        expect(
          KNOWN_TOOL_NAMES.has(toolName),
          `Skill "${filename}" references tool "${toolName}" which is not defined in tool-definitions.ts. Known tools: ${[...KNOWN_TOOL_NAMES].join(', ')}`
        ).toBe(true)
      }
    })

    it(`${filename}: all backtick-quoted tool references exist in tool definitions`, () => {
      const raw = readFileSync(filePath, 'utf-8')
      // Match `tool_name` patterns (backtick-quoted identifiers that look like tool names)
      const toolRefs = raw.matchAll(/`(save_file|complete_session|enter_structured_arc|show_pulse_check|show_options|[a-z_]+_(?:file|session|arc|check|options))`/g)
      for (const match of toolRefs) {
        const toolName = match[1]
        expect(
          KNOWN_TOOL_NAMES.has(toolName),
          `Skill "${filename}" references \`${toolName}\` in body text which is not defined in tool-definitions.ts`
        ).toBe(true)
      }
    })
  }
})
