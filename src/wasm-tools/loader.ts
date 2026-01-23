/**
 * WASM Tool Loader
 *
 * This module handles loading WASM tools from ZIP packages and from
 * the built-in registry. It validates manifests and enforces security limits.
 */

import JSZip from 'jszip';
import { WasmToolManifestSchema } from './types';
import type { WasmToolManifest, StoredWasmTool, BuiltinToolConfig } from './types';
import { BUILTIN_TOOLS } from './registry';

// Security limits for ZIP validation
const MAX_ZIP_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_FILE_COUNT = 100;
const MAX_WASM_SIZE = 20 * 1024 * 1024; // 20 MB

/**
 * WASM Tool Loader that handles loading tools from ZIP packages
 * and from the built-in registry.
 */
export class WasmToolLoader {
  /**
   * Load a single WASM tool from a ZIP archive.
   *
   * ZIP format constraints:
   * - Must contain exactly one `manifest.json` at any depth.
   * - Must contain exactly one `.wasm` file at any depth.
   * - Additional files are ignored but allowed.
   */
  async loadFromZip(zipFile: File): Promise<{
    manifest: WasmToolManifest;
    wasmBinary: ArrayBuffer;
  }> {
    // 0. Validate ZIP size
    if (zipFile.size > MAX_ZIP_SIZE) {
      throw new Error(`ZIP file exceeds maximum size of ${MAX_ZIP_SIZE / 1024 / 1024} MB`);
    }

    // 1. Read the ZIP into memory
    const zipData = await zipFile.arrayBuffer();

    // 2. Unzip the file using JSZip
    const zip = await JSZip.loadAsync(zipData);

    // 3. Validate file count to prevent ZIP bomb attacks
    const entries = Object.values(zip.files).filter((e) => !e.dir);
    if (entries.length > MAX_FILE_COUNT) {
      throw new Error(`ZIP contains too many files (max: ${MAX_FILE_COUNT})`);
    }

    let manifestFile: JSZip.JSZipObject | null = null;
    let wasmFile: JSZip.JSZipObject | null = null;

    // 4. Find manifest.json and *.wasm, enforcing "exactly one" of each
    for (const entry of entries) {
      // Path traversal protection
      if (entry.name.includes('..') || entry.name.startsWith('/')) {
        throw new Error(`Invalid file path in ZIP: ${entry.name}`);
      }

      const normalizedName = entry.name.toLowerCase();
      const fileName = normalizedName.split('/').pop() ?? '';

      if (fileName === 'manifest.json') {
        if (manifestFile !== null) {
          throw new Error('WASM tool ZIP must contain exactly one manifest.json file');
        }
        manifestFile = entry;
        continue;
      }

      if (fileName.endsWith('.wasm')) {
        if (wasmFile !== null) {
          throw new Error('WASM tool ZIP must contain exactly one .wasm file');
        }
        wasmFile = entry;
      }
    }

    if (!manifestFile) {
      throw new Error('WASM tool ZIP is missing manifest.json');
    }

    if (!wasmFile) {
      throw new Error('WASM tool ZIP is missing a .wasm file');
    }

    // 5. Load and parse manifest.json
    const manifestText = await manifestFile.async('string');
    let manifestRaw: unknown;
    try {
      manifestRaw = JSON.parse(manifestText);
    } catch {
      throw new Error('Invalid JSON in manifest.json');
    }

    // Validate manifest against schema
    const parseResult = WasmToolManifestSchema.safeParse(manifestRaw);
    if (!parseResult.success) {
      const errors = parseResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      throw new Error(`Invalid manifest: ${errors}`);
    }
    const manifest = parseResult.data;

    // 6. Load the WASM binary with size validation
    const wasmBinary = await wasmFile.async('arraybuffer');
    if (wasmBinary.byteLength > MAX_WASM_SIZE) {
      throw new Error(`WASM binary exceeds maximum size of ${MAX_WASM_SIZE / 1024 / 1024} MB`);
    }

    // 7. Validate WASM magic number
    const magic = new Uint8Array(wasmBinary.slice(0, 4));
    if (magic[0] !== 0x00 || magic[1] !== 0x61 || magic[2] !== 0x73 || magic[3] !== 0x6d) {
      throw new Error('Invalid WASM binary (bad magic number)');
    }

    // 8. Return parsed data
    return { manifest, wasmBinary };
  }

  /**
   * Load a built-in tool from the registry.
   */
  async loadBuiltinTool(config: BuiltinToolConfig): Promise<StoredWasmTool> {
    // Fetch the WASM binary
    const response = await fetch(config.wasmUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch built-in tool: ${config.name} (${response.status})`);
    }

    const wasmBinary = await response.arrayBuffer();

    // Validate WASM magic number
    const magic = new Uint8Array(wasmBinary.slice(0, 4));
    if (magic[0] !== 0x00 || magic[1] !== 0x61 || magic[2] !== 0x73 || magic[3] !== 0x6d) {
      throw new Error(`Invalid WASM binary for built-in tool: ${config.name}`);
    }

    const now = Date.now();
    return {
      id: `builtin-${config.name}`,
      manifest: config.manifest,
      wasmBinary,
      source: 'builtin',
      enabled: true,
      installedAt: now,
      updatedAt: now,
    };
  }

  /**
   * Load all built-in tools from the registry.
   * Returns tools that were successfully loaded; logs errors for failures.
   */
  async loadAllBuiltinTools(): Promise<StoredWasmTool[]> {
    const tools: StoredWasmTool[] = [];
    const errors: string[] = [];

    for (const config of BUILTIN_TOOLS) {
      try {
        const tool = await this.loadBuiltinTool(config);
        tools.push(tool);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${config.name}: ${message}`);
        console.warn(`Failed to load built-in tool ${config.name}:`, error);
      }
    }

    if (errors.length > 0) {
      console.warn(`Failed to load ${errors.length} built-in tools:`, errors);
    }

    return tools;
  }

  /**
   * Create a StoredWasmTool from loaded data.
   */
  createStoredTool(
    manifest: WasmToolManifest,
    wasmBinary: ArrayBuffer,
    source: 'builtin' | 'user'
  ): StoredWasmTool {
    const now = Date.now();
    return {
      id: source === 'builtin' ? `builtin-${manifest.name}` : crypto.randomUUID(),
      manifest,
      wasmBinary,
      source,
      enabled: true,
      installedAt: now,
      updatedAt: now,
    };
  }

  /**
   * Get the list of built-in tool configurations.
   */
  getBuiltinToolConfigs(): BuiltinToolConfig[] {
    return BUILTIN_TOOLS;
  }
}

// Export singleton instance
export const wasmToolLoader = new WasmToolLoader();
