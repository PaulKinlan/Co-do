/**
 * Co-do production server for Deno Deploy.
 *
 * Serves the pre-built static site from `dist/` and attaches security
 * headers (including CSP) to every response.
 *
 * ## Dynamic Per-Provider CSP
 *
 * The Content-Security-Policy header is built per-request based on the
 * `co-do-provider` cookie.  This restricts connect-src to only the user's
 * selected AI provider, rather than allowing all providers statically.
 * See docs/models-csp-report.md for the full rationale.
 *
 * Run locally:
 *   deno task serve
 *
 * Deploy:
 *   deployctl deploy --project=<name> server/main.ts
 */

import { buildCspHeaderForProvider, isWasmWorkerRequest } from './csp.ts';
import { parseCookies, PROVIDER_COOKIE_NAME } from './providers.ts';

const DIST = 'dist';

/** Security headers applied to every response (except CSP which is dynamic). */
const staticSecurityHeaders: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

/**
 * Determine the Cache-Control header for a given file path.
 *
 * CSP is built dynamically per-request (based on provider cookie and
 * request path), so CDN/shared caches must never serve a stale response.
 * We use `private` on every response to prevent CDN caching while still
 * allowing the user's browser to cache.
 *
 * - HTML pages: `private, no-cache` — always revalidate so the dynamic CSP
 *   is fresh on every navigation.
 * - Vite-hashed assets (`/assets/*`): `private, max-age=31536000, immutable`
 *   — the filename changes when content changes, so the browser can cache
 *   these forever without revalidating.
 * - Everything else (icons, manifest, etc.): `private, max-age=3600` — short
 *   browser cache with hourly refresh.
 */
function getCacheControl(filePath: string): string {
  if (filePath.endsWith('.html')) {
    return 'private, no-cache';
  }
  // Vite places hashed assets under dist/assets/
  if (filePath.startsWith(`${DIST}/assets/`)) {
    return 'private, max-age=31536000, immutable';
  }
  return 'private, max-age=3600';
}

/** Map file extensions to MIME types. */
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.webp': 'image/webp',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain',
  '.xml': 'text/xml',
  '.zip': 'application/zip',
  '.map': 'application/json',
};

function getContentType(path: string): string {
  const ext = path.substring(path.lastIndexOf('.'));
  return MIME_TYPES[ext] ?? 'application/octet-stream';
}

/**
 * Build a Response with security headers baked in from the start.
 *
 * @param body - Response body
 * @param status - HTTP status code
 * @param cspHeader - The CSP header value (built per-request based on cookie)
 * @param extraHeaders - Additional headers to set (e.g. Content-Type)
 */
function respond(
  body: BodyInit | null,
  status: number,
  cspHeader: string,
  extraHeaders?: Record<string, string>,
): Response {
  const headers = new Headers({
    ...staticSecurityHeaders,
    'Content-Security-Policy': cspHeader,
  });
  if (extraHeaders) {
    for (const [k, v] of Object.entries(extraHeaders)) {
      headers.set(k, v);
    }
  }
  return new Response(body, { status, headers });
}

Deno.serve(async (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  let pathname = decodeURIComponent(url.pathname);

  // Read the provider cookie to build a per-request CSP.
  // If no cookie or unknown provider, CSP defaults to connect-src 'self' only.
  // Worker scripts get 'wasm-unsafe-eval' added to script-src so they can
  // compile WebAssembly modules (CSP Level 3: workers use their own response CSP).
  const cookies = parseCookies(request.headers.get('cookie'));
  const providerId = cookies[PROVIDER_COOKIE_NAME];
  const isWorker = isWasmWorkerRequest(pathname);
  const cspHeader = buildCspHeaderForProvider(providerId, isWorker);

  // Log every request's CSP decision (visible in Deno Deploy logs).
  // This shows: the raw pathname, whether it matched as a worker,
  // and whether the final CSP includes wasm-unsafe-eval.
  console.log(
    `[CSP] ${request.method} ${pathname}`,
    `| isWorker=${isWorker}`,
    `| provider=${providerId ?? '(none)'}`,
    `| wasm-unsafe-eval=${cspHeader.includes('wasm-unsafe-eval')}`,
    `| script-src=${cspHeader.match(/script-src\s+([^;]+)/)?.[1] ?? '(missing)'}`,
  );

  // Prevent directory traversal
  if (pathname.includes('..')) {
    return respond('Forbidden', 403, cspHeader);
  }

  // Resolve the file path within dist/
  let filePath = `${DIST}${pathname}`;

  // If path ends with / or has no extension, try index.html
  const lastSegment = pathname.split('/').pop() ?? '';
  if (pathname.endsWith('/') || !lastSegment.includes('.')) {
    // Try the exact path as a directory with index.html first
    if (pathname.endsWith('/')) {
      filePath = `${DIST}${pathname}index.html`;
    } else {
      // SPA fallback: serve index.html for client-side routes
      filePath = `${DIST}/index.html`;
    }
  }

  try {
    const file = await Deno.readFile(filePath);
    return respond(file, 200, cspHeader, {
      'Content-Type': getContentType(filePath),
      'Cache-Control': getCacheControl(filePath),
    });
  } catch {
    // File not found — serve index.html as SPA fallback
    try {
      const fallback = await Deno.readFile(`${DIST}/index.html`);
      return respond(fallback, 200, cspHeader, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'private, no-cache',
      });
    } catch {
      return respond('Not Found', 404, cspHeader);
    }
  }
});
