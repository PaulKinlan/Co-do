# WebAssembly Custom Tools Implementation Plan

## Overview

This document outlines the implementation plan for adding WebAssembly-based custom tools to Co-do. The system will allow:

1. **Built-in WASM tools** - 61 pre-packaged CLI-style utilities
2. **User-installable tools** - Upload ZIP packages containing WASM + manifest
3. **AI integration** - Tools dynamically registered with the LLM
4. **File system access** - Tools can operate on the opened project directory

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         AI Manager                               │
│                    (streamCompletion)                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Tool Registry                               │
│              (fileTools + wasmTools merged)                      │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────────────┐
│    Built-in Tools       │     │       WASM Tool Manager          │
│    (src/tools.ts)       │     │    (src/wasm-tools/manager.ts)   │
└─────────────────────────┘     └─────────────────────────────────┘
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    ▼                         ▼                         ▼
          ┌─────────────────┐     ┌─────────────────────┐     ┌─────────────────┐
          │   Tool Loader   │     │   WASM Runtime      │     │   Tool Storage  │
          │   (loader.ts)   │     │   (runtime.ts)      │     │   (IndexedDB)   │
          └─────────────────┘     └─────────────────────┘     └─────────────────┘
                                              │
                                              ▼
                                  ┌─────────────────────┐
                                  │  Virtual File System │
                                  │   (vfs.ts)          │
                                  └─────────────────────┘
                                              │
                                              ▼
                                  ┌─────────────────────┐
                                  │  FileSystemManager  │
                                  │  (Real FS Access)   │
                                  └─────────────────────┘
```

## File Structure

```
src/
├── wasm-tools/
│   ├── index.ts           # Main exports
│   ├── types.ts           # TypeScript interfaces
│   ├── manager.ts         # WasmToolManager class
│   ├── loader.ts          # WASM module loading
│   ├── runtime.ts         # WASM execution environment
│   ├── vfs.ts             # Virtual file system bridge
│   ├── storage.ts         # IndexedDB operations
│   ├── registry.ts        # Built-in tool registry
│   └── schema.ts          # Manifest validation (Zod)
├── tools.ts               # (modified) Merge WASM tools
├── preferences.ts         # (modified) Dynamic tool permissions
└── ...

wasm-tools/                # Built-in WASM tools (pre-compiled)
├── manifests/             # JSON manifests for built-in tools
│   ├── base64.json
│   ├── grep.json
│   └── ...
├── binaries/              # Pre-compiled WASM binaries
│   ├── base64.wasm
│   ├── grep.wasm
│   └── ...
└── src/                   # Source code for example tools
    ├── base64/
    │   ├── main.c
    │   └── Makefile
    ├── sha256sum/
    │   ├── main.c
    │   └── Makefile
    └── ...
```

## Core Types

### Tool Manifest (manifest.json)

```typescript
interface WasmToolManifest {
  // Identity
  name: string;                    // Tool name (e.g., "base64")
  version: string;                 // Semantic version
  description: string;             // For LLM to understand usage

  // Schema for AI
  parameters: {
    type: "object";
    properties: Record<string, ParameterDefinition>;
    required?: string[];
  };

  // Return type
  returns: {
    type: "string" | "object";
    description: string;
  };

  // Execution config
  execution: {
    // How to pass args to WASM
    argStyle: "cli" | "json" | "positional";

    // File system requirements
    fileAccess: "none" | "read" | "write" | "readwrite";

    // Memory limits (bytes)
    memoryLimit?: number;

    // Timeout (ms)
    timeout?: number;
  };

  // Metadata
  category: string;                // For UI grouping
  author?: string;
  license?: string;
  homepage?: string;
}

interface ParameterDefinition {
  type: "string" | "number" | "boolean" | "array";
  description: string;
  enum?: string[];                 // For fixed choices
  default?: unknown;
  items?: { type: string };        // For arrays
}
```

### Stored Tool (IndexedDB)

```typescript
interface StoredWasmTool {
  id: string;                      // UUID
  manifest: WasmToolManifest;
  wasmBinary: ArrayBuffer;         // The compiled WASM
  source: "builtin" | "user";      // Origin
  enabled: boolean;
  installedAt: number;
  updatedAt: number;
}
```

## Implementation Phases

### Phase 1: Core Infrastructure

#### 1.1 Types and Schema (`src/wasm-tools/types.ts`)

Define all TypeScript interfaces and Zod schemas for validation.

```typescript
import { z } from 'zod';

export const ParameterDefinitionSchema = z.object({
  type: z.enum(['string', 'number', 'boolean', 'array']),
  description: z.string(),
  enum: z.array(z.string()).optional(),
  default: z.unknown().optional(),
  items: z.object({ type: z.string() }).optional(),
});

export const WasmToolManifestSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9]*(?:[_-][a-z0-9]+)*$/),
  version: z.string(),
  description: z.string(),
  parameters: z.object({
    type: z.literal('object'),
    properties: z.record(ParameterDefinitionSchema),
    required: z.array(z.string()).optional(),
  }),
  returns: z.object({
    type: z.enum(['string', 'object']),
    description: z.string(),
  }),
  execution: z.object({
    argStyle: z.enum(['cli', 'json', 'positional']),
    fileAccess: z.enum(['none', 'read', 'write', 'readwrite']),
    memoryLimit: z.number().optional(),
    timeout: z.number().optional(),
  }),
  category: z.string(),
  author: z.string().optional(),
  license: z.string().optional(),
  homepage: z.string().optional(),
});
```

#### 1.2 IndexedDB Storage (`src/wasm-tools/storage.ts`)

Extend the existing storage system with a new object store.

```typescript
// Add to existing storage.ts or create new file
const WASM_TOOLS_STORE = 'wasm-tools';

export class WasmToolStorage {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    // Upgrade DB version, add wasm-tools store
  }

  async saveTool(tool: StoredWasmTool): Promise<void> { }
  async getTool(id: string): Promise<StoredWasmTool | null> { }
  async getAllTools(): Promise<StoredWasmTool[]> { }
  async deleteTool(id: string): Promise<void> { }
  async getToolByName(name: string): Promise<StoredWasmTool | null> { }
}
```

#### 1.3 Virtual File System (`src/wasm-tools/vfs.ts`)

Bridge between WASM and the real file system.

```typescript
export class VirtualFileSystem {
  private fileSystem: FileSystemManager;
  private memoryFiles: Map<string, Uint8Array>;

  constructor(fileSystem: FileSystemManager) {
    this.fileSystem = fileSystem;
    this.memoryFiles = new Map();
  }

  // WASI-compatible file operations (for paths opened via path_open)
  async readFile(path: string): Promise<Uint8Array> { }
  async writeFile(path: string, data: Uint8Array): Promise<void> { }
  async stat(path: string): Promise<FileStat> { }
  async readdir(path: string): Promise<string[]> { }

  // Memory file operations for standard I/O streams.
  // These buffers are mapped to WASI file descriptors in the runtime:
  // - stdin  (fd 0): fd_read reads from the stdin buffer
  // - stdout (fd 1): fd_write appends to the stdout buffer
  // - stderr (fd 2): fd_write appends to the stderr buffer
  setStdin(data: Uint8Array): void { }
  getStdout(): Uint8Array { }
  getStderr(): Uint8Array { }
}
```

#### 1.4 WASM Runtime (`src/wasm-tools/runtime.ts`)

Execute WASM modules with proper I/O handling.

```typescript
export class WasmRuntime {
  private vfs: VirtualFileSystem;

  async execute(
    wasmBinary: ArrayBuffer,
    args: string[],
    options: ExecutionOptions
  ): Promise<ExecutionResult> {
    // 1. Create WASM instance with imports
    // 2. Set up memory and file descriptors (fd 0=stdin, 1=stdout, 2=stderr)
    // 3. Call WASI entry point _start() (which will call main() if present)
    // 4. Capture stdout/stderr from VFS buffers
    // 5. Return result
  }

  private createImports(vfs: VirtualFileSystem): WebAssembly.Imports {
    // WASI-like imports for file I/O
    return {
      wasi_snapshot_preview1: {
        fd_read: ...,
        fd_write: ...,
        fd_close: ...,
        path_open: ...,
        // etc.
      }
    };
  }
}
```

#### 1.5 Tool Loader (`src/wasm-tools/loader.ts`)

Load tools from ZIP packages. Uses [JSZip](https://stuk.github.io/jszip/) for ZIP extraction (add to package.json dependencies).

```typescript
import JSZip from 'jszip';

// Security limits for ZIP validation
const MAX_ZIP_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_FILE_COUNT = 100;
const MAX_WASM_SIZE = 20 * 1024 * 1024; // 20 MB

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

      if (normalizedName.endsWith('manifest.json')) {
        if (manifestFile !== null) {
          throw new Error('WASM tool ZIP must contain exactly one manifest.json file');
        }
        manifestFile = entry;
        continue;
      }

      if (normalizedName.endsWith('.wasm')) {
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
    const manifestRaw = JSON.parse(manifestText);

    // Validate manifest against schema
    const manifest = WasmToolManifestSchema.parse(manifestRaw);

    // 6. Load the WASM binary with size validation
    const wasmBinary = await wasmFile.async('arraybuffer');
    if (wasmBinary.byteLength > MAX_WASM_SIZE) {
      throw new Error(`WASM binary exceeds maximum size of ${MAX_WASM_SIZE / 1024 / 1024} MB`);
    }

    // 7. Return parsed data
    return { manifest, wasmBinary };
  }

  async loadBuiltinTools(): Promise<StoredWasmTool[]> {
    // Load from bundled assets
  }
}
```

### Phase 2: Tool Manager

#### 2.1 Main Manager (`src/wasm-tools/manager.ts`)

Central orchestration of WASM tools.

```typescript
import { tool, Tool } from 'ai';
import { z } from 'zod';

export class WasmToolManager {
  private storage: WasmToolStorage;
  private runtime: WasmRuntime;
  private loader: WasmToolLoader;
  private tools: Map<string, StoredWasmTool>;

  async init(): Promise<void> {
    // 1. Initialize storage
    // 2. Load all stored tools
    // 3. Load built-in tools if not present
  }

  async installTool(zipFile: File): Promise<StoredWasmTool> {
    // 1. Load and validate ZIP
    // 2. Check for conflicts
    // 3. Store in IndexedDB
    // 4. Add to in-memory cache
  }

  async uninstallTool(id: string): Promise<void> { }

  async enableTool(id: string): Promise<void> { }
  async disableTool(id: string): Promise<void> { }

  // Convert to Vercel AI SDK tools
  getAITools(): Record<string, Tool> {
    const aiTools: Record<string, Tool> = {};

    for (const [name, storedTool] of this.tools) {
      if (!storedTool.enabled) continue;

      aiTools[`wasm_${name}`] = this.createAITool(storedTool);
    }

    return aiTools;
  }

  private createAITool(storedTool: StoredWasmTool): Tool {
    const manifest = storedTool.manifest;

    // Convert manifest parameters to Zod schema
    const zodSchema = this.manifestToZod(manifest.parameters);

    return tool({
      description: manifest.description,
      parameters: zodSchema,
      execute: async (args) => {
        return this.executeTool(storedTool, args);
      },
    });
  }

  /**
   * Execute a tool by name. Public method for testing and direct invocation.
   */
  async executeTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    const storedTool = this.tools.get(toolName);
    if (!storedTool) {
      throw new Error(`Tool not found: ${toolName}`);
    }
    return this.executeToolInternal(storedTool, args);
  }

  private async executeToolInternal(
    storedTool: StoredWasmTool,
    args: Record<string, unknown>
  ): Promise<unknown> {
    const { manifest } = storedTool;

    // 1. Check permissions
    const allowed = await checkWasmPermission(manifest.name, args);
    if (!allowed) {
      return { error: 'Permission denied' };
    }

    // 2. Convert args based on argStyle
    const cliArgs = this.convertArgsToCliFormat(manifest, args);

    // 3. Set up VFS with file system access
    const vfs = new VirtualFileSystem(fileSystemManager);

    // 4. Run WASM
    const result = await this.runtime.execute(storedTool.wasmBinary, cliArgs, {
      timeout: manifest.execution.timeout ?? 30000,
      memoryLimit: manifest.execution.memoryLimit,
      fileAccess: manifest.execution.fileAccess,
      vfs,
    });

    // 5. Return result
    return {
      success: result.exitCode === 0,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
    };
  }

  /**
   * Convert arguments to CLI format based on the manifest's argStyle.
   *
   * - "cli": Convert to flags, e.g., {mode: "encode", input: "test"} → ["--mode", "encode", "--input", "test"]
   * - "positional": Convert to ordered arguments based on 'required' order, e.g., ["encode", "test"]
   * - "json": Pass args as JSON string via stdin (returns empty array, args passed via VFS stdin)
   */
  private convertArgsToCliFormat(
    manifest: WasmToolManifest,
    args: Record<string, unknown>
  ): string[] {
    const { argStyle } = manifest.execution;

    switch (argStyle) {
      case 'cli': {
        // Convert to --key value pairs
        const result: string[] = [manifest.name];
        for (const [key, value] of Object.entries(args)) {
          if (value !== undefined && value !== null && value !== '') {
            result.push(`--${key}`, String(value));
          }
        }
        return result;
      }

      case 'positional': {
        // Use required fields order, then remaining properties
        const result: string[] = [manifest.name];
        const required = manifest.parameters.required ?? [];
        const seen = new Set<string>();

        // Add required args in order
        for (const key of required) {
          if (args[key] !== undefined) {
            result.push(String(args[key]));
            seen.add(key);
          }
        }

        // Add remaining args
        for (const [key, value] of Object.entries(args)) {
          if (!seen.has(key) && value !== undefined) {
            result.push(String(value));
          }
        }

        return result;
      }

      case 'json': {
        // Args passed via stdin; runtime will call vfs.setStdin(JSON.stringify(args))
        return [manifest.name];
      }

      default:
        throw new Error(`Unknown argStyle: ${argStyle}`);
    }
  }

  /**
   * Convert a JSON schema-like manifest definition into a Zod schema.
   */
  private manifestToZod(params: ManifestParameters): z.ZodObject<any> {
    const shape: Record<string, z.ZodTypeAny> = {};

    const properties = params.properties ?? {};
    const required: string[] = params.required ?? [];

    for (const [name, prop] of Object.entries(properties)) {
      let fieldSchema: z.ZodTypeAny;

      switch (prop.type) {
        case 'string': {
          if (Array.isArray(prop.enum) && prop.enum.length > 0) {
            // String enum -> z.enum
            const stringEnum = prop.enum.map(String) as [string, ...string[]];
            fieldSchema = z.enum(stringEnum);
          } else {
            fieldSchema = z.string();
          }
          break;
        }
        case 'number': {
          if (Array.isArray(prop.enum) && prop.enum.length > 0) {
            // Number enum -> union of literals
            const literals = prop.enum.map((v: number) => z.literal(v));
            fieldSchema = z.union(literals as [z.ZodLiteral<any>, z.ZodLiteral<any>, ...z.ZodLiteral<any>[]]);
          } else {
            fieldSchema = z.number();
          }
          break;
        }
        case 'boolean': {
          fieldSchema = z.boolean();
          break;
        }
        case 'array': {
          const items = prop.items ?? { type: 'string' };
          let itemSchema: z.ZodTypeAny;

          switch (items.type) {
            case 'string':
              itemSchema = z.string();
              break;
            case 'number':
              itemSchema = z.number();
              break;
            case 'boolean':
              itemSchema = z.boolean();
              break;
            default:
              itemSchema = z.any();
          }
          fieldSchema = z.array(itemSchema);
          break;
        }
        default: {
          // Fallback for unsupported/unknown types
          fieldSchema = z.any();
        }
      }

      // Apply default if provided
      if (prop.default !== undefined) {
        fieldSchema = fieldSchema.default(prop.default);
      }

      // Add description for AI SDK
      if (prop.description) {
        fieldSchema = fieldSchema.describe(prop.description);
      }

      // Handle optional vs required
      if (!required.includes(name)) {
        fieldSchema = fieldSchema.optional();
      }

      shape[name] = fieldSchema;
    }

    return z.object(shape);
  }
}
```

### Phase 3: Built-in Tool Registry

#### 3.1 Registry Definition (`src/wasm-tools/registry.ts`)

Define all 61 built-in tools.

```typescript
export interface BuiltinToolConfig {
  name: string;
  category: string;
  wasmUrl: string;      // URL to fetch WASM
  manifest: WasmToolManifest;
}

export const BUILTIN_TOOLS: BuiltinToolConfig[] = [
  // Text Processing - Low
  {
    name: 'grep',
    category: 'text',
    wasmUrl: 'wasm-tools/grep.wasm',
    manifest: {
      name: 'grep',
      version: '1.0.0',
      description: 'Search for patterns in text using regular expressions',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Regex pattern to search for' },
          input: { type: 'string', description: 'Text to search in (or file path)' },
          flags: { type: 'string', description: 'Flags: -i (ignore case), -v (invert), -n (line numbers)', default: '' },
        },
        required: ['pattern', 'input'],
      },
      returns: { type: 'string', description: 'Matching lines' },
      execution: { argStyle: 'cli', fileAccess: 'read', timeout: 30000 },
      category: 'text',
    },
  },
  // ... 60 more tools
];
```

### Phase 4: UI Integration

#### 4.1 Tool Management Modal

Add UI for viewing, installing, and managing WASM tools.

```html
<!-- In index.html -->
<div id="wasm-tools-modal" class="modal">
  <div class="modal-content">
    <div class="modal-header">
      <h2>WASM Tools</h2>
      <button class="close-button">&times;</button>
    </div>

    <div class="modal-body">
      <!-- Install new tool -->
      <div class="tool-install-section">
        <h3>Install Tool</h3>
        <input type="file" id="wasm-tool-upload" accept=".zip" />
        <button id="install-tool-btn">Install from ZIP</button>
      </div>

      <!-- Tool list by category -->
      <div class="tool-list-section">
        <h3>Installed Tools</h3>
        <div id="wasm-tool-list">
          <!-- Dynamically populated -->
        </div>
      </div>
    </div>
  </div>
</div>
```

#### 4.2 Permission Integration

Extend preferences to handle dynamic WASM tools.

```typescript
// In preferences.ts
export function getWasmToolPermission(toolName: string): PermissionLevel {
  const stored = localStorage.getItem(`wasm_tool_permission_${toolName}`);
  return (stored as PermissionLevel) || 'ask';
}

export function setWasmToolPermission(toolName: string, level: PermissionLevel): void {
  localStorage.setItem(`wasm_tool_permission_${toolName}`, level);
}
```

### Phase 5: AI Integration

#### 5.1 Merge Tools

Modify `ui.ts` to merge built-in and WASM tools.

```typescript
// In ui.ts
import { wasmToolManager } from './wasm-tools';

async function getAllTools(): Promise<Record<string, Tool>> {
  const wasmTools = wasmToolManager.getAITools();

  return {
    ...fileTools,      // Built-in file tools
    ...wasmTools,      // WASM tools (prefixed with wasm_)
  };
}

// Use in streamCompletion
const allTools = await getAllTools();
await aiManager.streamCompletion(prompt, messages, allTools, ...);
```

## Built-in Tools (61 Total)

> **Name collisions and migration strategy**
>
> Several of the tools listed in this plan (`grep`, `sort`, `uniq`, `wc`, `head`, `tail`, `tree`, `diff`) already exist as native TypeScript tools in `src/tools.ts`. To avoid runtime name conflicts:
>
> - The existing TypeScript implementations will remain registered under their current names (`grep`, `sort`, `uniq`, `wc`, `head`, `tail`, `tree`, `diff`) for the initial phase.
> - Corresponding WASM implementations will be registered under prefixed identifiers (e.g. `wasm_grep`, `wasm_sort`, `wasm_uniq`, `wasm_wc`, `wasm_head`, `wasm_tail`, `wasm_tree`, `wasm_diff`).
> - The AI/tooling layer may expose configuration to prefer the WASM or TypeScript backend, but that will be implemented as a separate routing decision rather than by reusing the same registry name.
>
> In other words, the tables below use the familiar CLI-style names for readability, but the actual tool registry will use `wasm_*` names for any WASM tool that has a conflicting TypeScript counterpart.

### Low Complexity (28 tools)

| Name | Category | Description |
|------|----------|-------------|
| grep | text | Search for patterns in text |
| cut | text | Extract columns/fields from text |
| sort | text | Sort lines alphabetically or numerically |
| uniq | text | Filter duplicate adjacent lines |
| tr | text | Translate or delete characters |
| wc | text | Count words, lines, characters |
| head | text | Output first N lines |
| tail | text | Output last N lines |
| gzip | compression | Compress data using gzip |
| gunzip | compression | Decompress gzip data |
| brotli | compression | Compress using Brotli algorithm |
| csvtool | data | CSV manipulation utilities |
| toml2json | data | Convert TOML to JSON |
| markdown | data | Convert Markdown to HTML |
| md5sum | crypto | Calculate MD5 hash |
| sha256sum | crypto | Calculate SHA-256 hash |
| sha512sum | crypto | Calculate SHA-512 hash |
| base64 | crypto | Encode/decode base64 |
| xxd | crypto | Create hex dump |
| file | file | Detect file type |
| tree | file | Display directory structure |
| du | file | Estimate file space usage |
| stat | file | Display file status |
| touch | file | Update file timestamps |
| truncate | file | Shrink or extend file size |
| jwt | data | Encode/decode JWT tokens |
| uuid | data | Generate UUIDs |

### Medium Complexity (33 tools)

| Name | Category | Description |
|------|----------|-------------|
| sed | text | Stream editor for text transformation |
| awk | text | Pattern scanning and processing |
| diff | text | Compare files line by line |
| patch | text | Apply diff patches |
| zip | compression | Create ZIP archives |
| unzip | compression | Extract ZIP archives |
| tar | compression | Archive files |
| xz | compression | LZMA compression |
| jq | data | JSON query and transform |
| yq | data | YAML query and transform |
| xmllint | data | XML validation and query |
| age | crypto | Modern file encryption |
| ffprobe | media | Extract media file metadata |
| optipng | media | Optimize PNG files |
| jpegoptim | media | Optimize JPEG files |
| svgo | media | Optimize SVG files |
| exiftool | media | Read/write image metadata |
| cwebp | media | Convert images to WebP |
| dwebp | media | Convert WebP to other formats |
| gif2webp | media | Convert GIF to WebP |
| clang-format | code | Format C/C++ code |
| shfmt | code | Format shell scripts |
| minify | code | Minify HTML/CSS/JS |
| terser | code | Minify JavaScript |
| csso | code | Optimize CSS |
| html-minifier | code | Minify HTML |
| pdftotext | docs | Extract text from PDF |
| qpdf | docs | PDF manipulation |
| asciidoctor | docs | AsciiDoc processor |
| sqlite3 | db | SQLite database queries |
| ripgrep | search | Fast regex search |
| ag | search | Silver searcher |
| fzf | search | Fuzzy finder |

## Example Tool Implementation

### base64 Tool (C Source)

```c
// wasm-tools/src/base64/main.c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static const char b64_table[] =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

void encode(const char* input) {
  size_t len = strlen(input);
  size_t i;

  for (i = 0; i < len; i += 3) {
    unsigned char b0 = input[i];
    unsigned char b1 = (i + 1 < len) ? input[i + 1] : 0;
    unsigned char b2 = (i + 2 < len) ? input[i + 2] : 0;

    putchar(b64_table[b0 >> 2]);
    putchar(b64_table[((b0 & 0x03) << 4) | (b1 >> 4)]);
    putchar((i + 1 < len) ? b64_table[((b1 & 0x0f) << 2) | (b2 >> 6)] : '=');
    putchar((i + 2 < len) ? b64_table[b2 & 0x3f] : '=');
  }
  putchar('\n');
}

// Reverse lookup table for base64 decoding
static int b64_decode_char(char c) {
  if (c >= 'A' && c <= 'Z') return c - 'A';
  if (c >= 'a' && c <= 'z') return c - 'a' + 26;
  if (c >= '0' && c <= '9') return c - '0' + 52;
  if (c == '+') return 62;
  if (c == '/') return 63;
  return -1; // Invalid character or padding
}

void decode(const char* input) {
  size_t len = strlen(input);
  size_t i;

  for (i = 0; i < len; i += 4) {
    int b0 = b64_decode_char(input[i]);
    int b1 = b64_decode_char(input[i + 1]);
    int b2 = (i + 2 < len && input[i + 2] != '=') ? b64_decode_char(input[i + 2]) : 0;
    int b3 = (i + 3 < len && input[i + 3] != '=') ? b64_decode_char(input[i + 3]) : 0;

    if (b0 < 0 || b1 < 0) break; // Invalid input

    putchar((b0 << 2) | (b1 >> 4));
    if (i + 2 < len && input[i + 2] != '=') {
      putchar(((b1 & 0x0f) << 4) | (b2 >> 2));
    }
    if (i + 3 < len && input[i + 3] != '=') {
      putchar(((b2 & 0x03) << 6) | b3);
    }
  }
  putchar('\n');
}

int main(int argc, char** argv) {
  if (argc < 3) {
    fprintf(stderr, "Usage: base64 <encode|decode> <input>\n");
    return 1;
  }

  if (strcmp(argv[1], "encode") == 0) {
    encode(argv[2]);
  } else if (strcmp(argv[1], "decode") == 0) {
    decode(argv[2]);
  } else {
    fprintf(stderr, "Unknown mode: %s\n", argv[1]);
    return 1;
  }

  return 0;
}
```

### base64 Manifest

```json
{
  "name": "base64",
  "version": "1.0.0",
  "description": "Encode or decode data using Base64 encoding. Use 'encode' to convert text to Base64, or 'decode' to convert Base64 back to text.",
  "parameters": {
    "type": "object",
    "properties": {
      "mode": {
        "type": "string",
        "enum": ["encode", "decode"],
        "description": "Whether to encode or decode"
      },
      "input": {
        "type": "string",
        "description": "The text to encode, or base64 string to decode"
      }
    },
    "required": ["mode", "input"]
  },
  "returns": {
    "type": "string",
    "description": "The encoded or decoded result"
  },
  "execution": {
    "argStyle": "positional",
    "fileAccess": "none",
    "timeout": 5000
  },
  "category": "crypto",
  "author": "Co-do",
  "license": "MIT"
}
```

### Build Script (Makefile)

```makefile
# wasm-tools/src/base64/Makefile
CC = clang
CFLAGS = --target=wasm32-wasi -O2
# Note: Do NOT use --no-entry for WASI programs with main().
# WASI programs export _start as the entry point, which calls main().
LDFLAGS = -Wl,--export-all

all: base64.wasm

base64.wasm: main.c
	$(CC) $(CFLAGS) $(LDFLAGS) -o $@ $<

clean:
	rm -f base64.wasm
```

## Testing Strategy

### Unit Tests

```typescript
// tests/wasm-tools/loader.spec.ts
describe('WasmToolLoader', () => {
  test('loads valid ZIP package', async () => {
    const loader = new WasmToolLoader();
    const zip = createTestZip('base64.wasm', manifest);
    const result = await loader.loadFromZip(zip);
    expect(result.manifest.name).toBe('base64');
  });

  test('rejects invalid manifest', async () => {
    const loader = new WasmToolLoader();
    const zip = createTestZip('test.wasm', { invalid: true });
    await expect(loader.loadFromZip(zip)).rejects.toThrow();
  });
});
```

### Integration Tests

```typescript
// tests/wasm-tools/execution.spec.ts
describe('WASM Tool Execution', () => {
  test('base64 encode works', async () => {
    const manager = new WasmToolManager();
    await manager.init();

    const result = await manager.executeTool('base64', {
      mode: 'encode',
      input: 'Hello, World!',
    });

    expect(result).toBe('SGVsbG8sIFdvcmxkIQ==');
  });
});
```

## Security Considerations

1. **Sandboxed Execution**: WASM runs in a sandboxed environment with no direct system access
2. **Memory Limits**: Enforce memory limits per tool (configurable in manifest)
3. **Timeout**: Kill long-running tools (default 30s, configurable in manifest)
4. **File Access Control**: VFS mediates all file operations, respecting `fileAccess` manifest setting
5. **Permission System**: User must approve tool execution (permission levels: always, ask, never)
6. **Source Validation**: Only accept tools from trusted sources initially; define a clear policy for which ZIP packages are allowed (e.g., signed or coming from an approved registry)
7. **ZIP & WASM Validation (WasmToolLoader)**: When installing user tools from ZIP archives, `WasmToolLoader` enforces:
   - **Maximum ZIP Size**: Reject archives larger than 50 MB to prevent memory exhaustion
   - **Maximum File Count**: Reject archives containing more than 100 entries to mitigate ZIP bomb-style attacks
   - **Path Traversal Protection**: Validate all entry paths on extraction so that no file can escape the designated tools directory (disallow `..`, absolute paths)
   - **WASM Binary Size Limits**: Enforce an upper bound of 20 MB on each `.wasm` file extracted from the ZIP

## Migration Path

### Database Version Upgrade

```typescript
// In storage.ts
const DB_VERSION = 4; // Bump from 3

function upgradeDB(db: IDBDatabase, oldVersion: number, transaction: IDBTransaction) {
  // Preserve existing migrations for earlier versions
  if (oldVersion < 2) {
    // v1 -> v2 migration logic (existing; do not remove)
    // e.g. db.createObjectStore('provider-configs', { keyPath: 'id' });
  }

  if (oldVersion < 3) {
    // v2 -> v3 migration logic (existing; do not remove)
    // e.g. db.createObjectStore('conversations', { keyPath: 'id' });
  }

  // v3 -> v4 migration: Add WASM tools store
  if (oldVersion < 4) {
    if (!db.objectStoreNames.contains('wasm-tools')) {
      db.createObjectStore('wasm-tools', { keyPath: 'id' });
    }
  }
}
```

## Timeline Estimate

This is a significant feature. Implementation phases:

1. **Phase 1 (Core Infrastructure)**: Types, storage, VFS, runtime, loader
2. **Phase 2 (Tool Manager)**: Manager class, AI tool integration
3. **Phase 3 (Built-in Registry)**: Define and bundle 61 tools
4. **Phase 4 (UI)**: Tool management modal, permissions
5. **Phase 5 (Testing)**: Unit and integration tests

## Open Questions

1. **WASI Version**: Should we target WASI preview1 or preview2?
2. **Existing Tools**: Some tools (grep, wc, etc.) exist as built-in. Keep both or replace?
3. **Tool Versioning**: How to handle updates to built-in tools?
4. **Bundle Size**: Pre-bundle WASM or fetch on demand?

## Next Steps

1. Review and approve this plan
2. Create the directory structure
3. Implement Phase 1 (core infrastructure)
4. Build 2-3 example C tools as proof of concept
5. Iterate based on testing
