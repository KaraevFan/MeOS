'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

const MAX_RECORDING_SECONDS = 120

interface UseVoiceRecorderOptions {
  onAutoStop?: (blob: Blob) => void
}

export function useVoiceRecorder({ onAutoStop }: UseVoiceRecorderOptions = {}) {
  const [isRecording, setIsRecording] = useState(false)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isSupported, setIsSupported] = useState(true)
  const [mimeType, setMimeType] = useState<string>('audio/webm')

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const resolveRef = useRef<((blob: Blob) => void) | null>(null)
  const onAutoStopRef = useRef(onAutoStop)

  useEffect(() => { onAutoStopRef.current = onAutoStop }, [onAutoStop])

  useEffect(() => {
    if (typeof window !== 'undefined' && !navigator.mediaDevices?.getUserMedia) {
      setIsSupported(false)
    }
  }, [])

  const startRecording = useCallback(async () => {
    setError(null)
    chunksRef.current = []

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      // Prefer webm, fall back to whatever is supported
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : ''

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        })
        stream.getTracks().forEach((track) => track.stop())

        if (resolveRef.current) {
          resolveRef.current(blob)
          resolveRef.current = null
        } else if (onAutoStopRef.current) {
          // Auto-stop path: resolveRef was never set, deliver blob via callback
          onAutoStopRef.current(blob)
        }
      }

      mediaRecorderRef.current = recorder
      setMimeType(recorder.mimeType || 'audio/webm')
      recorder.start()
      setIsRecording(true)
      setDuration(0)

      // Start duration timer with auto-stop at max
      timerRef.current = setInterval(() => {
        setDuration((prev) => {
          if (prev + 1 >= MAX_RECORDING_SECONDS) {
            // Auto-stop at limit
            if (mediaRecorderRef.current?.state === 'recording') {
              mediaRecorderRef.current.stop()
              setIsRecording(false)
              if (timerRef.current) {
                clearInterval(timerRef.current)
                timerRef.current = null
              }
            }
          }
          return prev + 1
        })
      }, 1000)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setError('Microphone permission denied. Please allow access in your browser settings.')
      } else {
        setError('Could not start recording. Please check your microphone.')
      }
    }
  }, [])

  const stopRecording = useCallback((): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') {
        reject(new Error('Not recording'))
        return
      }

      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }

      resolveRef.current = resolve
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    })
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
    }
  }, [])

  return {
    isRecording,
    duration,
    error,
    isSupported,
    mimeType,
    startRecording,
    stopRecording,
  }
}
