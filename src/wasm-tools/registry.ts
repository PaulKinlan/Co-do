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
 * All 40 tools organized by category.
 */
export const BUILTIN_TOOLS: BuiltinToolConfig[] = [
  // ==========================================================================
  // Crypto / Encoding Tools (6 tools)
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
  {
    name: 'md5sum',
    category: 'crypto',
    wasmUrl: 'wasm-tools/binaries/md5sum.wasm',
    manifest: createManifest(
      'md5sum',
      'Calculate MD5 hash of text. Note: MD5 is not cryptographically secure, use for checksums only.',
      {
        type: 'object',
        properties: {
          input: {
            type: 'string',
            description: 'Text to hash',
          },
        },
        required: ['input'],
      },
      { category: 'crypto', argStyle: 'positional' }
    ),
  },
  {
    name: 'sha256sum',
    category: 'crypto',
    wasmUrl: 'wasm-tools/binaries/sha256sum.wasm',
    manifest: createManifest(
      'sha256sum',
      'Calculate SHA-256 hash of text.',
      {
        type: 'object',
        properties: {
          input: {
            type: 'string',
            description: 'Text to hash',
          },
        },
        required: ['input'],
      },
      { category: 'crypto', argStyle: 'positional' }
    ),
  },
  {
    name: 'sha512sum',
    category: 'crypto',
    wasmUrl: 'wasm-tools/binaries/sha512sum.wasm',
    manifest: createManifest(
      'sha512sum',
      'Calculate SHA-512 hash of text.',
      {
        type: 'object',
        properties: {
          input: {
            type: 'string',
            description: 'Text to hash',
          },
        },
        required: ['input'],
      },
      { category: 'crypto', argStyle: 'positional' }
    ),
  },
  {
    name: 'xxd',
    category: 'crypto',
    wasmUrl: 'wasm-tools/binaries/xxd.wasm',
    manifest: createManifest(
      'xxd',
      'Create a hex dump of text or reverse a hex dump back to text.',
      {
        type: 'object',
        properties: {
          mode: {
            type: 'string',
            enum: ['dump', 'reverse'],
            description: 'Mode: "dump" for hex dump, "reverse" to convert hex back to text',
          },
          input: {
            type: 'string',
            description: 'Text to convert to hex, or hex string to reverse',
          },
        },
        required: ['mode', 'input'],
      },
      { category: 'crypto', argStyle: 'positional' }
    ),
  },
  {
    name: 'uuid',
    category: 'crypto',
    wasmUrl: 'wasm-tools/binaries/uuid.wasm',
    manifest: createManifest(
      'uuid',
      'Generate a random UUID v4.',
      {
        type: 'object',
        properties: {
          count: {
            type: 'number',
            description: 'Number of UUIDs to generate (default: 1)',
            default: 1,
          },
        },
        required: [],
      },
      { category: 'crypto', argStyle: 'positional' }
    ),
  },

  // ==========================================================================
  // Text Processing Tools (12 tools)
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
            description: 'Text to count',
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
      { category: 'text', argStyle: 'cli' }
    ),
  },
  {
    name: 'wasm_head',
    category: 'text',
    wasmUrl: 'wasm-tools/binaries/head.wasm',
    manifest: createManifest(
      'wasm_head',
      'Output the first N lines of text (default: 10).',
      {
        type: 'object',
        properties: {
          input: {
            type: 'string',
            description: 'Text to process',
          },
          n: {
            type: 'number',
            description: 'Number of lines to output (default: 10)',
            default: 10,
          },
        },
        required: ['input'],
      },
      { category: 'text', argStyle: 'cli' }
    ),
  },
  {
    name: 'wasm_tail',
    category: 'text',
    wasmUrl: 'wasm-tools/binaries/tail.wasm',
    manifest: createManifest(
      'wasm_tail',
      'Output the last N lines of text (default: 10).',
      {
        type: 'object',
        properties: {
          input: {
            type: 'string',
            description: 'Text to process',
          },
          n: {
            type: 'number',
            description: 'Number of lines to output (default: 10)',
            default: 10,
          },
        },
        required: ['input'],
      },
      { category: 'text', argStyle: 'cli' }
    ),
  },
  {
    name: 'cut',
    category: 'text',
    wasmUrl: 'wasm-tools/binaries/cut.wasm',
    manifest: createManifest(
      'cut',
      'Extract columns/fields from text using a delimiter.',
      {
        type: 'object',
        properties: {
          input: {
            type: 'string',
            description: 'Text to process',
          },
          delimiter: {
            type: 'string',
            description: 'Field delimiter (default: tab)',
            default: '\t',
          },
          fields: {
            type: 'string',
            description: 'Field numbers to extract (e.g., "1,3" or "1-3")',
          },
        },
        required: ['input', 'fields'],
      },
      { category: 'text', argStyle: 'cli' }
    ),
  },
  {
    name: 'wasm_sort',
    category: 'text',
    wasmUrl: 'wasm-tools/binaries/sort.wasm',
    manifest: createManifest(
      'wasm_sort',
      'Sort lines of text alphabetically or numerically.',
      {
        type: 'object',
        properties: {
          input: {
            type: 'string',
            description: 'Text with lines to sort',
          },
          reverse: {
            type: 'boolean',
            description: 'Sort in reverse order (-r)',
            default: false,
          },
          numeric: {
            type: 'boolean',
            description: 'Sort numerically (-n)',
            default: false,
          },
          unique: {
            type: 'boolean',
            description: 'Output only unique lines (-u)',
            default: false,
          },
        },
        required: ['input'],
      },
      { category: 'text', argStyle: 'cli' }
    ),
  },
  {
    name: 'wasm_uniq',
    category: 'text',
    wasmUrl: 'wasm-tools/binaries/uniq.wasm',
    manifest: createManifest(
      'wasm_uniq',
      'Report or filter out repeated adjacent lines.',
      {
        type: 'object',
        properties: {
          input: {
            type: 'string',
            description: 'Text to process (should be sorted first)',
          },
          count: {
            type: 'boolean',
            description: 'Prefix lines with occurrence count (-c)',
            default: false,
          },
          repeated: {
            type: 'boolean',
            description: 'Only print repeated lines (-d)',
            default: false,
          },
          unique: {
            type: 'boolean',
            description: 'Only print unique lines (-u)',
            default: false,
          },
        },
        required: ['input'],
      },
      { category: 'text', argStyle: 'cli' }
    ),
  },
  {
    name: 'tr',
    category: 'text',
    wasmUrl: 'wasm-tools/binaries/tr.wasm',
    manifest: createManifest(
      'tr',
      'Translate or delete characters in text.',
      {
        type: 'object',
        properties: {
          input: {
            type: 'string',
            description: 'Text to transform',
          },
          set1: {
            type: 'string',
            description: 'Characters to translate from',
          },
          set2: {
            type: 'string',
            description: 'Characters to translate to (omit to delete set1 chars)',
          },
        },
        required: ['input', 'set1'],
      },
      { category: 'text', argStyle: 'positional' }
    ),
  },
  {
    name: 'wasm_grep',
    category: 'text',
    wasmUrl: 'wasm-tools/binaries/grep.wasm',
    manifest: createManifest(
      'wasm_grep',
      'Search for patterns in text (simple substring matching).',
      {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description: 'Pattern to search for',
          },
          input: {
            type: 'string',
            description: 'Text to search',
          },
          ignoreCase: {
            type: 'boolean',
            description: 'Case-insensitive search (-i)',
            default: false,
          },
          invert: {
            type: 'boolean',
            description: 'Invert match - show non-matching lines (-v)',
            default: false,
          },
          lineNumbers: {
            type: 'boolean',
            description: 'Show line numbers (-n)',
            default: false,
          },
          count: {
            type: 'boolean',
            description: 'Only count matching lines (-c)',
            default: false,
          },
        },
        required: ['pattern', 'input'],
      },
      { category: 'text', argStyle: 'cli' }
    ),
  },
  {
    name: 'sed',
    category: 'text',
    wasmUrl: 'wasm-tools/binaries/sed.wasm',
    manifest: createManifest(
      'sed',
      'Stream editor for text transformation. Supports s/pattern/replacement/[g] syntax.',
      {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: 'sed expression (e.g., "s/old/new/g")',
          },
          input: {
            type: 'string',
            description: 'Text to transform',
          },
        },
        required: ['expression', 'input'],
      },
      { category: 'text', argStyle: 'positional' }
    ),
  },
  {
    name: 'awk',
    category: 'text',
    wasmUrl: 'wasm-tools/binaries/awk.wasm',
    manifest: createManifest(
      'awk',
      'Pattern scanning and processing. Simplified awk supporting basic field extraction and printing.',
      {
        type: 'object',
        properties: {
          program: {
            type: 'string',
            description: 'awk program (e.g., "{print $1}" or "/pattern/{print $2}")',
          },
          input: {
            type: 'string',
            description: 'Text to process',
          },
          fieldSeparator: {
            type: 'string',
            description: 'Field separator (-F)',
          },
        },
        required: ['program', 'input'],
      },
      { category: 'text', argStyle: 'cli' }
    ),
  },
  {
    name: 'wasm_diff',
    category: 'text',
    wasmUrl: 'wasm-tools/binaries/diff.wasm',
    manifest: createManifest(
      'wasm_diff',
      'Compare two texts and show differences.',
      {
        type: 'object',
        properties: {
          text1: {
            type: 'string',
            description: 'First text to compare',
          },
          text2: {
            type: 'string',
            description: 'Second text to compare',
          },
          unified: {
            type: 'boolean',
            description: 'Output unified diff format (-u)',
            default: true,
          },
        },
        required: ['text1', 'text2'],
      },
      { category: 'text', argStyle: 'positional' }
    ),
  },
  {
    name: 'patch',
    category: 'text',
    wasmUrl: 'wasm-tools/binaries/patch.wasm',
    manifest: createManifest(
      'patch',
      'Apply a diff/patch to text.',
      {
        type: 'object',
        properties: {
          original: {
            type: 'string',
            description: 'Original text to patch',
          },
          patch: {
            type: 'string',
            description: 'Patch/diff to apply',
          },
        },
        required: ['original', 'patch'],
      },
      { category: 'text', argStyle: 'positional' }
    ),
  },

  // ==========================================================================
  // Data Format Tools (6 tools)
  // ==========================================================================
  {
    name: 'toml2json',
    category: 'data',
    wasmUrl: 'wasm-tools/binaries/toml2json.wasm',
    manifest: createManifest(
      'toml2json',
      'Convert TOML to JSON format.',
      {
        type: 'object',
        properties: {
          input: {
            type: 'string',
            description: 'TOML text to convert',
          },
        },
        required: ['input'],
      },
      { category: 'data', argStyle: 'positional' }
    ),
  },
  {
    name: 'csvtool',
    category: 'data',
    wasmUrl: 'wasm-tools/binaries/csvtool.wasm',
    manifest: createManifest(
      'csvtool',
      'Process CSV data: convert to JSON, extract columns, or filter rows.',
      {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            enum: ['tojson', 'cols', 'head'],
            description: 'Command: tojson (to JSON), cols (extract columns), head (first N rows)',
          },
          input: {
            type: 'string',
            description: 'CSV text to process',
          },
          columns: {
            type: 'string',
            description: 'Column numbers for "cols" command (e.g., "1,3")',
          },
          count: {
            type: 'number',
            description: 'Number of rows for "head" command',
          },
        },
        required: ['command', 'input'],
      },
      { category: 'data', argStyle: 'positional' }
    ),
  },
  {
    name: 'markdown',
    category: 'data',
    wasmUrl: 'wasm-tools/binaries/markdown.wasm',
    manifest: createManifest(
      'markdown',
      'Convert Markdown to HTML.',
      {
        type: 'object',
        properties: {
          input: {
            type: 'string',
            description: 'Markdown text to convert',
          },
        },
        required: ['input'],
      },
      { category: 'data', argStyle: 'positional' }
    ),
  },
  {
    name: 'jwt',
    category: 'data',
    wasmUrl: 'wasm-tools/binaries/jwt.wasm',
    manifest: createManifest(
      'jwt',
      'Decode and inspect JWT tokens (does not verify signatures).',
      {
        type: 'object',
        properties: {
          token: {
            type: 'string',
            description: 'JWT token to decode',
          },
        },
        required: ['token'],
      },
      { category: 'data', argStyle: 'positional' }
    ),
  },
  {
    name: 'xmllint',
    category: 'data',
    wasmUrl: 'wasm-tools/binaries/xmllint.wasm',
    manifest: createManifest(
      'xmllint',
      'Validate and format XML documents.',
      {
        type: 'object',
        properties: {
          input: {
            type: 'string',
            description: 'XML text to validate/format',
          },
          format: {
            type: 'boolean',
            description: 'Pretty-print the XML',
            default: true,
          },
        },
        required: ['input'],
      },
      { category: 'data', argStyle: 'positional' }
    ),
  },
  {
    name: 'yq',
    category: 'data',
    wasmUrl: 'wasm-tools/binaries/yq.wasm',
    manifest: createManifest(
      'yq',
      'Query and transform YAML data using jq-like syntax.',
      {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: 'jq-like expression (e.g., ".key", ".array[]")',
          },
          input: {
            type: 'string',
            description: 'YAML text to process',
          },
        },
        required: ['expression', 'input'],
      },
      { category: 'data', argStyle: 'positional' }
    ),
  },

  // ==========================================================================
  // File Utilities (6 tools)
  // ==========================================================================
  {
    name: 'file',
    category: 'file',
    wasmUrl: 'wasm-tools/binaries/file.wasm',
    manifest: createManifest(
      'file',
      'Determine file type from content using magic numbers.',
      {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: 'File content (can be binary as base64)',
          },
        },
        required: ['content'],
      },
      { category: 'file', argStyle: 'positional' }
    ),
  },
  {
    name: 'du',
    category: 'file',
    wasmUrl: 'wasm-tools/binaries/du.wasm',
    manifest: createManifest(
      'du',
      'Calculate and format file/data sizes.',
      {
        type: 'object',
        properties: {
          size: {
            type: 'number',
            description: 'Size in bytes to format',
          },
          human: {
            type: 'boolean',
            description: 'Human-readable output (-h)',
            default: true,
          },
        },
        required: ['size'],
      },
      { category: 'file', argStyle: 'cli' }
    ),
  },
  {
    name: 'stat',
    category: 'file',
    wasmUrl: 'wasm-tools/binaries/stat.wasm',
    manifest: createManifest(
      'stat',
      'Display formatted file information.',
      {
        type: 'object',
        properties: {
          filename: {
            type: 'string',
            description: 'Filename to show info for',
          },
          size: {
            type: 'number',
            description: 'File size in bytes',
          },
          modified: {
            type: 'string',
            description: 'Last modified timestamp (ISO format)',
          },
        },
        required: ['filename'],
      },
      { category: 'file', argStyle: 'positional' }
    ),
  },
  {
    name: 'wasm_tree',
    category: 'file',
    wasmUrl: 'wasm-tools/binaries/tree.wasm',
    manifest: createManifest(
      'wasm_tree',
      'Display directory structure as a tree.',
      {
        type: 'object',
        properties: {
          input: {
            type: 'string',
            description: 'JSON array of file paths to display as tree',
          },
          directoriesOnly: {
            type: 'boolean',
            description: 'Show only directories (-d)',
            default: false,
          },
        },
        required: ['input'],
      },
      { category: 'file', argStyle: 'positional' }
    ),
  },
  {
    name: 'touch',
    category: 'file',
    wasmUrl: 'wasm-tools/binaries/touch.wasm',
    manifest: createManifest(
      'touch',
      'Generate a touch command to create/update file timestamps.',
      {
        type: 'object',
        properties: {
          filename: {
            type: 'string',
            description: 'Filename to touch',
          },
        },
        required: ['filename'],
      },
      { category: 'file', argStyle: 'positional', fileAccess: 'write' }
    ),
  },
  {
    name: 'truncate',
    category: 'file',
    wasmUrl: 'wasm-tools/binaries/truncate.wasm',
    manifest: createManifest(
      'truncate',
      'Truncate or extend text to a specific length.',
      {
        type: 'object',
        properties: {
          input: {
            type: 'string',
            description: 'Text to truncate',
          },
          size: {
            type: 'number',
            description: 'Target size in characters',
          },
        },
        required: ['input', 'size'],
      },
      { category: 'file', argStyle: 'positional' }
    ),
  },

  // ==========================================================================
  // Code / Minification Tools (5 tools)
  // ==========================================================================
  {
    name: 'shfmt',
    category: 'code',
    wasmUrl: 'wasm-tools/binaries/shfmt.wasm',
    manifest: createManifest(
      'shfmt',
      'Format shell scripts.',
      {
        type: 'object',
        properties: {
          input: {
            type: 'string',
            description: 'Shell script to format',
          },
          indent: {
            type: 'number',
            description: 'Indentation width (default: 2)',
            default: 2,
          },
        },
        required: ['input'],
      },
      { category: 'code', argStyle: 'positional' }
    ),
  },
  {
    name: 'minify',
    category: 'code',
    wasmUrl: 'wasm-tools/binaries/minify.wasm',
    manifest: createManifest(
      'minify',
      'Minify JavaScript code by removing whitespace and comments.',
      {
        type: 'object',
        properties: {
          input: {
            type: 'string',
            description: 'JavaScript code to minify',
          },
        },
        required: ['input'],
      },
      { category: 'code', argStyle: 'positional' }
    ),
  },
  {
    name: 'terser',
    category: 'code',
    wasmUrl: 'wasm-tools/binaries/terser.wasm',
    manifest: createManifest(
      'terser',
      'Minify JavaScript code (simplified terser-like minification).',
      {
        type: 'object',
        properties: {
          input: {
            type: 'string',
            description: 'JavaScript code to minify',
          },
        },
        required: ['input'],
      },
      { category: 'code', argStyle: 'positional' }
    ),
  },
  {
    name: 'csso',
    category: 'code',
    wasmUrl: 'wasm-tools/binaries/csso.wasm',
    manifest: createManifest(
      'csso',
      'Minify CSS code by removing whitespace and comments.',
      {
        type: 'object',
        properties: {
          input: {
            type: 'string',
            description: 'CSS code to minify',
          },
        },
        required: ['input'],
      },
      { category: 'code', argStyle: 'positional' }
    ),
  },
  {
    name: 'html-minifier',
    category: 'code',
    wasmUrl: 'wasm-tools/binaries/html-minifier.wasm',
    manifest: createManifest(
      'html-minifier',
      'Minify HTML by removing whitespace and comments.',
      {
        type: 'object',
        properties: {
          input: {
            type: 'string',
            description: 'HTML code to minify',
          },
        },
        required: ['input'],
      },
      { category: 'code', argStyle: 'positional' }
    ),
  },

  // ==========================================================================
  // Search Tools (1 tool)
  // ==========================================================================
  {
    name: 'fzf',
    category: 'search',
    wasmUrl: 'wasm-tools/binaries/fzf.wasm',
    manifest: createManifest(
      'fzf',
      'Fuzzy find matching items from a list.',
      {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query',
          },
          items: {
            type: 'string',
            description: 'Newline-separated list of items to search',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results (default: 10)',
            default: 10,
          },
        },
        required: ['query', 'items'],
      },
      { category: 'search', argStyle: 'positional' }
    ),
  },

  // ==========================================================================
  // Compression Tools (3 tools)
  // ==========================================================================
  {
    name: 'gzip',
    category: 'compression',
    wasmUrl: 'wasm-tools/binaries/gzip.wasm',
    manifest: createManifest(
      'gzip',
      'Compress or decompress data using gzip format. Input/output is base64-encoded for binary data.',
      {
        type: 'object',
        properties: {
          mode: {
            type: 'string',
            enum: ['compress', 'decompress'],
            description: 'Whether to compress or decompress',
          },
          input: {
            type: 'string',
            description: 'Data to process (base64-encoded for binary)',
          },
        },
        required: ['input'],
      },
      { category: 'compression', argStyle: 'cli', timeout: 60000 }
    ),
  },
  {
    name: 'brotli',
    category: 'compression',
    wasmUrl: 'wasm-tools/binaries/brotli.wasm',
    manifest: createManifest(
      'brotli',
      'Compress or decompress data using Brotli format. Reads from stdin, writes to stdout.',
      {
        type: 'object',
        properties: {
          decompress: {
            type: 'boolean',
            description: 'Decompress instead of compress (-d)',
            default: false,
          },
          quality: {
            type: 'number',
            description: 'Compression quality 0-11 (default: 11)',
            default: 11,
          },
        },
        required: [],
      },
      { category: 'compression', argStyle: 'cli', timeout: 60000 }
    ),
  },
  {
    name: 'zstd',
    category: 'compression',
    wasmUrl: 'wasm-tools/binaries/zstd.wasm',
    manifest: createManifest(
      'zstd',
      'Compress or decompress data using Zstandard format. Reads from stdin, writes to stdout.',
      {
        type: 'object',
        properties: {
          decompress: {
            type: 'boolean',
            description: 'Decompress instead of compress (-d)',
            default: false,
          },
          level: {
            type: 'number',
            description: 'Compression level 1-19 (default: 3)',
            default: 3,
          },
        },
        required: [],
      },
      { category: 'compression', argStyle: 'cli', timeout: 60000 }
    ),
  },

  // ==========================================================================
  // Database Tools (1 tool)
  // ==========================================================================
  {
    name: 'sqlite3',
    category: 'database',
    wasmUrl: 'wasm-tools/binaries/sqlite3.wasm',
    manifest: createManifest(
      'sqlite3',
      'SQLite database engine. Execute SQL queries on in-memory databases.',
      {
        type: 'object',
        properties: {
          sql: {
            type: 'string',
            description: 'SQL query to execute',
          },
          data: {
            type: 'string',
            description: 'Optional: JSON array of data to insert before query',
          },
        },
        required: ['sql'],
      },
      { category: 'database', argStyle: 'json', timeout: 60000 }
    ),
  },
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
