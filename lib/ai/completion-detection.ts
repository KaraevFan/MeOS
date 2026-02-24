import type { SessionType } from '@/types/chat'

export type CompletionSignal = 'complete' | 'pending_completion' | 'none'

/**
 * Detect terminal artifacts in the accumulated response text.
 * Returns a completion signal indicating whether the session should be completed.
 *
 * When activeMode is set (mid-transition within open_conversation), detection
 * uses the mode's rules instead of the base session type.
 */
export function detectTerminalArtifact(
  responseText: string,
  sessionType: SessionType,
  activeMode?: string | null
): CompletionSignal {
  const effectiveType = (activeMode as SessionType) ?? sessionType
  switch (effectiveType) {
    case 'open_day':
      if (
        responseText.includes('[FILE_UPDATE type="day-plan"') ||
        responseText.includes('[DAY_PLAN_DATA]')
      ) {
        return 'complete'
      }
      return 'none'

    case 'close_day':
      // Daily log emission = Phase A (pending), not yet complete.
      // Phase B completion is checked separately after the next request.
      if (responseText.includes('[FILE_UPDATE type="daily-log"')) {
        return 'pending_completion'
      }
      return 'none'

    case 'life_mapping':
      if (
        responseText.includes('[FILE_UPDATE type="overview"') ||
        responseText.includes('[LIFE_MAP_SYNTHESIS]')
      ) {
        return 'complete'
      }
      return 'none'

    case 'weekly_checkin':
      if (
        responseText.includes('[FILE_UPDATE type="check-in"') ||
        responseText.includes('[SESSION_SUMMARY]')
      ) {
        return 'complete'
      }
      return 'none'

    case 'open_conversation':
    case 'quick_capture':
      return 'none'

    default: {
      const _exhaustive: never = effectiveType
      return _exhaustive
    }
  }
}
