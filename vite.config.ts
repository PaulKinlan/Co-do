import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Co-do: AI File System Manager',
        short_name: 'Co-do',
        description: 'An AI-powered file system manager using the File System Access API',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.anthropic\.com\/.*/i,
            handler: 'NetworkOnly',
            options: {
              backgroundSync: {
                name: 'anthropic-queue',
                options: {
                  maxRetentionTime: 24 * 60 // Retry for max of 24 Hours
                }
              }
            }
          },
          {
            urlPattern: /^https:\/\/api\.openai\.com\/.*/i,
            handler: 'NetworkOnly',
            options: {
              backgroundSync: {
                name: 'openai-queue',
                options: {
                  maxRetentionTime: 24 * 60
                }
              }
            }
          },
          {
            urlPattern: /^https:\/\/generativelanguage\.googleapis\.com\/.*/i,
            handler: 'NetworkOnly',
            options: {
              backgroundSync: {
                name: 'google-queue',
                options: {
                  maxRetentionTime: 24 * 60
                }
              }
            }
          }
        ],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true
      },
      devOptions: {
        enabled: true,
        type: 'module'
      }
    })
  ],
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
