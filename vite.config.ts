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
import { join, resolve, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
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
 * Lazy-loaded WASM tools sourced from npm packages.
 *
 * Each entry maps a virtual filename (under wasm-tools/binaries/) to the
 * real path inside node_modules. These files are NOT bundled with the app
 * on startup — they are fetched on demand when the user enables the tool.
 *
 * In dev mode: served directly from node_modules via Vite middleware.
 * In production: copied into the build output with content hashes, just
 * like the C-built WASM tools.
 */
const NPM_WASM_FILES: Record<string, string> = {
  'imagemagick.wasm': join(__dirname, 'node_modules/@imagemagick/magick-wasm/dist/magick.wasm'),
  'ffmpeg-core.wasm': join(__dirname, 'node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm'),
  'ffmpeg-core.js':   join(__dirname, 'node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.js'),
};

/**
 * Plugin that copies WASM tool binaries into the build output with content
 * hashes in their filenames, and writes a manifest mapping original names
 * to hashed names.
 *
 * This prevents CDN caching issues (e.g. Cloudflare) where an updated
 * binary with the same filename would still be served from cache.
 *
 * In dev mode the plugin serves an empty manifest so the loader falls back
 * to raw (unhashed) URLs served directly by the Vite dev server. Lazy-loaded
 * npm WASM files are served from node_modules via middleware.
 */
function wasmHashPlugin(): Plugin {
  const WASM_SRC_DIR = join(__dirname, 'wasm-tools', 'binaries');
  const MANIFEST_PATH = 'wasm-tools/wasm-manifest.json';

  return {
    name: 'wasm-hash',

    // Dev server: serve empty manifest + npm WASM files from node_modules
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/' + MANIFEST_PATH) {
          res.setHeader('Content-Type', 'application/json');
          res.end('{}');
          return;
        }

        // Serve lazy-loaded npm WASM/JS files from node_modules
        const cleanUrl = (req.url ?? '').split(/[?#]/, 1)[0]!;
        const prefix = '/wasm-tools/binaries/';
        if (cleanUrl.startsWith(prefix)) {
          const filename = cleanUrl.slice(prefix.length);
          const npmPath = NPM_WASM_FILES[filename];
          if (npmPath && existsSync(npmPath)) {
            const content = readFileSync(npmPath);
            const contentType = filename.endsWith('.js')
              ? 'application/javascript'
              : 'application/wasm';
            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Length', content.length.toString());
            res.end(content);
            return;
          }
        }

        next();
      });
    },

    // Production build: copy WASM binaries with content-hashed names
    writeBundle(options) {
      const outDir = options.dir ?? 'dist';
      const destDir = join(outDir, 'wasm-tools', 'binaries');
      mkdirSync(destDir, { recursive: true });

      const manifest: Record<string, string> = {};

      // 1. Copy C-built WASM tools from wasm-tools/binaries/
      if (existsSync(WASM_SRC_DIR)) {
        const wasmFiles = readdirSync(WASM_SRC_DIR).filter(f => f.endsWith('.wasm'));

        for (const file of wasmFiles) {
          const srcPath = join(WASM_SRC_DIR, file);
          const content = readFileSync(srcPath);
          const hash = createHash('sha256').update(content).digest('hex').substring(0, 8);

          const name = basename(file, '.wasm');
          const hashedName = `${name}-${hash}.wasm`;
          const destPath = join(destDir, hashedName);

          copyFileSync(srcPath, destPath);

          const originalUrl = `wasm-tools/binaries/${file}`;
          const hashedUrl = `wasm-tools/binaries/${hashedName}`;
          manifest[originalUrl] = hashedUrl;
        }

        console.log(`\n✓ Copied ${wasmFiles.length} C-built WASM binaries with content hashes`);
      } else {
        console.warn('\n⚠ Skipping C-built WASM hashing: wasm-tools/binaries/ not found');
      }

      // 2. Copy lazy-loaded npm WASM/JS files from node_modules
      let npmCount = 0;
      const missingNpmFiles: string[] = [];
      for (const [filename, srcPath] of Object.entries(NPM_WASM_FILES)) {
        if (!existsSync(srcPath)) {
          missingNpmFiles.push(`${filename} (expected at ${srcPath})`);
          continue;
        }

        const content = readFileSync(srcPath);
        const hash = createHash('sha256').update(content).digest('hex').substring(0, 8);

        const ext = filename.includes('.') ? filename.slice(filename.lastIndexOf('.')) : '';
        const name = basename(filename, ext);
        const hashedName = `${name}-${hash}${ext}`;
        const destPath = join(destDir, hashedName);

        copyFileSync(srcPath, destPath);

        const originalUrl = `wasm-tools/binaries/${filename}`;
        const hashedUrl = `wasm-tools/binaries/${hashedName}`;
        manifest[originalUrl] = hashedUrl;
        npmCount++;
      }

      if (missingNpmFiles.length > 0) {
        throw new Error(
          `Missing npm WASM files required for lazy-loaded tools:\n` +
          missingNpmFiles.map(f => `  - ${f}`).join('\n') +
          `\nRun "npm install" to ensure all dependencies are present.`
        );
      }

      if (npmCount > 0) {
        console.log(`✓ Copied ${npmCount} npm WASM/JS files with content hashes`);
      }

      // Write the unified manifest
      const manifestDest = join(outDir, MANIFEST_PATH);
      mkdirSync(join(outDir, 'wasm-tools'), { recursive: true });
      writeFileSync(manifestDest, JSON.stringify(manifest, null, 2));
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
