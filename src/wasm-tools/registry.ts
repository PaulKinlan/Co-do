/**
 * Built-in WASM Tool Registry
 *
 * This module defines all built-in WASM tools that ship with Co-do.
 * Tools are organized by category and loaded on-demand from the
 * wasm-tools/ directory.
 *
 * Note: Tools with names that conflict with existing TypeScript tools
 * (grep, sort, uniq, wc, head, tail, tree, diff) will be registered
 * with a `wasm_` prefix to avoid runtime conflicts.
 */

import type { BuiltinToolConfig, WasmToolManifest } from './types';

/**
 * Helper to create a manifest with common defaults.
 */
function createManifest(
  name: string,
  description: string,
  parameters: WasmToolManifest['parameters'],
  options: {
    category: string;
    argStyle?: 'cli' | 'json' | 'positional';
    fileAccess?: 'none' | 'read' | 'write' | 'readwrite';
    timeout?: number;
  }
): WasmToolManifest {
  return {
    name,
    version: '1.0.0',
    description,
    parameters,
    returns: {
      type: 'string',
      description: 'The output of the command',
    },
    execution: {
      argStyle: options.argStyle ?? 'positional',
      fileAccess: options.fileAccess ?? 'none',
      timeout: options.timeout ?? 30000,
    },
    category: options.category,
    author: 'Co-do',
    license: 'MIT',
  };
}

/**
 * Built-in tools registry.
 *
 * Initially we include a small set of example tools.
 * More tools can be added as WASM binaries are compiled.
 */
export const BUILTIN_TOOLS: BuiltinToolConfig[] = [
  // ==========================================================================
  // Crypto / Encoding Tools
  // ==========================================================================
  {
    name: 'base64',
    category: 'crypto',
    wasmUrl: 'wasm-tools/binaries/base64.wasm',
    manifest: createManifest(
      'base64',
      'Encode or decode data using Base64 encoding. Use "encode" to convert text to Base64, or "decode" to convert Base64 back to text.',
      {
        type: 'object',
        properties: {
          mode: {
            type: 'string',
            enum: ['encode', 'decode'],
            description: 'Whether to encode or decode',
          },
          input: {
            type: 'string',
            description: 'The text to encode, or base64 string to decode',
          },
        },
        required: ['mode', 'input'],
      },
      { category: 'crypto', argStyle: 'positional' }
    ),
  },

  // Placeholder entries for future tools
  // These will be enabled once WASM binaries are compiled

  /*
  {
    name: 'sha256sum',
    category: 'crypto',
    wasmUrl: 'wasm-tools/binaries/sha256sum.wasm',
    manifest: createManifest(
      'sha256sum',
      'Calculate SHA-256 hash of text or file content.',
      {
        type: 'object',
        properties: {
          input: {
            type: 'string',
            description: 'Text to hash, or file path if --file flag is used',
          },
          file: {
            type: 'boolean',
            description: 'If true, treat input as a file path to read',
            default: false,
          },
        },
        required: ['input'],
      },
      { category: 'crypto', argStyle: 'cli', fileAccess: 'read' }
    ),
  },

  {
    name: 'md5sum',
    category: 'crypto',
    wasmUrl: 'wasm-tools/binaries/md5sum.wasm',
    manifest: createManifest(
      'md5sum',
      'Calculate MD5 hash of text or file content.',
      {
        type: 'object',
        properties: {
          input: {
            type: 'string',
            description: 'Text to hash, or file path if --file flag is used',
          },
          file: {
            type: 'boolean',
            description: 'If true, treat input as a file path to read',
            default: false,
          },
        },
        required: ['input'],
      },
      { category: 'crypto', argStyle: 'cli', fileAccess: 'read' }
    ),
  },

  // ==========================================================================
  // Text Processing Tools
  // ==========================================================================

  {
    name: 'wasm_wc',
    category: 'text',
    wasmUrl: 'wasm-tools/binaries/wc.wasm',
    manifest: createManifest(
      'wasm_wc',
      'Count lines, words, and characters in text.',
      {
        type: 'object',
        properties: {
          input: {
            type: 'string',
            description: 'Text to count, or file path',
          },
          lines: {
            type: 'boolean',
            description: 'Count only lines (-l)',
            default: false,
          },
          words: {
            type: 'boolean',
            description: 'Count only words (-w)',
            default: false,
          },
          chars: {
            type: 'boolean',
            description: 'Count only characters (-c)',
            default: false,
          },
        },
        required: ['input'],
      },
      { category: 'text', argStyle: 'cli', fileAccess: 'read' }
    ),
  },

  // ==========================================================================
  // Compression Tools
  // ==========================================================================

  {
    name: 'gzip',
    category: 'compression',
    wasmUrl: 'wasm-tools/binaries/gzip.wasm',
    manifest: createManifest(
      'gzip',
      'Compress data using gzip compression.',
      {
        type: 'object',
        properties: {
          input: {
            type: 'string',
            description: 'Text to compress, or file path',
          },
          level: {
            type: 'number',
            description: 'Compression level (1-9, default 6)',
            default: 6,
          },
        },
        required: ['input'],
      },
      { category: 'compression', argStyle: 'cli', fileAccess: 'read' }
    ),
  },

  // ==========================================================================
  // Data Format Tools
  // ==========================================================================

  {
    name: 'jq',
    category: 'data',
    wasmUrl: 'wasm-tools/binaries/jq.wasm',
    manifest: createManifest(
      'jq',
      'Query and transform JSON data using jq expressions.',
      {
        type: 'object',
        properties: {
          filter: {
            type: 'string',
            description: 'jq filter expression (e.g., ".foo", ".[] | .name")',
          },
          input: {
            type: 'string',
            description: 'JSON string to process',
          },
        },
        required: ['filter', 'input'],
      },
      { category: 'data', argStyle: 'positional' }
    ),
  },
  */
];

/**
 * Get tools by category.
 */
export function getToolsByCategory(category: string): BuiltinToolConfig[] {
  return BUILTIN_TOOLS.filter(t => t.manifest.category === category);
}

/**
 * Get all available categories.
 */
export function getCategories(): string[] {
  const categories = new Set(BUILTIN_TOOLS.map(t => t.manifest.category));
  return Array.from(categories).sort();
}

/**
 * Check if a tool name conflicts with existing TypeScript tools.
 */
export function hasNameConflict(name: string): boolean {
  const conflictingNames = ['grep', 'sort', 'uniq', 'wc', 'head', 'tail', 'tree', 'diff'];
  return conflictingNames.includes(name);
}

/**
 * Get the prefixed name for a WASM tool to avoid conflicts.
 */
export function getWasmToolName(manifest: { name: string }): string {
  return hasNameConflict(manifest.name) ? `wasm_${manifest.name}` : manifest.name;
}
