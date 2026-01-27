/**
 * Co-do production server for Deno Deploy.
 *
 * Serves the pre-built static site from `dist/` and attaches security
 * headers (including CSP) to every response.  This replaces the CSP
 * <meta> tag so that directives like frame-ancestors, worker-src, and
 * upgrade-insecure-requests are properly enforced.
 *
 * Run locally:
 *   deno task serve
 *
 * Deploy:
 *   deployctl deploy --project=<name> server/main.ts
 */

import { serveDir } from 'jsr:@std/http@1/file-server';
import { buildCspHeader } from './csp.ts';

const cspHeaderValue = buildCspHeader();

/** Additional security headers applied to every response. */
const securityHeaders: Record<string, string> = {
  'Content-Security-Policy': cspHeaderValue,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

/** Set security headers directly on a response. */
function applySecurityHeaders(response: Response): Response {
  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value);
  }
  return response;
}

/**
 * Serve the SPA index.html as a fallback for client-side routes.
 * Only applies to requests that don't look like static file paths
 * (i.e. paths without a file extension).
 */
async function serveIndexFallback(): Promise<Response> {
  try {
    const html = await Deno.readTextFile('dist/index.html');
    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch {
    return new Response('Not Found', { status: 404 });
  }
}

Deno.serve(async (request: Request): Promise<Response> => {
  // Serve static files from the Vite build output directory
  const response = await serveDir(request, {
    fsRoot: 'dist',
    quiet: true,
  });

  // SPA fallback: if no static file matched and the path has no file
  // extension, serve index.html so client-side routing can take over.
  if (response.status === 404) {
    const { pathname } = new URL(request.url);
    const lastSegment = pathname.split('/').pop() ?? '';
    if (!lastSegment.includes('.')) {
      return applySecurityHeaders(await serveIndexFallback());
    }
  }

  return applySecurityHeaders(response);
});
