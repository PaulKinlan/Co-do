import { defineConfig, Plugin } from 'vite';
import { createHash } from 'crypto';
import { writeFileSync, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

// Plugin to generate version.json with a checksum of the built assets
function versionPlugin(): Plugin {
  let outDir: string;

  // Recursively get all files in a directory
  function getAllFiles(dir: string): string[] {
    const files: string[] = [];
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        files.push(...getAllFiles(fullPath));
      } else {
        // Skip version.json itself and source maps
        if (entry !== 'version.json' && !entry.endsWith('.map')) {
          files.push(fullPath);
        }
      }
    }

    return files.sort(); // Sort for consistent ordering
  }

  return {
    name: 'version-plugin',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    configureServer(server) {
      // Serve a dev version.json during development
      // Use a fixed version in dev so the update notification doesn't appear
      server.middlewares.use((req, res, next) => {
        if (req.url === '/Co-do/version.json') {
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              version: 'development',
              buildTime: new Date().toISOString(),
            })
          );
          return;
        }
        next();
      });
    },
    closeBundle() {
      // Generate a hash of all built files
      const hash = createHash('sha256');

      const files = getAllFiles(outDir);
      for (const file of files) {
        const content = readFileSync(file);
        hash.update(content);
      }

      const version = hash.digest('hex').substring(0, 16);
      const buildTime = new Date().toISOString();

      const versionData = {
        version,
        buildTime,
      };

      writeFileSync(
        join(outDir, 'version.json'),
        JSON.stringify(versionData, null, 2)
      );

      console.log(`\n✓ Generated version.json (version: ${version})`);
    },
  };
}

export default defineConfig({
  base: '/Co-do/',
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
  },
  plugins: [versionPlugin()]
});
