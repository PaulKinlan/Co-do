# WASM Tools Library Dependencies

This document tracks which tools use real libraries vs simplified implementations.

## Tools Using Real Libraries (Recommended)

These tools should be built from their official source code using WASI SDK:

### Database
| Tool | Library | Source | Build Notes |
|------|---------|--------|-------------|
| sqlite3 | SQLite | https://sqlite.org/wasm | Official WASM build available |

### Compression
| Tool | Library | Source | Build Notes |
|------|---------|--------|-------------|
| gzip/gunzip | zlib | https://github.com/nicknisi/zlib-wasm | Compile with WASI SDK |
| brotli | brotli | https://github.com/nicknisi/brotli-wasm | Official library |
| zstd | zstd | https://github.com/nicknisi/zstd-wasm | Official library |
| xz | liblzma | https://tukaani.org/xz/ | Part of XZ Utils |

### Archive
| Tool | Library | Source | Build Notes |
|------|---------|--------|-------------|
| tar | libarchive | https://github.com/nicknisi/libarchive-wasm | Multi-format support |
| zip/unzip | libarchive | https://github.com/nicknisi/libarchive-wasm | Or use minizip |

### JSON/Data
| Tool | Library | Source | Build Notes |
|------|---------|--------|-------------|
| jq | jq | https://github.com/nicknisi/jq-wasm | Compile with WASI SDK |
| yq | yq | https://github.com/mikefarah/yq | Go-based, needs TinyGo |

### Media (Heavy - Load on Demand)
| Tool | Library | Source | Build Notes |
|------|---------|--------|-------------|
| ffprobe | FFmpeg | https://github.com/nicknisi/ffmpeg.wasm | Large binary, lazy load |
| cwebp/dwebp | libwebp | https://chromium.googlesource.com/webm/libwebp | WebP official |
| optipng | OptiPNG | https://optipng.sourceforge.net/ | PNG optimizer |
| jpegoptim | jpegoptim | https://github.com/nicknisi/jpegoptim | JPEG optimizer |
| gif2webp | giflib + libwebp | Multiple | Combine libraries |

### Text Search
| Tool | Library | Source | Build Notes |
|------|---------|--------|-------------|
| ripgrep | ripgrep | https://github.com/nicknisi/ripgrep | Rust, compile with wasm32-wasi |

### Encryption
| Tool | Library | Source | Build Notes |
|------|---------|--------|-------------|
| age | age | https://github.com/nicknisi/age | Go-based, needs TinyGo |

### Code Formatting
| Tool | Library | Source | Build Notes |
|------|---------|--------|-------------|
| clang-format | LLVM | Complex | Very large, consider alternatives |
| shfmt | shfmt | https://github.com/mvdan/sh | Go-based |
| terser | terser | https://terser.org/ | JS-based, run in worker |

## Tools with Simple Native Implementations (OK to keep)

These are simple enough that a native C implementation is appropriate:

### Text Processing
- **wc** - Word/line/char counting (trivial algorithm)
- **head/tail** - First/last N lines (trivial)
- **cut** - Column extraction (trivial)
- **sort** - Sorting lines (standard algorithm)
- **uniq** - Adjacent duplicates (trivial)
- **tr** - Character translation (trivial)
- **grep** - Basic pattern matching (simple)

### Encoding/Hashing
- **base64** - Standard algorithm, no library needed
- **xxd** - Hex dump (trivial)
- **md5sum** - MD5 algorithm (well-defined, 100 lines)
- **sha256sum** - SHA-256 algorithm (well-defined)
- **sha512sum** - SHA-512 algorithm (well-defined)
- **uuid** - UUID v4 generation (simple random)

### Data Format Conversion
- **toml2json** - TOML parsing (manageable)
- **markdown** - MD to HTML (simplified OK for basic use)
- **csvtool** - CSV processing (simple)

### File Utilities
- **file** - Magic number detection (lookup table)
- **stat** - File info display (format output)
- **du** - Size calculation (format output)
- **tree** - Directory tree (string formatting)
- **touch/truncate** - File operations (output commands)

## Build Instructions

### Using WASI SDK

```bash
# Install WASI SDK
export WASI_SDK_PATH=/opt/wasi-sdk

# Build a tool from source
cd /path/to/tool/source
$WASI_SDK_PATH/bin/clang \
  --target=wasm32-wasi \
  --sysroot=$WASI_SDK_PATH/share/wasi-sysroot \
  -O2 \
  -o tool.wasm \
  source.c
```

### Using Pre-built WASM Libraries

For tools like SQLite, FFmpeg, etc., use their official WASM distributions:

```javascript
// Example: Using sql.js (SQLite WASM)
import initSqlJs from 'sql.js';

const SQL = await initSqlJs();
const db = new SQL.Database();
```

### Fetching Real Libraries

The build script will download pre-built WASM binaries where available:

```bash
# Download official SQLite WASM
curl -L -o sqlite3.wasm https://example.com/sqlite3.wasm

# Download jq WASM
curl -L -o jq.wasm https://example.com/jq.wasm
```

## Future Considerations

1. **FFmpeg** - Load on demand due to size (~25MB)
2. **ImageMagick** - Alternative to individual image tools
3. **Pandoc** - Universal document converter (Haskell, complex)
4. **ripgrep** - Rust compilation to WASM is possible but needs setup

## Version Tracking

Track library versions for security updates:

| Library | Version | Last Updated | CVE Check |
|---------|---------|--------------|-----------|
| SQLite | 3.44.0 | 2024-01-01 | ✓ |
| zlib | 1.3 | 2024-01-01 | ✓ |
| jq | 1.7 | 2024-01-01 | ✓ |

## Contributing

When adding a new tool:
1. First check if a maintained WASM build exists
2. If not, check if the official source compiles with WASI SDK
3. Only implement from scratch if the algorithm is trivial
4. Document the source and version in this file
