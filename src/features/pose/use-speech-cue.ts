'use client'

import { useCallback, useRef } from 'react'

export type SpeechCueOptions = {
  rate?: number
  pitch?: number
}

export function useSpeechCue(debounceMs = 5000) {
  const lastSpokenRef = useRef<Map<string, number>>(new Map())
  const synthRef = useRef<SpeechSynthesis | null>(
    typeof window !== 'undefined' ? window.speechSynthesis : null
  )

  const speakCue = useCallback(
    (text: string, voiceEnabled: boolean, options: SpeechCueOptions = {}) => {
      if (!voiceEnabled) return
      if (!synthRef.current) return

      const now = Date.now()
      const lastTime = lastSpokenRef.current.get(text) ?? 0
      if (now - lastTime < debounceMs) return

      lastSpokenRef.current.set(text, now)

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = options.rate ?? 1.0
      utterance.pitch = options.pitch ?? 1.0
      utterance.volume = 1.0
      synthRef.current.speak(utterance)
    },
    [debounceMs]
  )

  const cancelCue = useCallback(() => {
    synthRef.current?.cancel()
  }, [])

  const resetCues = useCallback(() => {
    lastSpokenRef.current.clear()
    synthRef.current?.cancel()
  }, [])

  return { speakCue, cancelCue, resetCues }
}
