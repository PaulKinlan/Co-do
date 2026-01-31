import { defineConfig, Plugin } from 'vite';
import { createHash } from 'node:crypto';
import {
  writeFileSync,
  readdirSync,
  readFileSync,
  statSync,
  existsSync,
  mkdirSync,
  copyFileSync,
} from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { execSync } from 'node:child_process';
import { buildCspHeaderForProvider, isWasmWorkerRequest } from './server/csp';
import { parseCookies, PROVIDER_COOKIE_NAME } from './server/providers';

// Read version from package.json
function getPackageVersion(): string | null {
  try {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'));
    return packageJson.version || null;
  } catch (error) {
    console.warn('Failed to read version from package.json:', error);
    return null;
  }
}

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
 * Plugin that copies WASM tool binaries into the build output with content
 * hashes in their filenames, and writes a manifest mapping original names
 * to hashed names.
 *
 * This prevents CDN caching issues (e.g. Cloudflare) where an updated
 * binary with the same filename would still be served from cache.
 *
 * In dev mode the plugin serves an empty manifest so the loader falls back
 * to raw (unhashed) URLs served directly by the Vite dev server.
 */
function wasmHashPlugin(): Plugin {
  const WASM_SRC_DIR = join(__dirname, 'wasm-tools', 'binaries');
  const MANIFEST_PATH = 'wasm-tools/wasm-manifest.json';

  return {
    name: 'wasm-hash',

    // Dev server: serve an empty manifest so the loader uses raw URLs
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/' + MANIFEST_PATH) {
          res.setHeader('Content-Type', 'application/json');
          res.end('{}');
          return;
        }
        next();
      });
    },

    // Production build: copy WASM binaries with content-hashed names
    writeBundle(options) {
      const outDir = options.dir ?? 'dist';

      if (!existsSync(WASM_SRC_DIR)) {
        console.warn('\n⚠ Skipping WASM hashing: wasm-tools/binaries/ not found');
        return;
      }

      const destDir = join(outDir, 'wasm-tools', 'binaries');
      mkdirSync(destDir, { recursive: true });

      const manifest: Record<string, string> = {};
      const wasmFiles = readdirSync(WASM_SRC_DIR).filter(f => f.endsWith('.wasm'));

      for (const file of wasmFiles) {
        const srcPath = join(WASM_SRC_DIR, file);
        const content = readFileSync(srcPath);
        const hash = createHash('sha256').update(content).digest('hex').substring(0, 8);

        const name = basename(file, '.wasm');
        const hashedName = `${name}-${hash}.wasm`;
        const destPath = join(destDir, hashedName);

        copyFileSync(srcPath, destPath);

        // Map the original registry URL to the hashed URL
        const originalUrl = `wasm-tools/binaries/${file}`;
        const hashedUrl = `wasm-tools/binaries/${hashedName}`;
        manifest[originalUrl] = hashedUrl;
      }

      const manifestDest = join(outDir, MANIFEST_PATH);
      mkdirSync(join(outDir, 'wasm-tools'), { recursive: true });
      writeFileSync(manifestDest, JSON.stringify(manifest, null, 2));

      console.log(`\n✓ Copied ${wasmFiles.length} WASM binaries with content hashes`);
    },
  };
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
        const isWorker = isWasmWorkerRequest(req.url ?? '');
        const cspHeader = buildCspHeaderForProvider(providerId, isWorker);
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
              appVersion: getPackageVersion(),
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
        appVersion: getPackageVersion(),
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
      input: {
        main: resolve(__dirname, 'index.html'),
        'wasm-tool-guide': resolve(__dirname, 'wasm-tool-guide.html'),
      },
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
  plugins: [wasmHashPlugin(), dynamicCspPlugin(), versionPlugin()]
});
