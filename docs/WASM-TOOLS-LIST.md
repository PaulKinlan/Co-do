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
| [fzstd](https://nicolo-ribaudo.github.io/nicolo-ribaudo/nicolo-ribaudo-wasm) | Pure JS Zstd decompress | `fzstd` | ~8KB |
| [node-unrar.js](https://github.com/nicolo-ribaudo/node-unrar.js) | RAR extraction | `node-unrar-js` | ~500KB |
| [libunrar-js](https://github.com/nicolo-ribaudo/libunrar-js) | RAR5 support | `libunrar-js` | ~400KB |

### Cryptography & Hashing
| Project | Description | npm/GitHub | Size |
|---------|-------------|------------|------|
| [hash-wasm](https://github.com/nicolo-ribaudo/hash-wasm) | All hash algorithms | `hash-wasm` | ~100KB |
| [argon2-browser](https://github.com/nicolo-ribaudo/argon2-browser) | Argon2 password hash | `argon2-browser` | ~50KB |
| [libsodium.js](https://github.com/nicolo-ribaudo/libsodium.js) | NaCl crypto | `libsodium-wrappers` | ~200KB |
| [noble-* series](https://nicolo-ribaudo.github.io/nicolo-ribaudo/nicolo-ribaudo-wasm) | Pure JS crypto | `@noble/*` | Various |

### Code Parsing & Analysis
| Project | Description | npm/GitHub | Size |
|---------|-------------|------------|------|
| [tree-sitter-wasm](https://github.com/nicolo-ribaudo/tree-sitter-wasms) | Parser generator | `tree-sitter-wasms` | ~200KB + grammars |
| [Prettier](https://prettier.io/) | Code formatter | `prettier` | ~2MB |
| [ESLint](https://eslint.org/) | JS linter | `eslint` | Pure JS |

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
| [JSCAD](https://github.com/jscad/OpenJSCAD.org) | JS-based CAD | `@jscad/modeling` | Pure JS |
| [Chili3D](https://github.com/nicolo-ribaudo/chili3d) | Browser CAD app | GitHub | Alpha |

### Geospatial
| Project | Description | npm/GitHub | Notes |
|---------|-------------|------------|-------|
| [GEOS-WASM](https://github.com/nicolo-ribaudo/geos-wasm) | Geometry operations | `geos-wasm` | ~1MB |
| [GDAL.js](https://nicolo-ribaudo.github.io/nicolo-ribaudo/nicolo-ribaudo-wasm) | Geospatial data | `gdal3.js` | ~5MB |
| [Proj4js](https://nicolo-ribaudo.github.io/nicolo-ribaudo/nicolo-ribaudo-wasm) | Coordinate transform | `proj4` | Pure JS |

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
| [Mermaid](https://mermaid.js.org/) | Diagram renderer | `mermaid` | Pure JS |

### Barcodes & QR
| Project | Description | npm/GitHub | Size |
|---------|-------------|------------|------|
| [zxing-wasm](https://github.com/nicolo-ribaudo/zxing-wasm) | Barcode read/write | `zxing-wasm` | ~1.3MB full |
| [QRCode.js](https://nicolo-ribaudo.github.io/nicolo-ribaudo/nicolo-ribaudo-wasm) | QR generation | `qrcode` | Pure JS |

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
| [opentype.js](https://nicolo-ribaudo.github.io/nicolo-ribaudo/nicolo-ribaudo-wasm) | Font parsing | `opentype.js` | Pure JS |

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

## Text Processing

| Tool | Description | Source | Notes |
|------|-------------|--------|-------|
| grep | Pattern matching with regex | GNU coreutils | Basic text search |
| sed | Stream editor for text transformation | GNU sed | Regex-based find/replace |
| awk | Pattern scanning and processing | GNU awk / mawk | Data extraction and reporting |
| cut | Extract columns/fields from text | GNU coreutils | Column selection |
| sort | Sort lines of text | GNU coreutils | Alphabetic/numeric sorting |
| uniq | Filter duplicate lines | GNU coreutils | Deduplication |
| tr | Translate or delete characters | GNU coreutils | Character substitution |
| wc | Count words, lines, characters | GNU coreutils | Text statistics |
| head | Output first N lines | GNU coreutils | File preview |
| tail | Output last N lines | GNU coreutils | End-of-file preview |
| rev | Reverse lines of text | util-linux | Character reversal |
| tac | Concatenate and print in reverse | GNU coreutils | Line reversal |
| nl | Number lines of files | GNU coreutils | Line numbering |
| expand | Convert tabs to spaces | GNU coreutils | Whitespace normalization |
| unexpand | Convert spaces to tabs | GNU coreutils | Tab conversion |
| fold | Wrap lines to specified width | GNU coreutils | Text wrapping |
| fmt | Simple text formatter | GNU coreutils | Paragraph formatting |
| column | Columnate lists | util-linux | Tabular formatting |
| paste | Merge lines of files | GNU coreutils | Side-by-side merge |
| join | Join lines on common field | GNU coreutils | Relational join |
| comm | Compare sorted files line by line | GNU coreutils | Set operations |
| csplit | Split file by context | GNU coreutils | Pattern-based splitting |
| split | Split file into pieces | GNU coreutils | Size-based splitting |

---

## Diff & Patch

| Tool | Description | Source | Notes |
|------|-------------|--------|-------|
| diff | Compare files line by line | GNU diffutils | Standard diff output |
| diff3 | Compare three files | GNU diffutils | Three-way comparison |
| patch | Apply diff patches | GNU patch | Patch application |
| sdiff | Side-by-side diff | GNU diffutils | Visual comparison |
| colordiff | Colorized diff output | colordiff | Enhanced readability |

---

## Compression & Archiving

| Tool | Description | Source | Notes |
|------|-------------|--------|-------|
| gzip | Compress using DEFLATE | zlib/gzip | Standard compression |
| gunzip | Decompress gzip | zlib/gzip | Decompression |
| bzip2 | Compress using BWT | bzip2 | Higher compression |
| bunzip2 | Decompress bzip2 | bzip2 | Decompression |
| xz | LZMA compression | xz-utils | Best compression ratio |
| unxz | Decompress xz | xz-utils | Decompression |
| lz4 | Fast compression | lz4 | Speed-optimized |
| zstd | Zstandard compression | zstd | Modern, fast, good ratio |
| brotli | Brotli compression | google/brotli | Web-optimized |
| snappy | Google's fast compressor | snappy | In-memory use |
| zip | Create ZIP archives | Info-ZIP | Archive creation |
| unzip | Extract ZIP archives | Info-ZIP | Archive extraction |
| tar | Archive files (no compression) | GNU tar | Tarball creation |
| cpio | Copy files to/from archives | GNU cpio | Archive format |
| 7z | 7-Zip compression | p7zip | Multi-format support |
| ar | Create/modify archives | GNU binutils | Static library archives |
| pax | Portable archive interchange | pax | POSIX archiver |
| unrar | Extract RAR archives | unrar | RAR support |

---

## Data Formats (JSON, YAML, XML, CSV, TOML)

| Tool | Description | Source | Notes |
|------|-------------|--------|-------|
| jq | JSON query and transform | stedolan/jq | Essential for JSON |
| yq | YAML query and transform | mikefarah/yq | YAML processing |
| xq | XML to JSON + jq | kislyuk/yq | XML via jq syntax |
| xmllint | XML validation and query | libxml2 | XPath queries |
| xmlstarlet | XML toolkit | xmlstar | Transform, validate, edit |
| csvtool | CSV manipulation | csvtool | Column operations |
| csvkit | CSV utilities suite | csvkit | Multiple tools |
| miller | CSV/JSON/etc processing | johnkerl/miller | Like awk for data |
| toml2json | Convert TOML to JSON | toml11 | Format conversion |
| json2toml | Convert JSON to TOML | various | Format conversion |
| yaml2json | Convert YAML to JSON | various | Format conversion |
| json2yaml | Convert JSON to YAML | various | Format conversion |
| dasel | Query/modify JSON/YAML/XML/CSV | TomWright/dasel | Multi-format |
| fx | Interactive JSON viewer | antonmedv/fx | JSON exploration |
| gron | Make JSON greppable | tomnomnom/gron | Flatten JSON |
| jsonschema | JSON Schema validator | python-jsonschema | Schema validation |
| ajv | JSON Schema validator | ajv-validator | Fast validation |

---

## Cryptography & Hashing

| Tool | Description | Source | Notes |
|------|-------------|--------|-------|
| md5sum | Calculate MD5 hash | GNU coreutils | Legacy hashing |
| sha1sum | Calculate SHA-1 hash | GNU coreutils | Legacy hashing |
| sha256sum | Calculate SHA-256 hash | GNU coreutils | Standard hashing |
| sha512sum | Calculate SHA-512 hash | GNU coreutils | Strong hashing |
| sha3sum | Calculate SHA-3 hash | rhash | Modern hashing |
| b2sum | Calculate BLAKE2 hash | GNU coreutils | Fast secure hash |
| b3sum | Calculate BLAKE3 hash | BLAKE3 | Fastest secure hash |
| xxhash | Calculate xxHash | xxhash | Very fast non-crypto |
| crc32 | Calculate CRC32 checksum | various | Error detection |
| base64 | Encode/decode Base64 | GNU coreutils | Binary to text |
| base32 | Encode/decode Base32 | GNU coreutils | Binary to text |
| xxd | Create hex dump | vim | Hex encoding |
| hexdump | Display file in hex | util-linux | Hex viewing |
| od | Octal dump | GNU coreutils | Multiple formats |
| age | Modern file encryption | age | Simple encryption |
| openssl | Crypto toolkit (subset) | OpenSSL | Enc/dec operations |
| gpg | GnuPG (subset) | GnuPG | Symmetric encryption |
| bcrypt | Bcrypt password hashing | bcrypt | Password hashing |
| argon2 | Argon2 password hashing | argon2 | Modern password hash |
| scrypt | scrypt key derivation | scrypt | Memory-hard |
| minisign | Signature verification | minisign | Ed25519 signatures |

---

## Code Formatting & Linting

| Tool | Description | Source | Notes |
|------|-------------|--------|-------|
| clang-format | Format C/C++/Java/JS | LLVM | Multi-language |
| prettier | Format JS/TS/CSS/HTML/etc | prettier | Web languages |
| black | Format Python | psf/black | Opinionated Python |
| rustfmt | Format Rust | rust-lang | Rust formatter |
| gofmt | Format Go | golang | Go formatter |
| shfmt | Format shell scripts | mvdan/sh | Bash/sh/mksh |
| stylua | Format Lua | JohnnyMorganz | Lua formatter |
| sql-formatter | Format SQL | sql-formatter | SQL beautifier |
| pg_format | Format PostgreSQL | pgFormatter | PostgreSQL specific |
| eslint | Lint JavaScript | eslint | JS linting |
| stylelint | Lint CSS | stylelint | CSS linting |
| shellcheck | Lint shell scripts | koalaman | Shell analysis |
| hadolint | Lint Dockerfiles | hadolint | Dockerfile best practices |
| yamllint | Lint YAML | yamllint | YAML validation |
| jsonlint | Lint JSON | zaach | JSON validation |
| markdownlint | Lint Markdown | DavidAnson | MD style checking |
| editorconfig-checker | Check EditorConfig | editorconfig-checker | Style consistency |
| actionlint | Lint GitHub Actions | rhysd | Workflow validation |
| biome | Format + lint JS/TS/JSON | biomejs | Rust-based, fast |
| dprint | Pluggable formatter | dprint | Rust-based |

---

## Minification & Optimization

| Tool | Description | Source | Notes |
|------|-------------|--------|-------|
| terser | Minify JavaScript | terser | Modern JS minifier |
| uglify-js | Minify JavaScript | mishoo | ES5 minifier |
| esbuild | Bundle + minify JS | esbuild | Go-based, very fast |
| swc | Fast JS/TS compiler | swc | Rust-based |
| csso | Optimize CSS | css/csso | CSS minifier |
| clean-css | Minify CSS | clean-css | CSS optimizer |
| lightningcss | Fast CSS transform | parcel | Rust-based |
| html-minifier | Minify HTML | kangax | HTML compression |
| minify | Minify HTML/CSS/JS | tdewolff | Multi-format |
| svgo | Optimize SVG | svg/svgo | SVG compression |
| optipng | Optimize PNG | optipng | PNG compression |
| pngquant | Lossy PNG compression | pngquant | Size reduction |
| oxipng | Multi-threaded PNG optimizer | shssoichiro | Rust-based |
| jpegoptim | Optimize JPEG | tjko | JPEG optimization |
| mozjpeg | Mozilla JPEG encoder | mozilla | Better compression |
| gifsicle | Optimize GIF | kohler | GIF manipulation |
| cwebp | Convert to WebP | libwebp | WebP encoding |
| dwebp | Convert from WebP | libwebp | WebP decoding |
| gif2webp | GIF to WebP | libwebp | Animation conversion |
| avifenc | Encode AVIF | AOMediaCodec | AVIF creation |
| avifdec | Decode AVIF | AOMediaCodec | AVIF reading |
| squoosh-cli | Image compression | GoogleChromeLabs | Multi-format |

---

## Image Processing

| Tool | Description | Source | Notes |
|------|-------------|--------|-------|
| ImageMagick (convert) | Image manipulation | ImageMagick | Swiss army knife |
| GraphicsMagick | Image processing | GraphicsMagick | IM alternative |
| vips | Fast image processing | libvips | High performance |
| sharp | Image processing | lovell/sharp | Node.js wrapper for libvips |
| ffmpeg (image) | Image conversion | FFmpeg | Frame extraction |
| exiftool | Read/write metadata | exiftool | EXIF/IPTC/XMP |
| exiv2 | Metadata management | exiv2 | EXIF manipulation |
| jhead | JPEG header manipulation | jhead | EXIF editing |
| qrencode | Generate QR codes | qrencode | QR creation |
| zbarimg | Decode barcodes/QR | zbar | Barcode reading |
| tesseract | OCR engine | tesseract-ocr | Text recognition |
| potrace | Bitmap to vector | potrace | Image tracing |
| autotrace | Bitmap to vector | autotrace | Vectorization |
| primitive | Geometric primitives | fogleman/primitive | Artistic reduction |
| opencv | Computer vision | OpenCV | Full CV library |

---

## Audio Processing

| Tool | Description | Source | Notes |
|------|-------------|--------|-------|
| ffmpeg (audio) | Audio conversion | FFmpeg | Format conversion |
| sox | Sound processing | SoX | Audio effects |
| lame | MP3 encoding | LAME | MP3 encoder |
| flac | FLAC encoding/decoding | flac | Lossless audio |
| opus-tools | Opus encoding | opus-codec | Modern codec |
| vorbis-tools | OGG Vorbis tools | vorbis | OGG encoding |
| mp3gain | MP3 volume normalization | mp3gain | Level adjustment |
| loudgain | ReplayGain scanner | loudgain | Volume normalization |
| mediainfo | Media file info | MediaArea | Metadata extraction |
| fluidsynth | SoundFont synthesizer | FluidSynth | MIDI playback |

---

## Video Processing

| Tool | Description | Source | Notes |
|------|-------------|--------|-------|
| ffmpeg | Video transcoding | FFmpeg | Essential video tool |
| ffprobe | Media file analysis | FFmpeg | Metadata extraction |
| x264 | H.264 encoding | VideoLAN | Video encoding |
| x265 | H.265/HEVC encoding | MulticoreWare | Modern encoding |
| vpxenc | VP8/VP9 encoding | libvpx | WebM encoding |
| aomenc | AV1 encoding | AOMedia | Next-gen codec |
| rav1e | AV1 encoder | xiph | Rust AV1 encoder |
| dav1d | AV1 decoder | VideoLAN | Fast decoding |
| mkvmerge | MKV muxing | MKVToolNix | Container manipulation |
| mp4box | MP4 manipulation | GPAC | MP4 tools |
| gifski | High-quality GIF | sindresorhus | Video to GIF |

---

## Document Processing

| Tool | Description | Source | Notes |
|------|-------------|--------|-------|
| pandoc | Universal document converter | pandoc | Many formats |
| markdown | Markdown to HTML | various | MD processing |
| cmark | CommonMark renderer | commonmark | Standard MD |
| asciidoctor | AsciiDoc processor | asciidoctor | AsciiDoc to HTML/PDF |
| rst2html | reStructuredText to HTML | docutils | RST processing |
| pdftotext | Extract text from PDF | poppler | PDF text extraction |
| pdftoppm | PDF to images | poppler | PDF rendering |
| pdfinfo | PDF metadata | poppler | PDF information |
| qpdf | PDF manipulation | qpdf | PDF transformation |
| ghostscript | PostScript/PDF processor | Ghostscript | PDF/PS processing |
| mupdf | PDF rendering | MuPDF | Lightweight PDF |
| latex (subset) | TeX typesetting | TeX Live | Document typesetting |
| typst | Modern typesetting | typst | Fast LaTeX alternative |
| dvisvgm | DVI to SVG | dvisvgm | TeX output conversion |
| groff | Document formatting | GNU groff | Man page formatting |
| enscript | Text to PostScript | enscript | Text printing |

---

## Programming Language Tools

### Compilers & Interpreters (that can run in WASM)

| Tool | Description | Source | Notes |
|------|-------------|--------|-------|
| lua | Lua interpreter | Lua | Scripting |
| quickjs | JavaScript engine | bellard | Fast JS |
| duktape | JavaScript engine | duktape | Embeddable JS |
| micropython | Python subset | MicroPython | Embedded Python |
| pyodide | Full Python + packages | Pyodide | NumPy, Pandas, etc. |
| ruby (mruby) | Ruby subset | mruby | Embedded Ruby |
| scheme | Scheme interpreter | various | Lisp dialect |
| wasm3 | WASM interpreter | wasm3 | WASM in WASM |
| wasmtime (subset) | WASM runtime | bytecodealliance | WASI runtime |
| tcc | Tiny C Compiler | tcc | Fast C compiler |
| clang (subset) | LLVM C/C++ compiler | LLVM | Via Wasmer |
| emcc (subset) | Emscripten compiler | emscripten | C/C++ to WASM |
| assemblyscript | TypeScript-like to WASM | AssemblyScript | Native WASM |

### Static Analysis

| Tool | Description | Source | Notes |
|------|-------------|--------|-------|
| ctags | Generate tag files | universal-ctags | Code navigation |
| cscope | Code browsing | cscope | C/C++ analysis |
| cloc | Count lines of code | cloc | Code statistics |
| tokei | Code statistics | tokei | Fast line counting |
| scc | Code counter | boyter/scc | Complexity analysis |
| tree-sitter | Parser generator | tree-sitter | Syntax analysis |
| semgrep (subset) | Semantic grep | returntocorp | Pattern matching |

---

## Database & Data Tools

| Tool | Description | Source | Notes |
|------|-------------|--------|-------|
| sqlite3 | SQLite CLI | SQLite | SQL queries |
| duckdb | Analytics database | DuckDB | OLAP queries |
| q | SQL on CSV | harelba/q | CSV with SQL |
| litecli | SQLite client | litecli | Enhanced SQLite |
| usql | Universal SQL client | xo/usql | Multi-database |
| pgloader | Data loading | pgloader | ETL operations |
| csvq | SQL for CSV | mithrandie | CSV querying |

---

## Search & Find

| Tool | Description | Source | Notes |
|------|-------------|--------|-------|
| ripgrep (rg) | Fast regex search | BurntSushi | Very fast grep |
| ag | Silver Searcher | ggreer | Fast code search |
| ack | Code search | beyondgrep | Programmer's grep |
| pt | Platinum Searcher | monochromegane | Fast search |
| ugrep | Universal grep | Genivia | Feature-rich |
| fzf | Fuzzy finder | junegunn | Interactive search |
| fd | Fast find alternative | sharkdp | Modern find |

---

## File Analysis

| Tool | Description | Source | Notes |
|------|-------------|--------|-------|
| file | Detect file type | file | Magic number detection |
| mimetype | MIME type detection | various | Content type |
| stat | File information | GNU coreutils | File metadata |
| du | Disk usage | GNU coreutils | Size calculation |
| tree | Directory listing | tree | Visual structure |
| ncdu | NCurses disk usage | ncdu | Interactive du |
| dirstat | Directory statistics | various | Folder analysis |
| binwalk | Firmware analysis | binwalk | Embedded file extraction |
| strings | Extract strings | GNU binutils | Text extraction |
| hexyl | Hex viewer | sharkdp | Modern hex viewer |
| ent | Entropy calculation | fourmilab | Randomness analysis |

---

## Network Data Processing (Offline)

| Tool | Description | Source | Notes |
|------|-------------|--------|-------|
| tcpdump (parser) | PCAP parsing | tcpdump | Packet analysis |
| tshark (subset) | Wireshark CLI | Wireshark | Protocol dissection |
| ngrep | Network grep | ngrep | Packet pattern matching |
| tcpflow | TCP stream extraction | tcpflow | Flow reconstruction |
| pcapfix | Repair PCAP files | pcapfix | File recovery |
| capinfos | PCAP statistics | Wireshark | Capture info |

---

## Encoding & Conversion

| Tool | Description | Source | Notes |
|------|-------------|--------|-------|
| iconv | Character encoding conversion | glibc | Charset conversion |
| uconv | Unicode conversion | ICU | Unicode handling |
| recode | Character set conversion | recode | Multi-charset |
| dos2unix | Line ending conversion | dos2unix | CRLF to LF |
| unix2dos | Line ending conversion | dos2unix | LF to CRLF |
| uuencode | UU encoding | sharutils | Binary encoding |
| uudecode | UU decoding | sharutils | Binary decoding |
| ascii85 | Ascii85 encoding | various | PDF encoding |
| basenc | Various encodings | GNU coreutils | Multi-encoding |

---

## Math & Scientific

| Tool | Description | Source | Notes |
|------|-------------|--------|-------|
| bc | Calculator | GNU bc | Arbitrary precision |
| dc | Desk calculator | GNU | RPN calculator |
| units | Unit conversion | GNU units | Unit conversion |
| gnuplot (subset) | Plotting | gnuplot | Chart generation |
| octave (subset) | MATLAB-like | GNU Octave | Numerical computing |
| maxima | Computer algebra | Maxima | Symbolic math |
| R (subset) | Statistics | R | Statistical analysis |
| datamash | Statistics on text | GNU datamash | Column statistics |
| numfmt | Number formatting | GNU coreutils | Number display |

---

## Utilities & Misc

| Tool | Description | Source | Notes |
|------|-------------|--------|-------|
| uuid | Generate UUIDs | util-linux | ID generation |
| uuidgen | Generate UUIDs | util-linux | UUID creation |
| date | Date manipulation | GNU coreutils | Time formatting |
| cal | Calendar | util-linux | Calendar display |
| seq | Print sequences | GNU coreutils | Number generation |
| shuf | Shuffle lines | GNU coreutils | Randomization |
| factor | Prime factorization | GNU coreutils | Math utility |
| expr | Expression evaluation | GNU coreutils | Simple math |
| printf | Format and print | GNU coreutils | Output formatting |
| yes | Repeat string | GNU coreutils | Output generation |
| true/false | Exit codes | GNU coreutils | Shell helpers |
| env | Environment handling | GNU coreutils | Variable display |
| pwd | Print working directory | GNU coreutils | Path display |
| dirname | Extract directory | GNU coreutils | Path manipulation |
| basename | Extract filename | GNU coreutils | Path manipulation |
| realpath | Resolve path | GNU coreutils | Path resolution |
| mktemp | Create temp file | GNU coreutils | Temp file creation |
| timeout | Run with time limit | GNU coreutils | Execution control |

---

## Security & Analysis

| Tool | Description | Source | Notes |
|------|-------------|--------|-------|
| jwt-cli | JWT encode/decode | mike-engel/jwt-cli | Token handling |
| pastel | Color manipulation | sharkdp/pastel | Color tools |
| hyperfine | Benchmarking | sharkdp | Performance testing |
| licenses | License detection | licensee | License identification |
| trivy (subset) | Vulnerability scanning | aquasecurity | SBOM analysis |
| syft | SBOM generation | anchore | Dependency listing |
| cosign (verify) | Signature verification | sigstore | Image verification |

---

## Template & Code Generation

| Tool | Description | Source | Notes |
|------|-------------|--------|-------|
| envsubst | Substitute env vars | gettext | Template processing |
| gomplate | Template rendering | hairyhenderson | Multi-format templates |
| j2cli | Jinja2 CLI | kolypto | Python templates |
| mustache | Mustache templates | mustache | Logic-less templates |
| handlebars | Handlebars templates | handlebars | Extended mustache |
| tera | Tera templates | Keats/tera | Rust templates |
| jsonnet | JSON templating | google/jsonnet | Data templating |
| dhall | Programmable config | dhall-lang | Config language |
| cue | Configure Unify Execute | cuelang | Config + validation |

---

## Build & Package Tools

| Tool | Description | Source | Notes |
|------|-------------|--------|-------|
| make | Build automation | GNU Make | Build tool |
| ninja | Fast build system | ninja-build | Parallel builds |
| cmake (subset) | Build generator | CMake | Project configuration |
| autoconf | Configure scripts | GNU | Build config |
| pkg-config | Library info | pkg-config | Dependency info |
| strip | Strip symbols | GNU binutils | Binary optimization |
| objdump | Object file dump | GNU binutils | Binary analysis |
| nm | List symbols | GNU binutils | Symbol listing |
| size | Section sizes | GNU binutils | Binary size |
| readelf | ELF info | GNU binutils | ELF analysis |

---

## Version Control (Offline Operations)

| Tool | Description | Source | Notes |
|------|-------------|--------|-------|
| git (subset) | Version control | Git | Local operations only |
| diff-so-fancy | Better diff | so-fancy | Diff formatting |
| delta | Syntax highlighting diff | dandavison | Git diff viewer |
| tig | Git TUI | jonas | Git browser |
| gitui | Git TUI | extrawurst | Git interface |

---

## Recommended Priority for Implementation

### Tier 1: Essential (Already Available as WASM)
Use existing ports first:
- **sql.js / DuckDB-Wasm** - Database queries
- **ffmpeg.wasm** - Media processing
- **tesseract.js** - OCR
- **libarchive.js** - Archive handling
- **hash-wasm** - All hashing algorithms
- **markdown-wasm** - Fast markdown
- **Prettier** - Code formatting
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
