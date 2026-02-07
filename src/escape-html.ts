/**
 * Escape raw HTML to prevent injection of active content.
 * Replaces &, <, >, ", and ' with their HTML entity equivalents.
 */
export function escapeHtml(text: string): string {
  const replacements: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (char) => replacements[char] ?? char);
}
