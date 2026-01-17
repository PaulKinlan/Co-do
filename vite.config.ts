import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    headers: {
      // Content Security Policy for development
      // Note: 'unsafe-inline' for style-src is required for Vite's HMR in development.
      // In production, styles are extracted to external CSS files, so a stricter CSP
      // can be configured at the hosting level without 'unsafe-inline'.
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self'",
        // 'unsafe-inline' is needed for Vite dev server style injection
        // For production, configure stricter CSP at your web server/CDN level
        "style-src 'self' 'unsafe-inline'",
        // Allow connections only to AI model providers
        "connect-src 'self' https://api.anthropic.com https://api.openai.com https://generativelanguage.googleapis.com",
        "img-src 'self' data:",
        "font-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "upgrade-insecure-requests"
      ].join('; ')
    }
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true
  }
});
