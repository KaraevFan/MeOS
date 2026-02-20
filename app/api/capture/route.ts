import { createClient } from '@/lib/supabase/server'
import { UserFileSystem } from '@/lib/markdown/user-file-system'
import { classifyCapture } from '@/lib/ai/classify-capture'
import { createCapture } from '@/lib/supabase/day-plan-queries'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const CaptureRequestSchema = z.object({
  text: z.string().min(1).max(2000),
  inputMode: z.enum(['text', 'voice']),
})

/**
 * POST /api/capture — Save a quick capture to both markdown Storage and Postgres.
 * Dual-write: markdown for Sage context, Postgres for Day Plan queryability.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as unknown
    const parsed = CaptureRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
    }

    const { text, inputMode } = parsed.data
    const now = new Date()
    const date = now.toLocaleDateString('en-CA') // YYYY-MM-DD in local time
    // HHmmss format — safe for filenames (no colons)
    const timestamp = now.toTimeString().slice(0, 8).replace(/:/g, '')

    // Write 1: Markdown file (existing pipeline — for Sage context)
    const ufs = new UserFileSystem(supabase, user.id)
    const filename = await ufs.writeCapture(date, timestamp, text, {
      input_mode: inputMode,
      timestamp: now.toISOString(),
    })

    // Write 2: Postgres captures table (new — for Day Plan queryability)
    let captureId: string | null = null
    try {
      const captureRow = await createCapture(supabase, user.id, {
        content: text,
        source: 'manual',
      })
      captureId = captureRow.id
    } catch (err) {
      // Non-fatal: markdown write succeeded, Postgres is supplementary
      console.error('[capture] Postgres write failed:', err)
    }

    // Fire-and-forget: classify capture asynchronously (updates both markdown + Postgres)
    classifyCapture(user.id, filename, text, captureId).catch(() => {})

    return NextResponse.json({ filename, path: `captures/${filename}`, captureId })
  } catch (error) {
    console.error('[capture] Error:', error)
    return NextResponse.json({ error: 'Failed to save capture' }, { status: 500 })
  }
}
