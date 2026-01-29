import { defineConfig, Plugin } from 'vite';
import { createHash } from 'node:crypto';
import {
  writeFileSync,
  readdirSync,
  readFileSync,
  statSync,
  existsSync,
} from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { buildCspHeaderForProvider } from './server/csp';
import { parseCookies, PROVIDER_COOKIE_NAME } from './server/providers';

// Read repository URL from package.json
function getRepositoryUrl(): string | null {
  try {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'));
    let url: string | null = null;

    if (typeof packageJson.repository === 'string') {
      url = packageJson.repository;
    } else if (packageJson.repository?.url) {
      // Handle git+https:// or git:// prefixes
      url = packageJson.repository.url
        .replace(/^git\+/, '')
        .replace(/\.git$/, '');
    }

    // Normalize URL: remove trailing slashes
    if (url) {
      url = url.replace(/\/+$/, '');
    }

    return url;
  } catch (error) {
    console.warn('Failed to read repository URL from package.json:', error);
    return null;
  }
}

// Get git commit hash for changelog links
function getGitCommitHash(): string | null {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  } catch (error) {
    // Log warning for CI/CD environments where git might not be available
    console.warn('Failed to get git commit hash:', error);
    return null;
  }
}

// Derive short hash from full hash (avoids redundant git command)
function getShortHash(fullHash: string | null): string | null {
  if (!fullHash) return null;
  return fullHash.substring(0, 7);
}

/**
 * Plugin that sets a dynamic Content-Security-Policy header per request.
 *
 * Reads the `co-do-provider` cookie from the incoming request and builds a
 * CSP with connect-src restricted to only that provider's API domain.
 * If no cookie is set (first visit) or unknown, connect-src defaults to
 * 'self' only (no external connections).
 *
 * See docs/models-csp-report.md for the full rationale.
 */
function dynamicCspPlugin(): Plugin {
  return {
    name: 'dynamic-csp',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const cookies = parseCookies(req.headers.cookie);
        const providerId = cookies[PROVIDER_COOKIE_NAME];
        const cspHeader = buildCspHeaderForProvider(providerId);
        res.setHeader('Content-Security-Policy', cspHeader);
        next();
      });
    },
  };
}

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
        if (req.url === '/version.json') {
          const commitHash = getGitCommitHash();
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              version: 'development',
              buildTime: new Date().toISOString(),
              commitHash,
              commitShortHash: getShortHash(commitHash),
              repositoryUrl: getRepositoryUrl(),
            })
          );
          return;
        }
        next();
      });
    },
    closeBundle() {
      // Ensure output directory exists before reading
      if (!existsSync(outDir)) {
        console.warn(`\n⚠ Skipping version.json generation: ${outDir} does not exist`);
        return;
      }

      // Generate a hash of all built files
      const hash = createHash('sha256');

      const files = getAllFiles(outDir);
      for (const file of files) {
        const content = readFileSync(file);
        hash.update(content);
      }

      const version = hash.digest('hex').substring(0, 16);
      const buildTime = new Date().toISOString();
      const commitHash = getGitCommitHash();
      const repositoryUrl = getRepositoryUrl();

      const versionData = {
        version,
        buildTime,
        commitHash,
        commitShortHash: getShortHash(commitHash),
        repositoryUrl,
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
  base: '/',
  server: {
    port: 3000,
    // CSP is set dynamically per-request by dynamicCspPlugin() based on
    // the user's selected provider cookie. See docs/models-csp-report.md.
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
    // Ensure Workers are bundled correctly
    rollupOptions: {
      output: {
        // Preserve module structure for Workers
        manualChunks: undefined,
      },
    },
  },
  // Enable Worker bundling
  worker: {
    format: 'es',
    plugins: () => [],
  },
  plugins: [dynamicCspPlugin(), versionPlugin()]
});
