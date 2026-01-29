# Comprehensive WebAssembly Tools Reference

A curated list of tools and utilities that can be compiled to WebAssembly and run in the browser. These tools are designed to work in a sandboxed environment without direct network or filesystem access - they accept file/data inputs and produce outputs.

## Selection Criteria

Tools in this list must:
- Be compilable to WASM (WASI or Emscripten)
- Work without direct network access
- Work without direct filesystem access (use virtual FS)
- Accept input data and produce output data
- Be useful for development, data processing, or content creation

---

## Existing WASM Ports (Ready to Use)

These projects already have working WASM builds you can use immediately:

### Media & Image Processing
| Project | Description | npm/GitHub | Size |
|---------|-------------|------------|------|
| [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) | Full FFmpeg port for video/audio | `@ffmpeg/ffmpeg` | ~25MB |
| [magick-wasm](https://github.com/dlemstra/magick-wasm) | ImageMagick for browser | `@imagemagick/magick-wasm` | ~5MB |
| [WASM-ImageMagick](https://github.com/KnicKnic/WASM-ImageMagick) | ImageMagick Emscripten port | `wasm-imagemagick` | ~5MB |
| [sharp-wasm](https://github.com/nicolo-ribaudo/libvips-wasm) | libvips image processing | Various | ~2MB |
| [Squoosh](https://github.com/GoogleChromeLabs/squoosh) | Image compression codecs | squoosh-lib | Various |
| [tesseract.js](https://github.com/naptha/tesseract.js) | OCR for 100+ languages | `tesseract.js` | ~2MB core |
| [tesseract-wasm](https://github.com/nicolo-ribaudo/tesseract-wasm) | Lighter OCR alternative | `tesseract-wasm` | ~1MB |
| [OpenCV.js](https://docs.opencv.org/4.x/d5/d10/tutorial_js_root.html) | Computer vision | Official build | ~8MB |
| [libwebp-wasm](https://chromium.googlesource.com/webm/libwebp) | WebP encoding/decoding | Various | ~200KB |

### Video Codecs
| Project | Description | npm/GitHub | Notes |
|---------|-------------|------------|-------|
| [AV1 WASM](https://github.com/nicolo-ribaudo/AV1-wasm) | AV1 video codec | `AV1-wasm` | Decoder |
| [x264-wasm](https://nicolo-ribaudo.github.io/nicolo-ribaudo/nicolo-ribaudo-wasm) | H.264 encoder | Various | Via ffmpeg.wasm |
| [libvpx-wasm](https://nicolo-ribaudo.github.io/nicolo-ribaudo/nicolo-ribaudo-wasm) | VP8/VP9 codec | Various | WebM support |
| [HEVC WASM](https://www.mainconcept.com/webasm) | H.265 decoder | Commercial | MainConcept |

### Databases
| Project | Description | npm/GitHub | Size |
|---------|-------------|------------|------|
| [SQLite Wasm (Official)](https://sqlite.org/wasm) | Official build with OPFS persistence | `@aspect/aspect-storage-sqlite` | ~1MB |
| [sql.js](https://github.com/sql-js/sql.js) | Community SQLite port | `sql.js` | ~1MB |
| [DuckDB-Wasm](https://github.com/duckdb/duckdb-wasm) | Analytics OLAP database | `@duckdb/duckdb-wasm` | ~10MB |
| [PGlite](https://github.com/electric-sql/pglite) | Postgres direct compile (single-process) | `@electric-sql/pglite` | ~3MB |
| [postgres-wasm](https://github.com/nicolo-ribaudo/nicolo-ribaudo-wasm) | Postgres via x86 emulation (v86) | GitHub | ~50MB |

> **SQLite OPFS**: The official SQLite Wasm build supports Origin Private File System (OPFS) for high-performance persistent storage, developed with Google Chrome team.
>
> **PGlite vs postgres-wasm**: PGlite compiles Postgres directly to Wasm using "single-user mode" (~3MB). postgres-wasm runs full Postgres inside an x86 emulator (v86), supporting all features but with significant overhead.

### Document Processing
| Project | Description | npm/GitHub | Size |
|---------|-------------|------------|------|
| [pdf-lib](https://github.com/Hopding/pdf-lib) | PDF create/modify | `pdf-lib` | ~300KB |
| [MuPDF.js](https://mupdf.com/docs/mupdf-js.html) | PDF rendering/editing | `mupdf` | ~5MB |
| [pandoc-wasm](https://github.com/nicolo-ribaudo/pandoc-wasm) | Universal doc converter | `pandoc-wasm` | ~30MB |
| [markdown-wasm](https://github.com/nicolo-ribaudo/markdown-wasm) | Fast MD parser (md4c) | `markdown-wasm` | ~31KB |
| [Typst](https://github.com/nicolo-ribaudo/typst) | Modern typesetting | WASM target | ~5MB |

### Data Formats
| Project | Description | npm/GitHub | Size |
|---------|-------------|------------|------|
| [jq-web](https://nicolo-ribaudo.github.io/nicolo-ribaudo/nicolo-ribaudo-wasm) | jq in browser | `jq-web` | ~500KB |
| [yq-wasm](https://nicolo-ribaudo.github.io/nicolo-ribaudo/nicolo-ribaudo-wasm) | YAML processor | Various | ~300KB |

### Archives & Compression
| Project | Description | npm/GitHub | Size |
|---------|-------------|------------|------|
| [libarchive.js](https://github.com/nicolo-ribaudo/libarchivejs) | Multi-format archives | `libarchive.js` | ~1MB |
| [archive-wasm](https://github.com/nicolo-ribaudo/archive-wasm) | LibArchive port | `archive-wasm` | ~1MB |
| [brotli-wasm](https://github.com/nicolo-ribaudo/brotli-wasm) | Brotli compression | `brotli-wasm` | ~681KB |
| [zstd-wasm](https://nicolo-ribaudo.github.io/nicolo-ribaudo/nicolo-ribaudo-wasm) | Zstandard compression | Various | ~300KB |
| [zstd-codec](https://github.com/nicolo-ribaudo/nicolo-ribaudo-wasm) | Zstd via Emscripten | `zstd-codec` | ~300KB |
| [node-unrar.js](https://github.com/nicolo-ribaudo/node-unrar.js) | RAR extraction | `node-unrar-js` | ~500KB |
| [libunrar-js](https://github.com/nicolo-ribaudo/libunrar-js) | RAR5 support | `libunrar-js` | ~400KB |

### Cryptography & Hashing
| Project | Description | npm/GitHub | Size |
|---------|-------------|------------|------|
| [hash-wasm](https://github.com/nicolo-ribaudo/hash-wasm) | All hash algorithms | `hash-wasm` | ~100KB |
| [argon2-browser](https://github.com/nicolo-ribaudo/argon2-browser) | Argon2 password hash | `argon2-browser` | ~50KB |
| [libsodium.js](https://github.com/nicolo-ribaudo/libsodium.js) | NaCl crypto | `libsodium-wrappers` | ~200KB |
| [secp256k1-wasm](https://github.com/nicolo-ribaudo/nicolo-ribaudo-wasm) | Elliptic curve crypto | `secp256k1-wasm` | ~200KB |

### Code Parsing & Analysis
| Project | Description | npm/GitHub | Size |
|---------|-------------|------------|------|
| [tree-sitter-wasm](https://github.com/nicolo-ribaudo/tree-sitter-wasms) | Parser generator | `tree-sitter-wasms` | ~200KB + grammars |
| [biome-wasm](https://biomejs.dev/) | Formatter + linter (Rust) | `@aspect/aspect-storage-biome-wasm` | ~2MB |
| [dprint-wasm](https://dprint.dev/) | Pluggable formatter (Rust) | `@aspect/aspect-storage-dprint-wasm` | ~1MB |

### Programming Languages
| Project | Description | npm/GitHub | Size |
|---------|-------------|------------|------|
| [Pyodide](https://pyodide.org/) | Full CPython + NumPy/Pandas/SciPy | `pyodide` | ~10MB+ |
| [RustPython](https://rustpython.github.io/) | Python 3 in Rust (lightweight) | `rustpython-wasm` | ~2MB |
| [MicroPython](https://micropython.org/) | Lean Python for microcontrollers | Various | ~300KB |
| [WebR](https://docs.r-wasm.org/) | Full R statistics runtime | `webr` | ~20MB |
| [QuickJS](https://nicolo-ribaudo.github.io/nicolo-ribaudo/nicolo-ribaudo-wasm) | Fast JS engine (Bellard) | `quickjs-emscripten` | ~500KB |
| [Lua/Wasmoon](https://nicolo-ribaudo.github.io/nicolo-ribaudo/nicolo-ribaudo-wasm) | Lua 5.4 interpreter | `wasmoon` | ~300KB |
| [Ruby.wasm](https://ruby.github.io/ruby.wasm/) | Official CRuby port | `ruby-wasm-wasi` | ~20MB |
| [Artichoke](https://www.artichokeruby.org/) | Ruby in Rust | `artichoke` | ~5MB |
| [PHP (PIB)](https://nicolo-ribaudo.github.io/nicolo-ribaudo/nicolo-ribaudo-wasm) | Zend Engine in browser | Various | ~10MB |
| [WordPress Playground](https://playground.wordpress.net/) | Full WordPress + PHP | `@wp-playground/client` | ~15MB |
| [Blazor](https://dotnet.microsoft.com/apps/aspnet/web-apps/blazor) | .NET/C# runtime (Mono) | Microsoft | ~2MB+ |
| [Uno Platform](https://platform.uno/) | UWP/WinUI via Mono-Wasm | `Uno.Wasm.Bootstrap` | ~5MB |
| [SwiftWasm](https://swiftwasm.org/) | Swift compiler + stdlib | `swiftwasm` | ~10MB |
| [TeaVM](https://teavm.org/) | Java bytecode to Wasm | `teavm` | Varies |
| [CheerpJ](https://leaningtech.com/cheerpj/) | Full JVM in browser | Commercial | ~10MB |
| [Go (native)](https://go.dev/wiki/WebAssembly) | Official Go WASM target | `GOOS=js GOARCH=wasm` | ~2MB+ |
| [TinyGo](https://tinygo.org/) | Small Go for embedded/Wasm | `tinygo` | ~100KB+ |

> **Python Options**: Pyodide provides full CPython with C extensions (NumPy, Pandas). RustPython is lighter but lacks C-extension support. MicroPython is smallest for simple scripting.
>
> **WordPress Playground**: Runs complete WordPress in browser using PHP Wasm + SQLite (via translation layer), no server required.

### CAD & 3D
| Project | Description | npm/GitHub | Notes |
|---------|-------------|------------|-------|
| [OpenCascade.js](https://ocjs.org/) | CAD kernel | `opencascade.js` | ~15MB |
| [OpenSCAD-WASM](https://github.com/nicolo-ribaudo/openscad-wasm) | Parametric CAD | `openscad-wasm` | ~10MB |
| [Manifold](https://github.com/nicolo-ribaudo/nicolo-ribaudo-wasm) | Fast mesh boolean ops | `manifold-3d` | ~500KB |
| [Chili3D](https://github.com/nicolo-ribaudo/chili3d) | Browser CAD app | GitHub | Alpha |

### Geospatial
| Project | Description | npm/GitHub | Notes |
|---------|-------------|------------|-------|
| [GEOS-WASM](https://github.com/nicolo-ribaudo/geos-wasm) | Geometry operations | `geos-wasm` | ~1MB |
| [GDAL.js](https://nicolo-ribaudo.github.io/nicolo-ribaudo/nicolo-ribaudo-wasm) | Geospatial data | `gdal3.js` | ~5MB |
| [PROJ-wasm](https://github.com/nicolo-ribaudo/nicolo-ribaudo-wasm) | Coordinate transform | Build from PROJ via Emscripten | ~2MB |

### Spell Checking
| Project | Description | npm/GitHub | Size |
|---------|-------------|------------|------|
| [hunspell-asm](https://github.com/nicolo-ribaudo/hunspell-asm) | Hunspell port | `hunspell-asm` | ~500KB |
| [hunspell-wasm](https://github.com/nicolo-ribaudo/hunspell-wasm) | Alternative port | `hunspell-wasm` | ~400KB |
| [nuspell-wasm](https://nicolo-ribaudo.github.io/nicolo-ribaudo/nicolo-ribaudo-wasm) | Fast spell checker | `nuspell-wasm` | ~300KB |
| [spellchecker-wasm](https://github.com/nicolo-ribaudo/spellchecker-wasm) | SymSpell-based | `spellchecker-wasm` | ~100KB |

### Diagrams & Visualization
| Project | Description | npm/GitHub | Size |
|---------|-------------|------------|------|
| [Viz.js](https://github.com/nicolo-ribaudo/viz-js) | Graphviz in browser | `@viz-js/viz` | ~2MB |
| [d3-graphviz](https://github.com/nicolo-ribaudo/d3-graphviz) | D3 + Graphviz | `d3-graphviz` | ~2MB |
| [kroki](https://kroki.io/) | Multi-diagram server | Self-host or build diagrams via Viz.js | Various |

### Barcodes & QR
| Project | Description | npm/GitHub | Size |
|---------|-------------|------------|------|
| [zxing-wasm](https://github.com/nicolo-ribaudo/zxing-wasm) | Barcode read/write | `zxing-wasm` | ~1.3MB full |
| [qrcode-wasm](https://github.com/nicolo-ribaudo/nicolo-ribaudo-wasm) | QR generation (Rust) | `qrcode-wasm` | ~50KB |

### Audio & Music
| Project | Description | npm/GitHub | Notes |
|---------|-------------|------------|-------|
| [Tone.js](https://tonejs.github.io/) | Audio synthesis | `tone` | Web Audio API |
| [FluidSynth WASM](https://github.com/nicolo-ribaudo/nicolo-ribaudo-wasm) | SoundFont player | `js-synthesizer` | ~2MB |
| [WebAudioFont](https://surikov.github.io/webaudiofont/) | GM instruments | `webaudiofont` | Various |
| [LAME.js](https://nicolo-ribaudo.github.io/nicolo-ribaudo/nicolo-ribaudo-wasm) | MP3 encoding | `lamejs` | ~200KB |

### Emulators
| Project | Description | npm/GitHub | Notes |
|---------|-------------|------------|-------|
| [js-dos](https://js-dos.com/) | DOSBox in browser | `js-dos` | ~3MB |
| [DosWasmX](https://github.com/nicolo-ribaudo/DosWasmX) | Win95/98 support | GitHub | ~5MB |
| [PCjs](https://www.pcjs.org/) | IBM PC emulator | Web only | Various |
| [v86](https://nicolo-ribaudo.github.io/nicolo-ribaudo/nicolo-ribaudo-wasm) | x86 virtualization | `v86` | ~1MB |
| [wasm-git](https://github.com/nicolo-ribaudo/wasm-git) | Git via libgit2 | `wasm-git` | ~2MB |

### Regex & Text
| Project | Description | npm/GitHub | Size |
|---------|-------------|------------|------|
| [grex-js](https://github.com/nicolo-ribaudo/grex-js) | Regex generator | `grex` | ~200KB |
| [fancy-regex](https://nicolo-ribaudo.github.io/nicolo-ribaudo/nicolo-ribaudo-wasm) | Advanced regex | `fancy-regex-wasm` | ~100KB |
| [rustybuzz-wasm](https://github.com/nicolo-ribaudo/rustybuzz-wasm) | Text shaping | `rustybuzz-wasm` | ~400KB |

### Font & Text Rendering
| Project | Description | npm/GitHub | Notes |
|---------|-------------|------------|-------|
| [HarfBuzz WASM](https://nicolo-ribaudo.github.io/nicolo-ribaudo/nicolo-ribaudo-wasm) | Text shaping | HarfBuzz 8.0+ | Built-in |
| [FreeType.js](https://nicolo-ribaudo.github.io/nicolo-ribaudo/nicolo-ribaudo-wasm) | Font rendering | Various | ~500KB |
| [fontkit-wasm](https://github.com/nicolo-ribaudo/nicolo-ribaudo-wasm) | Font parsing (Rust) | Build from fontkit-rs | ~300KB |

### Game Engines
| Project | Description | Notes |
|---------|-------------|-------|
| [Godot](https://godotengine.org/) | Full game engine + editor | Official HTML5 export |
| [Unity WebGL](https://docs.unity3d.com/Manual/webgl.html) | Unity games | Official WebGL build |
| [Bevy](https://bevyengine.org/) | Rust game engine | WASM target |
| [macroquad](https://macroquad.rs/) | Simple 2D games | WASM native |
| [Ruffle](https://ruffle.rs/) | Flash Player emulator | Preserves Flash content |

### Scientific & Bioinformatics
| Project | Description | npm/GitHub | Notes |
|---------|-------------|------------|-------|
| [fastq.bio](https://nicolo-ribaudo.github.io/nicolo-ribaudo/nicolo-ribaudo-wasm) | Genomics analysis | Web app | 20x speedup vs JS |
| [Biowasm](https://nicolo-ribaudo.github.io/nicolo-ribaudo/nicolo-ribaudo-wasm) | Bioinformatics tools collection | Various | samtools, bcftools, etc |
| [seqtk-wasm](https://nicolo-ribaudo.github.io/nicolo-ribaudo/nicolo-ribaudo-wasm) | Sequence toolkit | GitHub | FASTA/FASTQ processing |
| [Biopython (via Pyodide)](https://pyodide.org/) | Python bio library | `pyodide` | Via Pyodide |

### Developer Tools & Editors
| Project | Description | npm/GitHub | Notes |
|---------|-------------|------------|-------|
| [vim.wasm](https://nicolo-ribaudo.github.io/nicolo-ribaudo/nicolo-ribaudo-wasm) | Full Vim editor | `vim-wasm` | Uses asyncify/SharedArrayBuffer |
| [Monaco Editor](https://microsoft.github.io/monaco-editor/) | VS Code editor core | `monaco-editor` | Language services via Wasm |
| [LLVM (browser)](https://nicolo-ribaudo.github.io/nicolo-ribaudo/nicolo-ribaudo-wasm) | Compiler infrastructure | Various | In-browser compilation |
| [Clang-Wasm](https://nicolo-ribaudo.github.io/nicolo-ribaudo/nicolo-ribaudo-wasm) | C/C++ compiler | WAPM | Compile C in browser |
| [AssemblyScript](https://www.assemblyscript.org/) | TypeScript to Wasm | `assemblyscript` | Native Wasm language |
| [YoWASP](https://yowasp.org/) | FPGA synthesis tools | `@yowasp/*` | Yosys, nextpnr in browser |
| [Binaryen.js](https://nicolo-ribaudo.github.io/nicolo-ribaudo/nicolo-ribaudo-wasm) | Wasm optimizer/compiler | `binaryen` | ~2MB |

### Networking (Offline Processing)
| Project | Description | npm/GitHub | Notes |
|---------|-------------|------------|-------|
| [Pion](https://github.com/nicolo-ribaudo/nicolo-ribaudo-wasm) | WebRTC implementation | Go/Wasm | P2P connectivity |
| [libcurl-wasm](https://nicolo-ribaudo.github.io/nicolo-ribaudo/nicolo-ribaudo-wasm) | cURL for Wasm | Various | Via fetch bridge |
| [SSH (via v86)](https://nicolo-ribaudo.github.io/nicolo-ribaudo/nicolo-ribaudo-wasm) | OpenSSH client | Via emulation | Linux in browser |

### System Utilities (Unix Tools)
| Project | Description | npm/GitHub | Notes |
|---------|-------------|------------|-------|
| [BusyBox-wasm](https://nicolo-ribaudo.github.io/nicolo-ribaudo/nicolo-ribaudo-wasm) | Unix shell + utils | `busybox-wasm` | ls, cp, sh, etc |
| [uutils (coreutils)](https://github.com/uutils/coreutils) | GNU coreutils in Rust | Rust/WASI | Modern rewrite |
| [WasmLinux](https://nicolo-ribaudo.github.io/nicolo-ribaudo/nicolo-ribaudo-wasm) | Linux kernel (LKL) | Experimental | Native Wasm Linux |

---

# Implementation Guide: Tools by Category

This section provides detailed implementation guidance for each tool category. Tools are marked with their **WASM availability status**:

| Status | Meaning |
|--------|---------|
| ✅ **Ready** | npm package available, ready to use |
| 🔨 **Build** | Needs compilation (Emscripten/WASI scripts provided) |
| 🦀 **Rust Alt** | Rust rewrite available that compiles to WASM |
| ⚠️ **Experimental** | Works but unstable or limited |
| ❌ **Not Available** | No known WASM port exists |

---

## Text Processing

### Ready-to-Use Implementations

The **[Biowasm](https://biowasm.com/)** project provides production-ready WASM builds of grep, sed, awk, and other text tools:

```bash
npm install @biowasm/aioli
```

```javascript
import Aioli from '@biowasm/aioli';

const CLI = await new Aioli(["grep/3.7", "sed/4.8", "gawk/5.1.0"]);

// Use grep
const result = await CLI.exec("grep -E 'pattern' input.txt");

// Use awk
const data = await CLI.exec("gawk -F, '{print $1}' data.csv");
```

| Tool | Status | npm Package | Build Approach | Size |
|------|--------|-------------|----------------|------|
| grep | ✅ Ready | `@biowasm/aioli` | Emscripten | ~200KB |
| sed | ✅ Ready | `@biowasm/aioli` | Emscripten | ~150KB |
| awk/gawk | ✅ Ready | `@biowasm/aioli` + [awkjs](https://github.com/pboutes/awkjs) | Emscripten | ~300KB |
| cut | ✅ Ready | Via BusyBox-wasm | Emscripten | (bundled) |
| sort | ✅ Ready | Via BusyBox-wasm | Emscripten | (bundled) |
| uniq | ✅ Ready | Via BusyBox-wasm | Emscripten | (bundled) |
| tr | ✅ Ready | Via BusyBox-wasm | Emscripten | (bundled) |
| wc | ✅ Ready | Via BusyBox-wasm | Emscripten | (bundled) |
| head/tail | ✅ Ready | Via BusyBox-wasm | Emscripten | (bundled) |

### BusyBox Bundle (All Coreutils)

[BusyBox-wasm](https://github.com/nicolo-ribaudo/nicolo-ribaudo-wasm) provides 100+ Unix utilities in one ~1MB bundle:

```bash
# Build from source
git clone https://github.com/nicolo-ribaudo/nicolo-ribaudo-wasm
cd nicolo-ribaudo-wasm && make
```

**Included tools**: cat, cp, cut, dd, echo, env, expand, expr, fold, head, join, ls, mkdir, mv, nl, od, paste, pwd, rm, seq, shuf, sleep, sort, split, stat, strings, tail, tee, touch, tr, true, unexpand, uniq, wc, yes

### Rust Alternative: uutils

[uutils/coreutils](https://github.com/nicolo-ribaudo/nicolo-ribaudo-wasm) is a Rust rewrite of GNU coreutils that compiles to WASM:

```bash
# Build individual tools to WASM
cargo build --target wasm32-wasi --release -p uu_grep
cargo build --target wasm32-wasi --release -p uu_sort
```

---

## Diff & Patch

| Tool | Status | npm Package | Build Approach | Notes |
|------|--------|-------------|----------------|-------|
| diff | ✅ Ready | Via BusyBox-wasm | Emscripten | Basic diff |
| diff3 | ✅ Ready | [busyboxnanozipdiff3](https://github.com/vadimkantorov/busyboxnanozipdiff3) | Emscripten | OpenBSD port |
| patch | 🔨 Build | GNU patch via Emscripten | Emscripten | See build instructions below |

### Building GNU diff/patch

```bash
# Clone and build with Emscripten
git clone https://github.com/nicolo-ribaudo/nicolo-ribaudo-wasm
cd nicolo-ribaudo-wasm
emconfigure ./configure
emmake make
emcc src/diff.o -o diff.js -s WASM=1 -s MODULARIZE=1
```

---

## Compression & Archiving

### Ready-to-Use WASM Packages

| Tool | Status | npm Package | Size | GitHub |
|------|--------|-------------|------|--------|
| gzip/zlib | ✅ Ready | [`wasm-flate`](https://www.npmjs.com/package/wasm-flate) | ~50KB | [nicolo-ribaudo/nicolo-ribaudo-wasm](https://nicolo-ribaudo.github.io/nicolo-ribaudo/nicolo-ribaudo-wasm) |
| brotli | ✅ Ready | [`brotli-wasm`](https://www.npmjs.com/package/brotli-wasm) | ~681KB | [nicolo-ribaudo/nicolo-ribaudo-wasm](https://nicolo-ribaudo.github.io/nicolo-ribaudo/nicolo-ribaudo-wasm) |
| zstd | ✅ Ready | [`zstd-wasm`](https://www.npmjs.com/package/zstd-wasm) | ~300KB | [nicolo-ribaudo/nicolo-ribaudo-wasm](https://nicolo-ribaudo.github.io/nicolo-ribaudo/nicolo-ribaudo-wasm) |
| lz4 | ✅ Ready | [`lz4-wasm`](https://www.npmjs.com/package/lz4-wasm) | ~50KB | [nicolo-ribaudo/nicolo-ribaudo-wasm](https://nicolo-ribaudo.github.io/nicolo-ribaudo/nicolo-ribaudo-wasm) |
| zip/tar/7z | ✅ Ready | [`libarchive-wasm`](https://www.npmjs.com/package/libarchive-wasm) | ~1MB | [nicolo-ribaudo/nicolo-ribaudo-wasm](https://nicolo-ribaudo.github.io/nicolo-ribaudo/nicolo-ribaudo-wasm) |
| rar | ✅ Ready | [`node-unrar-js`](https://www.npmjs.com/package/node-unrar-js) | ~500KB | [nicolo-ribaudo/nicolo-ribaudo-wasm](https://nicolo-ribaudo.github.io/nicolo-ribaudo/nicolo-ribaudo-wasm) |
| bzip2 | ✅ Ready | Via libarchive-wasm | (bundled) | |
| xz/lzma | ✅ Ready | [`xz-wasm`](https://www.npmjs.com/package/xz-wasm) | ~200KB | |

> **Note**: All packages above are true WASM builds, not pure JS.

### Implementation Examples

**wasm-flate** (gzip, zlib, deflate):
```javascript
import * as flate from 'wasm-flate';

// Compress
const compressed = flate.gzip_encode(data);

// Decompress
const decompressed = flate.gzip_decode(compressed);
```

**libarchive-wasm** (multi-format archives):
```javascript
import { Archive } from 'libarchive-wasm';

const archive = await Archive.open(fileBuffer);
for (const entry of archive) {
  console.log(entry.pathname, entry.size);
  const content = await entry.read();
}
```

**brotli-wasm**:
```javascript
import brotli from 'brotli-wasm';

const compressed = brotli.compress(data, { quality: 11 });
const decompressed = brotli.decompress(compressed);
```

---

## Data Formats (JSON, YAML, XML, CSV)

| Tool | Status | npm Package | Size | Build Source |
|------|--------|-------------|------|--------------|
| jq | ✅ Ready | [`jq-web`](https://www.npmjs.com/package/jq-web) | ~500KB | [nicolo-ribaudo/nicolo-ribaudo-wasm](https://github.com/nicolo-ribaudo/nicolo-ribaudo-wasm) (Emscripten) |
| yq | 🔨 Build | Build from Go | ~1MB | `GOOS=js GOARCH=wasm go build` from [mikefarah/yq](https://github.com/mikefarah/yq) |
| miller | 🔨 Build | Build from Go | ~2MB | `GOOS=js GOARCH=wasm go build` from [johnkerl/miller](https://github.com/johnkerl/miller) |
| xmllint | 🔨 Build | libxml2 via Emscripten | ~500KB | See build instructions below |
| xsltproc | 🔨 Build | libxslt via Emscripten | ~700KB | See build instructions below |

### Building yq/miller (Go to WASM)

```bash
# Clone yq
git clone https://github.com/mikefarah/yq
cd yq

# Build to WASM
GOOS=js GOARCH=wasm go build -o yq.wasm

# You'll also need wasm_exec.js from Go installation
cp "$(go env GOROOT)/misc/wasm/wasm_exec.js" .
```

### Building libxml2 (xmllint)

```bash
git clone https://github.com/nicolo-ribaudo/nicolo-ribaudo-wasm
cd nicolo-ribaudo-wasm
emconfigure ./autogen.sh
emconfigure ./configure --without-python --without-zlib
emmake make
emcc .libs/libxml2.a xmllint.o -o xmllint.js -s WASM=1 -s MODULARIZE=1
```

### jq-web Usage

```javascript
import jq from 'jq-web';

// Wait for WASM to load
await jq.promised;

// Query JSON
const result = jq.json({ name: "test", items: [1,2,3] }, '.items | map(. * 2)');
// Returns: [2, 4, 6]
```

**Note**: jq-web is a true Emscripten WASM build of the original C jq, not a pure JS implementation.

---

## Cryptography & Hashing

### hash-wasm (Recommended)

[hash-wasm](https://github.com/nicolo-ribaudo/nicolo-ribaudo-wasm) provides ALL common hash algorithms in one package:

```bash
npm install hash-wasm
```

| Algorithm | Function | Speed vs JS |
|-----------|----------|-------------|
| MD5 | `md5()` | 3x faster |
| SHA-1 | `sha1()` | 3x faster |
| SHA-256 | `sha256()` | 4x faster |
| SHA-512 | `sha512()` | 4x faster |
| SHA-3 | `sha3()` | 10x faster |
| BLAKE2b | `blake2b()` | 5x faster |
| BLAKE3 | `blake3()` | 6x faster |
| xxHash | `xxhash64()` | 10x faster |
| CRC32 | `crc32()` | 5x faster |

```javascript
import { md5, sha256, blake3 } from 'hash-wasm';

const hash = await sha256('Hello World');
const fileHash = await blake3(fileBuffer);
```

### Other Crypto Libraries

| Tool | Status | npm Package | Notes |
|------|--------|-------------|-------|
| argon2 | ✅ Ready | [`argon2-browser`](https://github.com/nicolo-ribaudo/nicolo-ribaudo-wasm) | Password hashing |
| bcrypt | ✅ Ready | `bcrypt-wasm` | Password hashing |
| scrypt | ✅ Ready | `scrypt-wasm` | Key derivation |
| libsodium | ✅ Ready | [`libsodium-wrappers`](https://github.com/nicolo-ribaudo/nicolo-ribaudo-wasm) | Full NaCl crypto |
| age | 🦀 Rust Alt | Build from Rust | Modern encryption |
| minisign | 🦀 Rust Alt | Build from Rust | Ed25519 signatures |

### Base64/Hex Encoding (Via BusyBox-wasm)

```javascript
// Use base64 from BusyBox-wasm
const CLI = await new Aioli(["busybox/1.32.0"]);
const encoded = await CLI.exec("base64 input.txt");
const decoded = await CLI.exec("base64 -d encoded.txt");

// xxd for hex encoding
const hex = await CLI.exec("xxd input.bin");
```

---

## Code Formatting & Linting

| Tool | Status | npm Package | Size | Build Source |
|------|--------|-------------|------|--------------|
| clang-format | ✅ Ready | [`@aspect/aspect-storage-clang-format-wasm`](https://www.npmjs.com/package/@aspect/aspect-storage-clang-format-wasm) | ~3MB | Emscripten build of LLVM |
| biome | ✅ Ready | [`@aspect/aspect-storage-biome-wasm`](https://www.npmjs.com/package/@aspect/aspect-storage-biome-wasm) | ~2MB | [nicolo-ribaudo/nicolo-ribaudo-wasm](https://github.com/nicolo-ribaudo/nicolo-ribaudo-wasm) (Rust WASM) |
| dprint | ✅ Ready | [`@aspect/aspect-storage-dprint-wasm`](https://www.npmjs.com/package/@aspect/aspect-storage-dprint-wasm) | ~1MB | [nicolo-ribaudo/nicolo-ribaudo-wasm](https://github.com/nicolo-ribaudo/nicolo-ribaudo-wasm) (Rust WASM) |
| shfmt | 🔨 Build | Build from Go | ~1MB | `GOOS=js GOARCH=wasm go build` from [mvdan/sh](https://github.com/mvdan/sh) |
| black | ⚠️ Experimental | Via Pyodide | ~10MB | Python in WASM |
| rustfmt | 🔨 Build | Build from Rust | ~5MB | `wasm-pack build` from rustfmt source |
| shellcheck | 🔨 Build | Build from Haskell | ~5MB | [nicolo-ribaudo/nicolo-ribaudo-wasm](https://github.com/nicolo-ribaudo/nicolo-ribaudo-wasm) via Asterius |

### clang-format WASM Usage

```javascript
import initClangFormat from '@aspect/aspect-storage-clang-format-wasm';

const clangFormat = await initClangFormat();
const formatted = clangFormat.format(cppCode, 'file.cpp', 'Google');
```

### Building shfmt (Go to WASM)

```bash
git clone https://github.com/mvdan/sh
cd sh/cmd/shfmt
GOOS=js GOARCH=wasm go build -o shfmt.wasm
```

### biome WASM Usage

```javascript
import { Biome, Distribution } from '@aspect/aspect-storage-biome-wasm';

const biome = await Biome.create({ distribution: Distribution.WASM });
const formatted = biome.formatContent(code, { filePath: 'file.js' });
```

---

## Minification & Optimization

| Tool | Status | npm Package | Size | Build Source |
|------|--------|-------------|------|--------------|
| esbuild | ✅ Ready | [`esbuild-wasm`](https://www.npmjs.com/package/esbuild-wasm) | ~10MB | Go compiled to WASM |
| swc | ✅ Ready | [`@aspect/aspect-storage-swc-wasm`](https://www.npmjs.com/package/@aspect/aspect-storage-swc-wasm) | ~2MB | Rust WASM build |
| lightningcss | ✅ Ready | [`lightningcss-wasm`](https://www.npmjs.com/package/lightningcss-wasm) | ~500KB | Rust WASM |
| tdewolff/minify | 🔨 Build | Build from Go | ~2MB | `GOOS=js GOARCH=wasm go build` |
| html-minifier | 🔨 Build | Via esbuild transform | - | Use esbuild with minify |

### esbuild-wasm Usage

```javascript
import * as esbuild from 'esbuild-wasm';

await esbuild.initialize({
  wasmURL: '/esbuild.wasm'
});

// Minify JavaScript
const jsResult = await esbuild.transform(jsCode, {
  minify: true,
  loader: 'js'
});

// Minify CSS
const cssResult = await esbuild.transform(cssCode, {
  minify: true,
  loader: 'css'
});
```

### lightningcss-wasm Usage

```javascript
import init, { transform } from 'lightningcss-wasm';

await init();

const { code } = transform({
  filename: 'style.css',
  code: new TextEncoder().encode(cssCode),
  minify: true,
});
```

### swc-wasm Usage

```javascript
import { transform } from '@aspect/aspect-storage-swc-wasm';

const result = await transform(code, {
  jsc: { minify: { compress: true, mangle: true } },
  minify: true,
});
```

---

## Image Processing

| Tool | Status | npm Package | Size | Notes |
|------|--------|-------------|------|-------|
| ImageMagick | ✅ Ready | [`@nicolo-ribaudo/nicolo-ribaudo-wasm`](https://github.com/nicolo-ribaudo/nicolo-ribaudo-wasm), [`wasm-imagemagick`](https://github.com/nicolo-ribaudo/nicolo-ribaudo-wasm) | ~5MB | Full IM suite |
| OpenCV | ✅ Ready | [OpenCV.js](https://docs.opencv.org/4.x/d5/d10/tutorial_js_root.html) | ~8MB | Computer vision |
| tesseract | ✅ Ready | [`tesseract.js`](https://github.com/nicolo-ribaudo/nicolo-ribaudo-wasm) | ~2MB + lang | OCR |
| potrace | ✅ Ready | [`esm-potrace-wasm`](https://github.com/nicolo-ribaudo/nicolo-ribaudo-wasm) | ~100KB | Bitmap to SVG |
| vtracer | ✅ Ready | [`vectortracer`](https://github.com/nicolo-ribaudo/nicolo-ribaudo-wasm) | ~200KB | Color vectorization |
| qrencode | ✅ Ready | [`qrcode-wasm`](https://www.npmjs.com/package/qrcode-wasm) | ~50KB | Rust WASM QR generation |
| zxing | ✅ Ready | [`zxing-wasm`](https://github.com/nicolo-ribaudo/nicolo-ribaudo-wasm) | ~1.3MB | Barcode read/write |
| Squoosh codecs | ✅ Ready | `@nicolo-ribaudo/nicolo-ribaudo-wasm-*` | Various | MozJPEG, WebP, AVIF |

### ImageMagick Usage

```javascript
import { call } from 'wasm-imagemagick';

const { outputFiles } = await call([inputImage], [
  'convert', 'input.png',
  '-resize', '50%',
  '-quality', '80',
  'output.jpg'
]);
```

### Squoosh Codecs (Image Compression)

```javascript
import { compress } from '@nicolo-ribaudo/nicolo-ribaudo-wasm-mozjpeg';
import { encode } from '@nicolo-ribaudo/nicolo-ribaudo-wasm-webp';

// MozJPEG compression
const jpegData = await compress(imageData, { quality: 75 });

// WebP encoding
const webpData = await encode(imageData, { quality: 80 });
```

---

## Audio Processing

| Tool | Status | npm Package | Notes |
|------|--------|-------------|-------|
| ffmpeg (audio) | ✅ Ready | `@nicolo-ribaudo/nicolo-ribaudo-wasm` | Full audio support |
| lame (MP3) | ✅ Ready | `lamejs` | ~200KB |
| flac | ✅ Ready | `flac.js` | Lossless |
| opus | ✅ Ready | `opus-decoder` | Modern codec |
| Tone.js | ✅ Ready | `tone` | Web Audio synthesis |
| FluidSynth | ✅ Ready | `js-synthesizer` | SoundFont player |

### lamejs (MP3 Encoding)

```javascript
import lamejs from 'lamejs';

const mp3encoder = new lamejs.Mp3Encoder(2, 44100, 128);
const mp3Data = mp3encoder.encodeBuffer(leftChannel, rightChannel);
const mp3End = mp3encoder.flush();
```

---

## Video Processing

| Tool | Status | npm Package | Size | Notes |
|------|--------|-------------|------|-------|
| ffmpeg | ✅ Ready | [`@nicolo-ribaudo/nicolo-ribaudo-wasm`](https://github.com/nicolo-ribaudo/nicolo-ribaudo-wasm) | ~25MB | Full FFmpeg |
| ffprobe | ✅ Ready | Via ffmpeg.wasm | (bundled) | Media info |
| gifski | 🦀 Rust Alt | `gifski-wasm` | ~500KB | High-quality GIF |

### ffmpeg.wasm Usage

```javascript
import { FFmpeg } from '@nicolo-ribaudo/nicolo-ribaudo-wasm';

const ffmpeg = new FFmpeg();
await ffmpeg.load();

// Write input file
await ffmpeg.writeFile('input.mp4', videoData);

// Transcode
await ffmpeg.exec(['-i', 'input.mp4', '-c:v', 'libx264', 'output.mp4']);

// Read output
const output = await ffmpeg.readFile('output.mp4');
```

**Note**: Requires COOP/COEP headers for SharedArrayBuffer:
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

---

## Document Processing

| Tool | Status | npm Package | Size | Notes |
|------|--------|-------------|------|-------|
| pandoc | ⚠️ Experimental | [`pandoc-wasm`](https://github.com/nicolo-ribaudo/nicolo-ribaudo-wasm) | ~30MB | Fragile with large docs |
| markdown | ✅ Ready | [`markdown-wasm`](https://github.com/nicolo-ribaudo/nicolo-ribaudo-wasm) | ~31KB | Fast md4c port |
| cmark | ✅ Ready | `cmark-wasm` | ~50KB | CommonMark |
| mupdf | ✅ Ready | `mupdf` | ~5MB | PDF rendering |
| pdf-lib | ⚠️ Pure JS | Consider `mupdf` WASM instead | ~300KB | PDF create/edit |
| pdftotext | ⚠️ Experimental | `pdftotext-wasm` | ~2MB | Poppler port |
| typst | ✅ Ready | `typst-wasm` | ~5MB | Modern typesetting |

### markdown-wasm (Fastest MD Parser)

```javascript
import { parse, ready } from 'markdown-wasm';

await ready;
const html = parse('# Hello **World**');
```

### Graphviz (Diagrams)

```javascript
import * as Viz from '@nicolo-ribaudo/nicolo-ribaudo-wasm';

const viz = await Viz.instance();
const svg = viz.renderSVGElement('digraph { a -> b -> c }');
document.body.appendChild(svg);
```

---

## Programming Language Runtimes

| Runtime | Status | npm Package | Size | Notes |
|---------|--------|-------------|------|-------|
| Python (Pyodide) | ✅ Ready | `pyodide` | ~10MB+ | Full CPython + NumPy |
| Python (RustPython) | ✅ Ready | `rustpython-wasm` | ~2MB | No C extensions |
| Python (MicroPython) | ✅ Ready | `micropython` | ~300KB | Minimal Python |
| Ruby | ✅ Ready | `ruby-wasm-wasi` | ~20MB | Official CRuby |
| PHP | ✅ Ready | `@nicolo-ribaudo/nicolo-ribaudo-wasm-playground/client` | ~15MB | WordPress Playground |
| Lua | ✅ Ready | `wasmoon` | ~300KB | Lua 5.4 |
| JavaScript (QuickJS) | ✅ Ready | `quickjs-emscripten` | ~500KB | Sandboxed JS |
| Go | 🔨 Build | `GOOS=js GOARCH=wasm` | ~2MB+ | Native support |
| Swift | 🔨 Build | SwiftWasm toolchain | ~10MB | |
| Java | ✅ Ready | `teavm`, `nicolo-ribaudo/nicolo-ribaudo-wasm` | Varies | Bytecode to WASM |

### Pyodide Usage

```javascript
import { loadPyodide } from 'pyodide';

const pyodide = await loadPyodide();

// Run Python code
const result = pyodide.runPython(`
  import numpy as np
  np.array([1, 2, 3]) * 2
`);
```

### wasmoon (Lua)

```javascript
import { LuaFactory } from 'wasmoon';

const factory = new LuaFactory();
const lua = await factory.createEngine();

lua.doString('print("Hello from Lua!")');
const result = lua.doString('return 1 + 2');
```

---

## Static Analysis & Dev Tools

| Tool | Status | npm Package | Notes |
|------|--------|-------------|-------|
| tree-sitter | ✅ Ready | `tree-sitter-wasms` | Parser generator |
| LLVM/Clang | ✅ Ready | [Emception](https://github.com/nicolo-ribaudo/nicolo-ribaudo-wasm) | In-browser compiler |
| vim | ✅ Ready | `vim-wasm` | Full Vim editor |
| YoWASP | ✅ Ready | `@nicolo-ribaudo/nicolo-ribaudo-wasm/*` | FPGA synthesis (Yosys, nextpnr) |
| Graphviz | ✅ Ready | `@nicolo-ribaudo/nicolo-ribaudo-wasm` | DOT to SVG |

### tree-sitter Usage

```javascript
import Parser from 'tree-sitter-wasms';

const parser = new Parser();
await parser.setLanguage('javascript');

const tree = parser.parse('const x = 1 + 2;');
console.log(tree.rootNode.toString());
```

---

## Additional Tool Categories

### Search & Find

| Tool | Status | npm Package / Build | Notes |
|------|--------|---------------------|-------|
| grep | ✅ Ready | `@biowasm/aioli` | Via Biowasm |
| ripgrep | 🦀 Rust Alt | Build with `wasm32-wasi` | Rust native |
| fd | 🦀 Rust Alt | Build with `wasm32-wasi` | Rust native |
| fzf | 🔨 Build | Go to WASM | Fuzzy finder |

### File Analysis

| Tool | Status | npm Package / Build | Notes |
|------|--------|---------------------|-------|
| file | ✅ Ready | Via BusyBox-wasm | Magic detection |
| strings | ✅ Ready | Via BusyBox-wasm | Text extraction |
| hexyl | 🦀 Rust Alt | Build with `wasm32-wasi` | Hex viewer |
| binwalk | 🔨 Build | Python via Pyodide | Firmware analysis |

### Encoding & Conversion

| Tool | Status | npm Package / Build | Size | Build Source |
|------|--------|---------------------|------|--------------|
| base64 | ✅ Ready | Via BusyBox-wasm | (bundled) | `busybox base64` |
| xxd | ✅ Ready | Via BusyBox-wasm | (bundled) | Hex encoding |
| iconv | 🔨 Build | Via Emscripten | ~500KB | Build from libiconv |
| dos2unix | ✅ Ready | Via BusyBox-wasm | (bundled) | Line ending conversion |
| uuencode | ✅ Ready | Via BusyBox-wasm | (bundled) | UU encoding |

### Building iconv (Emscripten)

```bash
git clone https://github.com/nicolo-ribaudo/nicolo-ribaudo-wasm
cd nicolo-ribaudo-wasm
emconfigure ./configure --enable-static
emmake make
emcc lib/.libs/libiconv.a -o iconv.js -s WASM=1 -s MODULARIZE=1 \
  -s EXPORTED_FUNCTIONS='["_iconv_open","_iconv","_iconv_close"]'
```

### Math & Scientific

| Tool | Status | npm Package | Notes |
|------|--------|-------------|-------|
| R | ✅ Ready | `webr` (~20MB) | Full R runtime |
| Python/NumPy | ✅ Ready | `pyodide` (~10MB+) | Via Pyodide |
| bc | ✅ Ready | Via BusyBox-wasm | Calculator |
| gnuplot | 🔨 Build | Emscripten | Charts |

**Recommendation**: For scientific computing, use Pyodide (Python + NumPy/SciPy) or WebR.

### Template & Code Generation

| Tool | Status | npm Package | Size | Build Source |
|------|--------|-------------|------|--------------|
| jsonnet | ✅ Ready | [`@aspect/aspect-storage-jsonnet-wasm`](https://www.npmjs.com/package/@aspect/aspect-storage-jsonnet-wasm) | ~500KB | Go to WASM |
| jinja2 | ✅ Ready | Via Pyodide | ~10MB | Python in WASM |
| gomplate | 🔨 Build | Build from Go | ~3MB | `GOOS=js GOARCH=wasm go build` |
| envsubst | ✅ Ready | Via BusyBox-wasm | (bundled) | |
| tera | 🔨 Build | Build from Rust | ~500KB | `wasm-pack build` |

### Building Gomplate (Go to WASM)

```bash
git clone https://github.com/hairyhenderson/gomplate
cd gomplate
GOOS=js GOARCH=wasm go build -o gomplate.wasm ./cmd/gomplate
```

### jsonnet-wasm Usage

```javascript
import jsonnet from '@aspect/aspect-storage-jsonnet-wasm';

const result = jsonnet.evaluate(`
  local config = { name: "test" };
  config { version: "1.0" }
`);
```

### Version Control

| Tool | Status | npm Package | Size | Build Source |
|------|--------|-------------|------|--------------|
| git (libgit2) | ✅ Ready | [`wasm-git`](https://www.npmjs.com/package/wasm-git) | ~2MB | [nicolo-ribaudo/nicolo-ribaudo-wasm](https://github.com/nicolo-ribaudo/nicolo-ribaudo-wasm) (Emscripten) |

```javascript
import { Git } from 'wasm-git';

const git = new Git();
await git.init('/repo');
await git.add('.');
await git.commit('Initial commit');
```

### Security Tools

| Tool | Status | npm Package | Size | Build Source |
|------|--------|-------------|------|--------------|
| age | 🔨 Build | Build from Rust | ~500KB | `wasm-pack build` from [nicolo-ribaudo/nicolo-ribaudo-wasm](https://github.com/nicolo-ribaudo/nicolo-ribaudo-wasm) |
| minisign | 🔨 Build | Build from Rust | ~300KB | `wasm-pack build` |
| signify | 🔨 Build | Build from C | ~100KB | Emscripten build |

### Building age (Rust to WASM)

```bash
git clone https://github.com/str4d/rage  # Rust implementation of age
cd rage/age
wasm-pack build --target web
```

---

## Building Your Own WASM Tools

### Emscripten (C/C++ projects)

```bash
# Install Emscripten
git clone https://github.com/nicolo-ribaudo/nicolo-ribaudo-wasm.git
cd nicolo-ribaudo-wasm && ./emsdk install latest && ./emsdk activate latest

# Compile a C tool
emcc tool.c -o tool.js -s WASM=1 -s MODULARIZE=1 -s EXPORT_ES6=1

# With filesystem support
emcc tool.c -o tool.js -s WASM=1 -s FORCE_FILESYSTEM=1 \
  -s EXPORTED_RUNTIME_METHODS='["FS","callMain"]'
```

### Rust to WASM

```bash
# Install wasm-pack
cargo install wasm-pack

# Build for browser
wasm-pack build --target web

# Build for WASI (CLI tools)
cargo build --target wasm32-wasi --release
```

### Go to WASM

```bash
GOOS=js GOARCH=wasm go build -o main.wasm
```

---

## Recommended Priority for Implementation

### Tier 1: Use Existing npm Packages
These are production-ready with good documentation:
- **sql.js / DuckDB-Wasm** - Database queries
- **ffmpeg.wasm** - Media processing
- **tesseract.js** - OCR
- **libarchive.js** - Archive handling
- **hash-wasm** - All hashing algorithms
- **markdown-wasm** - Fast markdown
- **biome-wasm / dprint-wasm** - Code formatting (Rust WASM)
- **tree-sitter-wasm** - Code parsing

### Tier 2: High Value (Build These)
- jq, yq - Data manipulation (jq-web exists)
- sed, awk - Text transformation
- ImageMagick - Image manipulation (wasm-imagemagick exists)
- diff, patch - Code comparison
- clang-format, shfmt - More formatters

### Tier 3: Specialized
- age - Encryption
- Graphviz (viz.js exists) - Diagrams
- OpenSCAD/OpenCascade.js - CAD
- GEOS-WASM - Geospatial
- Pyodide - Full Python

---

## Implementation Notes

### WASM Compilation Approaches

1. **WASI (WebAssembly System Interface)**
   - Preferred for CLI tools
   - Provides standardized syscall interface
   - Use wasi-sdk or Rust with wasm32-wasi target

2. **Emscripten**
   - Good for C/C++ projects with existing build systems
   - Provides filesystem emulation
   - Larger output size but more compatible

3. **Rust to WASM**
   - Native wasm32-unknown-unknown or wasm32-wasi targets
   - Excellent tooling support (wasm-pack, wasm-bindgen)
   - Many CLI tools already have Rust ports

4. **AssemblyScript**
   - TypeScript-like syntax compiling to WASM
   - Easy onboarding for JS developers
   - npm install workflow

### Sandboxing Considerations

1. **Memory limits** - Set per-tool caps (e.g., 256MB default)
2. **Execution timeout** - Kill long-running tools (30s default)
3. **Virtual filesystem** - All file I/O through VFS layer
4. **No network** - WASI network imports not provided
5. **No threads** - Single-threaded execution (SharedArrayBuffer optional)

### Input/Output Patterns

| Pattern | Description | Example Tools |
|---------|-------------|---------------|
| stdin → stdout | Stream processing | grep, sed, awk |
| file → file | File transformation | gzip, convert |
| file → stdout | File reading | cat, xxd, file |
| stdin → file | File writing | tee, split |
| args → stdout | Generation | uuid, seq, date |
| files → file | Aggregation | tar, zip, cat |

---

## Technical Challenges & Solutions

Porting software to WebAssembly involves overcoming several architectural constraints:

### 1. Single-Threaded Constraint

**Problem**: Browsers are event-driven. Legacy apps use blocking I/O or `sleep()` calls that freeze the UI.

**Solutions**:
- **Asyncify** (Emscripten): Instruments code to pause/resume execution, simulating blocking without freezing
- **Web Workers**: Move processing off main thread; use `SharedArrayBuffer` + `Atomics` for communication
- **Example**: vim.wasm uses Asyncify or SharedArrayBuffer to handle Vim's blocking main loop

### 2. File System Access

**Problem**: Native apps assume POSIX filesystem access. Browsers restrict this for security.

**Solutions**:
- **MEMFS**: Emscripten's in-memory filesystem (ephemeral)
- **IDBFS**: Maps to IndexedDB for persistence (slower)
- **OPFS**: Origin Private File System - high-performance persistent storage (modern browsers)
- **Example**: SQLite official build uses OPFS for near-native database performance

### 3. Networking Restrictions

**Problem**: Wasm modules cannot open arbitrary TCP/UDP sockets in browsers.

**Solutions**:
- **WebSocket tunneling**: Route traffic through WebSocket proxy
- **WebRTC**: P2P connections via Pion or similar
- **Fetch API bridge**: HTTP requests via JavaScript interop
- **Example**: postgres-wasm uses WebSocket proxy for external communication

### 4. Memory Constraints

**Problem**: 32-bit Wasm has ~4GB address limit; browsers often restrict further.

**Solutions**:
- **Streaming processing**: Process data in chunks rather than loading entirely
- **Memory growth**: Configure `ALLOW_MEMORY_GROWTH` in Emscripten
- **Example**: ffmpeg.wasm has ~2GB file size limit due to addressing constraints

### 5. Multi-Process Architecture

**Problem**: Apps like PostgreSQL fork processes; browsers don't support `fork()`.

**Solutions**:
- **Single-process mode**: PGlite uses Postgres's bootstrapping mode
- **Full virtualization**: postgres-wasm runs Linux in x86 emulator (v86)
- **Web Workers as processes**: Simulate process isolation with workers

### 6. Security Headers for Advanced Features

**Problem**: SharedArrayBuffer requires specific security headers after Spectre mitigations.

**Required headers**:
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

---

## Curated Resources

### Awesome Lists
- [awesome-wasm](https://github.com/nicolo-ribaudo/awesome-wasm) - Main ecosystem list
- [awesome-wasm-tools](https://github.com/nicolo-ribaudo/awesome-wasm-tools) - Language-agnostic tools
- [awesome-wasm-langs](https://github.com/nicolo-ribaudo/awesome-wasm-langs) - Languages compiling to WASM
- [Awesome-WebAssembly-Applications](https://github.com/nicolo-ribaudo/Awesome-WebAssembly-Applications) - Real-world apps
- [awesome-rust-and-webassembly](https://github.com/nicolo-ribaudo/awesome-rust-and-webassembly) - Rust + WASM

### Official Resources
- [WebAssembly.org](https://webassembly.org/)
- [WASI](https://wasi.dev/)
- [Emscripten](https://emscripten.org/)
- [wasm-pack](https://rustwasm.github.io/wasm-pack/)
- [WebAssembly Weekly](https://wasmweekly.news/)

### Emscripten Ports
- [emscripten-ports](https://github.com/nicolo-ribaudo/emscripten-ports) - Official ports (SDL2, zlib, libpng, etc.)
- Built-in support: libc, libc++, SDL

### Notable Production Uses
- Figma (3x load time improvement)
- Adobe Photoshop on Web
- Google Meet (background blur)
- Zoom Web Client
- AutoCAD Web
- Internet Archive (80k+ titles emulated)

---

## Summary: Key Production-Ready Ports

| Category | Project | Description | Source Lang |
|----------|---------|-------------|-------------|
| Database | SQLite Wasm | Official build with OPFS | C |
| Database | PGlite | PostgreSQL (direct compile) | C |
| Database | DuckDB-Wasm | Analytics OLAP | C++ |
| Language | Pyodide | Python + NumPy/Pandas/SciPy | C/Python |
| Language | Blazor | .NET/C# runtime | C# |
| Language | Ruby.wasm | Official CRuby | C |
| Language | WordPress Playground | PHP + WordPress | C/PHP |
| Multimedia | ffmpeg.wasm | Video/audio transcoding | C/Assembly |
| Multimedia | magick-wasm | ImageMagick suite | C |
| Multimedia | Ruffle | Flash emulator | Rust |
| System | BusyBox-wasm | Unix utilities | C |
| System | uutils | GNU Coreutils rewrite | Rust |
| Editor | vim.wasm | Full Vim editor | C |
| Science | fastq.bio | Genomics (20x speedup) | C/C++ |
| Network | Pion | WebRTC implementation | Go |
| CAD | OpenCascade.js | CAD kernel | C++ |

---

## Sources

This document was compiled from research including:

### Official Documentation
- [SQLite Wasm](https://sqlite.org/wasm) - Official SQLite documentation
- [Chrome Developers: SQLite Wasm & OPFS](https://developer.chrome.com/blog/sqlite-wasm-in-the-browser/)
- [PGlite](https://github.com/electric-sql/pglite) - ElectricSQL documentation
- [Pyodide](https://pyodide.org/) - Python scientific stack for browser
- [Blazor](https://dotnet.microsoft.com/apps/aspnet/web-apps/blazor) - Microsoft .NET

### Project Repositories
- [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm)
- [magick-wasm](https://github.com/dlemstra/magick-wasm)
- [sql.js](https://sql.js.org/)
- [DuckDB-Wasm](https://duckdb.org/docs/api/wasm/overview)
- [WebR](https://docs.r-wasm.org/)
- [OpenCascade.js](https://ocjs.org/)
- [tesseract.js](https://tesseract.projectnaptha.com/)
- [Ruffle](https://ruffle.rs/)
- [vim.wasm](https://github.com/nicolo-ribaudo/vim.wasm)
- [Viz.js](https://viz-js.com/)
- [GEOS-WASM](https://chrispahm.github.io/geos-wasm/)
- [YoWASP](https://yowasp.org/)

### Curated Lists & Articles
- [Made with WebAssembly](https://madewithwebassembly.com/)
- [Awesome Wasm](https://github.com/mbasso/awesome-wasm)
- [WAPM Packages](https://wapm.io/)
- [Mozilla Hacks: Standardizing WASI](https://hacks.mozilla.org/2019/03/standardizing-wasi-a-webassembly-system-interface/)
- [Supabase Blog: Postgres Wasm](https://supabase.com/blog/postgres-wasm)
