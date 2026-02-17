/**
 * Lightweight Sentry stub — logs errors to console.
 * Replace with `@sentry/nextjs` when you need real error tracking.
 */
export async function captureException(
  error: unknown,
  _context?: { tags?: Record<string, string>; extra?: Record<string, unknown> }
): Promise<void> {
  console.error('[Sentry stub]', error, _context)
}
