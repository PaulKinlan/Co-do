/**
 * Content Security Policy configuration for Co-do.
 *
 * Single source of truth for CSP directives, shared by:
 * - server/main.ts  (Deno Deploy production server - HTTP header)
 * - vite.config.ts   (Vite development server - HTTP header)
 * - index.html       (<meta> tag fallback - subset of directives)
 *
 * The full policy is delivered via HTTP header, which enables directives
 * that <meta> tags cannot enforce: frame-ancestors, worker-src, and
 * upgrade-insecure-requests.  The <meta> tag in index.html acts as a
 * baseline fallback when the page is served without the Deno server
 * (e.g. from a plain static file host).
 */

/**
 * CSP directives as a structured record.
 * Keys are directive names, values are the directive value (empty string
 * for boolean directives like upgrade-insecure-requests).
 */
export const cspDirectives: Record<string, string> = {
  'default-src': "'self'",
  'script-src': "'self'",
  // 'unsafe-inline' is required for Vite HMR in development.
  // In production, styles are in external CSS files so this could be
  // tightened - but it is kept here for compatibility.
  'style-src': "'self' 'unsafe-inline'",
  // AI provider API endpoints - WASM Workers inherit this CSP
  'connect-src': [
    "'self'",
    'https://api.anthropic.com',
    'https://api.openai.com',
    'https://generativelanguage.googleapis.com',
  ].join(' '),
  'img-src': "'self' data:",
  'font-src': "'self'",
  'object-src': "'none'",
  'base-uri': "'self'",
  'form-action': "'self'",
  // frame-ancestors is ignored in <meta> tags - HTTP header required
  'frame-ancestors': "'none'",
  // worker-src is ignored in <meta> tags - HTTP header required
  'worker-src': "'self'",
  // upgrade-insecure-requests is ignored in <meta> tags - HTTP header required
  'upgrade-insecure-requests': '',
};

/**
 * Build a CSP header string from the directives.
 *
 * @param overrides - Optional partial overrides to merge on top of the
 *   base directives. Pass a value of `null` to remove a directive.
 * @returns A semicolon-separated CSP header value.
 *
 * @example
 * // Default policy
 * buildCspHeader()
 *
 * @example
 * // Loosen connect-src for a local AI proxy
 * buildCspHeader({ 'connect-src': "'self' http://localhost:11434" })
 */
export function buildCspHeader(
  overrides?: Record<string, string | null>,
): string {
  const merged: Record<string, string> = { ...cspDirectives };

  if (overrides) {
    for (const [key, value] of Object.entries(overrides)) {
      if (value === null) {
        delete merged[key];
      } else {
        merged[key] = value;
      }
    }
  }

  return Object.entries(merged)
    .map(([key, value]) => (value ? `${key} ${value}` : key))
    .join('; ');
}

/**
 * Directives that are only effective in HTTP headers.
 * The CSP spec ignores these when delivered via a <meta> tag.
 */
const HTTP_ONLY_DIRECTIVES = new Set([
  'frame-ancestors',
  'report-uri',
  'report-to',
  'sandbox',
]);

/**
 * Build a CSP string suitable for a <meta http-equiv="Content-Security-Policy">
 * tag.  This strips directives that the spec ignores in meta tags so the
 * output is clean and predictable.
 *
 * Use this as the fallback CSP in index.html.  The full policy (including
 * frame-ancestors, worker-src, upgrade-insecure-requests) is delivered by
 * the Deno Deploy server via HTTP header.
 */
export function buildMetaTagCsp(
  overrides?: Record<string, string | null>,
): string {
  return buildCspHeader({
    // Remove HTTP-only directives
    ...Object.fromEntries(
      [...HTTP_ONLY_DIRECTIVES].map((d) => [d, null]),
    ),
    // Apply caller overrides on top
    ...overrides,
  });
}
