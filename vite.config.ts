import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    headers: {
      // Strict Content Security Policy - only allow AI model endpoints
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self'",
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
