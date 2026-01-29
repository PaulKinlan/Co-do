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
 *
 * ## Dynamic Per-Provider CSP
 *
 * The connect-src directive is set dynamically based on the user's selected
 * AI provider (stored in a cookie).  This ensures that at any point in time,
 * the browser can only connect to one provider's API domain -- not all of them.
 * See docs/models-csp-report.md for the full rationale.
 */

import { buildConnectSrc } from './providers.ts';

/**
 * CSP directives as a structured record.
 * Keys are directive names, values are the directive value (empty string
 * for boolean directives like upgrade-insecure-requests).
 *
 * Note: connect-src is set to 'self' only by default.  The server reads the
 * co-do-provider cookie and uses buildCspHeaderForProvider() to build a CSP
 * with the selected provider's API domain.
 */
export const cspDirectives: Record<string, string> = {
  'default-src': "'self'",
  'script-src': "'self'",
  // 'unsafe-inline' is required for Vite HMR in development.
  // In production, styles are in external CSS files so this could be
  // tightened - but it is kept here for compatibility.
  'style-src': "'self' 'unsafe-inline'",
  // Dynamic: set per-request based on the provider cookie.
  // Default to 'self' only (no external connections until provider is selected).
  'connect-src': "'self'",
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
    // Remove connect-src so it falls back to default-src 'self'.
    // This is the safest fallback when served without the dynamic CSP server.
    'connect-src': null,
    // Apply caller overrides on top
    ...overrides,
  });
}

/**
 * Build a CSP header string for a specific provider.
 *
 * Reads the provider ID (e.g. 'anthropic', 'openai', 'google') and builds
 * a CSP with connect-src restricted to only that provider's API domain.
 * If the provider ID is unknown or absent, connect-src defaults to 'self'
 * only (no external connections).
 *
 * @param providerId - The provider ID from the co-do-provider cookie.
 * @returns A semicolon-separated CSP header value.
 *
 * @example
 * // User selected Anthropic
 * buildCspHeaderForProvider('anthropic')
 * // → "... connect-src 'self' https://api.anthropic.com; ..."
 *
 * @example
 * // No provider selected (first visit)
 * buildCspHeaderForProvider(undefined)
 * // → "... connect-src 'self'; ..."
 */
export function buildCspHeaderForProvider(
  providerId: string | undefined,
): string {
  const connectSrc = buildConnectSrc(providerId);
  return buildCspHeader({ 'connect-src': connectSrc });
}
