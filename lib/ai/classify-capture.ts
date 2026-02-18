import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { UserFileSystem } from '@/lib/markdown/user-file-system'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface ClassificationResult {
  classification: 'thought' | 'task' | 'idea' | 'tension'
  tags: string[]
}

/**
 * Classify a capture using Claude Haiku. Fire-and-forget — failures are logged, not thrown.
 * After classification, writes results back to capture frontmatter.
 */
export async function classifyCapture(
  userId: string,
  captureFilename: string,
  captureText: string
): Promise<void> {
  try {
    const result = await callClassifier(captureText)
    if (!result) return

    const supabase = await createClient()
    const ufs = new UserFileSystem(supabase, userId)
    await ufs.updateCaptureFrontmatter(captureFilename, {
      classification: result.classification,
      auto_tags: result.tags,
    })
  } catch (error) {
    // Fire-and-forget: log but don't throw. Capture is already saved.
    console.error('[classify-capture] Classification failed:', error instanceof Error ? error.message : String(error))
  }
}

async function callClassifier(text: string): Promise<ClassificationResult | null> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: `Classify this quick capture into exactly one category and suggest 1-3 short tags.

Categories:
- thought: a reflection, observation, or feeling
- task: something to do or follow up on
- idea: a creative insight or possibility
- tension: a worry, conflict, or unresolved issue

Capture: "${text}"

Respond in this exact JSON format, nothing else:
{"classification": "thought", "tags": ["tag1", "tag2"]}`,
        },
      ],
    })

    const content = response.content[0]
    if (content?.type !== 'text') return null

    const parsed = JSON.parse(content.text.trim()) as { classification?: string; tags?: string[] }
    const validTypes = ['thought', 'task', 'idea', 'tension'] as const
    const classification = validTypes.includes(parsed.classification as typeof validTypes[number])
      ? (parsed.classification as ClassificationResult['classification'])
      : 'thought'

    const tags = Array.isArray(parsed.tags)
      ? parsed.tags.filter((t): t is string => typeof t === 'string').slice(0, 5)
      : []

    return { classification, tags }
  } catch (error) {
    console.warn('[classify-capture] Haiku call failed:', error instanceof Error ? error.message : String(error))
    return null
  }
}
