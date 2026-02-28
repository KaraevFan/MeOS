/**
 * Shared inline markdown rendering utilities.
 * Used by chat cards (journal, synthesis, insights panel) to render
 * markdown text as HTML without pulling in a full markdown library.
 *
 * Security: always call escapeHtml() BEFORE markdown replacement
 * to prevent XSS from user-controlled content.
 */

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Convert inline markdown to HTML.
 * Handles: **bold**, *italic*, # headers (stripped to styled divs),
 * and bullet lists (- item).
 *
 * Input MUST be pre-escaped via escapeHtml().
 */
export function renderInlineMarkdownToHtml(escapedText: string): string {
  return escapedText
    // Strip markdown headers → styled section labels
    .replace(/^#{1,3}\s+(.+)$/gm, '<div class="text-xs font-semibold uppercase tracking-wider text-text-secondary/70 mt-3 mb-1">$1</div>')
    // Bold
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    // Bullet lists
    .replace(/^-\s+(.+)$/gm, '<div class="flex items-start gap-1.5 ml-1"><span class="text-primary mt-0.5">&bull;</span><span>$1</span></div>')
}
