import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import type { SessionType } from '@/types/chat'

export interface SkillConfig {
  prompt: string
  writePermissions: string[]
  readContext: string[]
  tools: string[]
  metadata: {
    duration?: string
    tone?: string
    sessionType: string
  }
}

/**
 * Load a skill definition from skills/{session-type}.md.
 * Returns null if the skill file doesn't exist (fallback to prompts.ts).
 *
 * Skill files use markdown with YAML frontmatter for structured config
 * and markdown body for the system prompt.
 */
export function loadSkill(sessionType: SessionType): SkillConfig | null {
  const filename = sessionType.replace(/_/g, '-')
  const skillPath = join(process.cwd(), 'skills', `${filename}.md`)

  if (!existsSync(skillPath)) return null

  const raw = readFileSync(skillPath, 'utf-8')

  // Parse YAML frontmatter
  const frontmatterMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!frontmatterMatch) return null

  const yamlStr = frontmatterMatch[1]
  const prompt = frontmatterMatch[2].trim()

  // Simple YAML parser for our known fields (avoids yaml dependency)
  const config = parseSimpleYaml(yamlStr)

  const asStringArray = (val: unknown): string[] => {
    if (Array.isArray(val)) return val.map(String)
    return []
  }

  return {
    prompt,
    writePermissions: asStringArray(config.write_paths),
    readContext: asStringArray(config.read_context),
    tools: asStringArray(config.tools),
    metadata: {
      duration: typeof config.duration === 'string' ? config.duration : undefined,
      tone: typeof config.tone === 'string' ? config.tone : undefined,
      sessionType: typeof config.session_type === 'string' ? config.session_type : sessionType,
    },
  }
}

/**
 * Minimal YAML parser for skill frontmatter fields.
 * Handles: scalar values, simple arrays (bracket syntax and dash syntax).
 */
function parseSimpleYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const lines = yaml.split('\n')
  let currentKey: string | null = null

  for (const line of lines) {
    // Skip empty lines and comments
    if (!line.trim() || line.trim().startsWith('#')) continue

    // Check for key-value pair
    const kvMatch = line.match(/^(\w[\w_]*)\s*:\s*(.*)$/)
    if (kvMatch) {
      const [, key, value] = kvMatch
      const trimmed = value.trim()

      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        // Bracket array: [item1, item2, item3]
        result[key] = trimmed
          .slice(1, -1)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
        currentKey = null
      } else if (trimmed === '') {
        // Start of dash-list
        currentKey = key
        result[key] = []
      } else {
        result[key] = trimmed
        currentKey = null
      }
      continue
    }

    // Dash list item
    const dashMatch = line.match(/^\s+-\s+(.+)$/)
    if (dashMatch && currentKey) {
      const arr = result[currentKey]
      if (Array.isArray(arr)) {
        arr.push(dashMatch[1].trim())
      }
    }
  }

  return result
}
