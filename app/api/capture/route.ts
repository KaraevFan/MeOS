import { createClient } from '@/lib/supabase/server'
import { UserFileSystem } from '@/lib/markdown/user-file-system'
import { classifyCapture } from '@/lib/ai/classify-capture'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const CaptureRequestSchema = z.object({
  text: z.string().min(1).max(2000),
  inputMode: z.enum(['text', 'voice']),
})

/**
 * POST /api/capture — Save a quick capture to the user's file system.
 * Quick captures are direct writes, not chat sessions.
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

    const ufs = new UserFileSystem(supabase, user.id)
    const filename = await ufs.writeCapture(date, timestamp, text, {
      input_mode: inputMode,
      timestamp: now.toISOString(),
    })

    // Fire-and-forget: classify capture asynchronously
    classifyCapture(user.id, filename, text).catch(() => {})

    return NextResponse.json({ filename, path: `captures/${filename}` })
  } catch (error) {
    console.error('[capture] Error:', error)
    return NextResponse.json({ error: 'Failed to save capture' }, { status: 500 })
  }
}
