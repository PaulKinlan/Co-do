# WebAssembly Custom Tools Implementation Plan

## Overview

This document outlines the implementation plan for adding WebAssembly-based custom tools to Co-do. The system will allow:

1. **Built-in WASM tools** - 59 pre-packaged CLI-style utilities
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
  name: z.string().regex(/^[a-z][a-z0-9_-]*$/),
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

  // WASI-compatible file operations
  async readFile(path: string): Promise<Uint8Array> { }
  async writeFile(path: string, data: Uint8Array): Promise<void> { }
  async stat(path: string): Promise<FileStat> { }
  async readdir(path: string): Promise<string[]> { }

  // Memory file operations (for stdin/stdout/temp)
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
    // 2. Set up memory and file descriptors
    // 3. Call _start or main function
    // 4. Capture stdout/stderr
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

Load tools from ZIP packages.

```typescript
export class WasmToolLoader {
  async loadFromZip(zipFile: File): Promise<{
    manifest: WasmToolManifest;
    wasmBinary: ArrayBuffer;
  }> {
    // 1. Unzip the file
    // 2. Find manifest.json and *.wasm
    // 3. Validate manifest
    // 4. Return parsed data
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

  private async executeTool(
    storedTool: StoredWasmTool,
    args: Record<string, unknown>
  ): Promise<unknown> {
    // 1. Check permissions
    // 2. Convert args to CLI format
    // 3. Set up VFS with file system access
    // 4. Run WASM
    // 5. Return result
  }

  private manifestToZod(params: ManifestParameters): z.ZodObject<any> {
    // Convert JSON schema-like manifest to Zod schema
  }
}
```

### Phase 3: Built-in Tool Registry

#### 3.1 Registry Definition (`src/wasm-tools/registry.ts`)

Define all 59 built-in tools.

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
    wasmUrl: '/wasm-tools/grep.wasm',
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
  // ... 58 more tools
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

## Built-in Tools (59 Total)

### Low Complexity (27 tools)

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
| zstd | compression | Compress using Zstandard |
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

### Medium Complexity (32 tools)

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

void decode(const char* input) {
  // Decoding implementation
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
LDFLAGS = -Wl,--export-all -Wl,--no-entry

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

1. **Sandboxed Execution**: WASM runs in a sandboxed environment
2. **Memory Limits**: Enforce memory limits per tool
3. **Timeout**: Kill long-running tools
4. **File Access Control**: VFS mediates all file operations
5. **Permission System**: User must approve tool execution
6. **Source Validation**: Only accept tools from trusted sources initially

## Migration Path

### Database Version Upgrade

```typescript
// In storage.ts
const DB_VERSION = 4; // Bump from 3

function upgradeDB(db: IDBDatabase, oldVersion: number) {
  if (oldVersion < 4) {
    db.createObjectStore('wasm-tools', { keyPath: 'id' });
  }
}
```

## Timeline Estimate

This is a significant feature. Implementation phases:

1. **Phase 1 (Core Infrastructure)**: Types, storage, VFS, runtime, loader
2. **Phase 2 (Tool Manager)**: Manager class, AI tool integration
3. **Phase 3 (Built-in Registry)**: Define and bundle 59 tools
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
