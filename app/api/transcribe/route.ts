import { createClient } from '@/lib/supabase/server'
import { captureException } from '@/lib/monitoring/sentry'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  // Validate auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const audioFile = formData.get('audio')

    if (!audioFile || !(audioFile instanceof Blob)) {
      captureException('Missing or invalid audio file in /api/transcribe', { tags: { route: '/api/transcribe' } })
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 })
    }

    // Determine file extension from the uploaded file name or MIME type
    const fileName = audioFile instanceof File ? audioFile.name : 'recording.webm'
    const ext = fileName.split('.').pop() || 'webm'
    const whisperFileName = `recording.${ext}`

    // Forward to OpenAI Whisper API
    const whisperFormData = new FormData()
    whisperFormData.append('file', audioFile, whisperFileName)
    whisperFormData.append('model', 'whisper-1')

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: whisperFormData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      captureException(`Whisper API error (${response.status})`, {
        tags: { route: '/api/transcribe', stage: 'openai_whisper' },
        extra: { status: response.status, errorText },
      })
      console.error(`Whisper API error (${response.status}):`, errorText)
      return NextResponse.json(
        { error: `Transcription failed (${response.status})` },
        { status: response.status >= 400 && response.status < 500 ? 400 : 500 }
      )
    }

    const result = await response.json()
    if (!result.text || !result.text.trim()) {
      return NextResponse.json({ text: '', empty: true })
    }
    return NextResponse.json({ text: result.text })
  } catch (error) {
    captureException(error, { tags: { route: '/api/transcribe', stage: 'handler' } })
    console.error('Transcription error:', error)
    return NextResponse.json(
      { error: 'Transcription failed' },
      { status: 500 }
    )
  }
}
