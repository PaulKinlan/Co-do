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
| zip | Create ZIP archives | Info-ZIP | Archive creation |
| unzip | Extract ZIP archives | Info-ZIP | Archive extraction |
| tar | Archive files (no compression) | GNU tar | Tarball creation |
| cpio | Copy files to/from archives | GNU cpio | Archive format |
| 7z | 7-Zip compression | p7zip | Multi-format support |
| ar | Create/modify archives | GNU binutils | Static library archives |
| pax | Portable archive interchange | pax | POSIX archiver |

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

---

## Minification & Optimization

| Tool | Description | Source | Notes |
|------|-------------|--------|-------|
| terser | Minify JavaScript | terser | Modern JS minifier |
| uglify-js | Minify JavaScript | mishoo | ES5 minifier |
| csso | Optimize CSS | css/csso | CSS minifier |
| clean-css | Minify CSS | clean-css | CSS optimizer |
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
| latex (subset) | TeX typesetting | TeX Live | Document typesetting |
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
| ruby (mruby) | Ruby subset | mruby | Embedded Ruby |
| scheme | Scheme interpreter | various | Lisp dialect |
| wasm3 | WASM interpreter | wasm3 | WASM in WASM |
| wasmtime (subset) | WASM runtime | bytecodealliance | WASI runtime |
| tcc | Tiny C Compiler | tcc | Fast C compiler |
| emcc (subset) | Emscripten compiler | emscripten | C/C++ to WASM |

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

### Tier 1: Essential (Implement First)
- jq, yq - Data manipulation
- base64, sha256sum - Encoding/hashing
- gzip/gunzip, zip/unzip - Compression
- prettier, eslint - Code formatting
- terser, csso, svgo - Minification
- pandoc, markdown - Document processing
- sqlite3 - Database queries
- ripgrep - Fast search

### Tier 2: High Value
- ffmpeg/ffprobe - Media processing
- ImageMagick - Image manipulation
- optipng, mozjpeg, cwebp - Image optimization
- diff, patch - Code comparison
- sed, awk - Text transformation
- clang-format, shfmt - More formatters
- tesseract - OCR

### Tier 3: Specialized
- age - Encryption
- duckdb - Analytics
- tree-sitter - Code analysis
- quickjs, lua - Scripting
- qrencode - QR generation
- potrace - Vectorization

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
   - Excellent tooling support
   - Many CLI tools already have Rust ports

### Existing WASM Ports

Many tools already have WASM versions:
- **libarchive.js** - Archive handling
- **sql.js** - SQLite in browser
- **ffmpeg.wasm** - Full FFmpeg port
- **sharp-wasm** - Image processing
- **jq-web** - jq in browser
- **tree-sitter-wasm** - Parsing
- **tesseract.js** - OCR
- **imagemagick-wasm** - Image processing

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

## Resources

- [WebAssembly.org](https://webassembly.org/)
- [WASI](https://wasi.dev/)
- [Emscripten](https://emscripten.org/)
- [wasm-pack](https://rustwasm.github.io/wasm-pack/)
- [Awesome WASM](https://github.com/mbasso/awesome-wasm)
- [WebAssembly Weekly](https://wasmweekly.news/)
