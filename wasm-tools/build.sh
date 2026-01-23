#!/bin/bash
# Build script for WASM tools
# Automatically downloads WASI SDK if not found
# Builds all tools from source for a complete one-step build

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WASM_TOOLS_DIR="$SCRIPT_DIR"
SRC_DIR="$WASM_TOOLS_DIR/src"
BIN_DIR="$WASM_TOOLS_DIR/binaries"
LIB_DIR="$WASM_TOOLS_DIR/libs"
CACHE_DIR="$WASM_TOOLS_DIR/.cache"
BUILD_DIR="$WASM_TOOLS_DIR/.build"

# WASI SDK version and download URLs
WASI_SDK_VERSION="24"
WASI_SDK_VERSION_FULL="24.0"

# Detect platform for WASI SDK download
detect_platform() {
    local os=$(uname -s | tr '[:upper:]' '[:lower:]')
    local arch=$(uname -m)

    case "$os" in
        darwin)
            if [ "$arch" = "arm64" ]; then
                echo "arm64-macos"
            else
                echo "x86_64-macos"
            fi
            ;;
        linux)
            if [ "$arch" = "aarch64" ]; then
                echo "aarch64-linux"
            else
                echo "x86_64-linux"
            fi
            ;;
        mingw*|msys*|cygwin*)
            echo "x86_64-windows"
            ;;
        *)
            echo "x86_64-linux"  # Default fallback
            ;;
    esac
}

PLATFORM=$(detect_platform)
WASI_SDK_DOWNLOAD_URL="https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-${WASI_SDK_VERSION}/wasi-sdk-${WASI_SDK_VERSION_FULL}-${PLATFORM}.tar.gz"

# Create directories
mkdir -p "$BIN_DIR" "$LIB_DIR" "$CACHE_DIR" "$BUILD_DIR"

# ============================================
# Tool Categories
# ============================================

# Native tools - simple enough to implement ourselves
NATIVE_TOOLS=(
    # Crypto/Encoding (well-defined algorithms)
    "base64"
    "md5sum"
    "sha256sum"
    "sha512sum"
    "xxd"
    "uuid"

    # Text Processing (trivial algorithms)
    "wc"
    "head"
    "tail"
    "cut"
    "sort"
    "uniq"
    "tr"
    "grep"
    "sed"
    "awk"
    "diff"
    "patch"

    # Data Format (manageable complexity)
    "toml2json"
    "csvtool"
    "markdown"
    "jwt"
    "xmllint"
    "yq"

    # File utilities (output formatting)
    "file"
    "du"
    "stat"
    "tree"
    "touch"
    "truncate"

    # Code tools (basic implementations)
    "shfmt"
    "minify"
    "terser"
    "csso"
    "html-minifier"

    # Search (basic fuzzy matching)
    "fzf"
)

# External libraries - use real implementations
# Format: "tool_name|source_url|binary_name"
# Use BUILD_FROM_SOURCE when pre-built isn't available
EXTERNAL_LIBS=(
    # Database - sql.js provides SQLite compiled to WASM
    "sqlite3|https://sql.js.org/dist/sql-wasm.wasm|sqlite3.wasm"

    # Compression - use real libraries
    "gzip|BUILD_FROM_SOURCE|gzip.wasm"      # Build zlib with WASI SDK

    # Future additions (require more work):
    # "jq|BUILD_FROM_SOURCE|jq.wasm"        # Complex autotools build
    # "ripgrep|BUILD_FROM_SOURCE|ripgrep.wasm"  # Requires Rust toolchain
)

# Heavy tools - load on demand (large binaries)
HEAVY_TOOLS=(
    "ffprobe"   # ffmpeg.wasm ~25MB
    "ffmpeg"    # Full ffmpeg
)

# ============================================
# WASI SDK Setup
# ============================================

download_wasi_sdk() {
    local sdk_dir="$WASM_TOOLS_DIR/.wasi-sdk"
    local tarball="$CACHE_DIR/wasi-sdk-${WASI_SDK_VERSION_FULL}.tar.gz"

    echo "Downloading WASI SDK ${WASI_SDK_VERSION_FULL} for ${PLATFORM}..."
    echo "URL: $WASI_SDK_DOWNLOAD_URL"

    # Download if not cached
    if [ ! -f "$tarball" ]; then
        curl -L -f --progress-bar -o "$tarball" "$WASI_SDK_DOWNLOAD_URL" || {
            echo "Error: Failed to download WASI SDK"
            echo "Please download manually from: https://github.com/WebAssembly/wasi-sdk/releases"
            return 1
        }
    else
        echo "Using cached WASI SDK download"
    fi

    # Extract
    echo "Extracting WASI SDK..."
    rm -rf "$sdk_dir"
    mkdir -p "$sdk_dir"
    tar -xzf "$tarball" -C "$sdk_dir" --strip-components=1 || {
        echo "Error: Failed to extract WASI SDK"
        rm -f "$tarball"
        return 1
    }

    echo "✓ WASI SDK installed to $sdk_dir"
    export WASI_SDK_PATH="$sdk_dir"
    return 0
}

check_wasi_sdk() {
    # Check if already set via environment
    if [ -n "$WASI_SDK_PATH" ] && [ -f "$WASI_SDK_PATH/bin/clang" ]; then
        echo "Using WASI SDK at: $WASI_SDK_PATH"
        return 0
    fi

    # Check common locations
    for sdk_path in \
        "$WASM_TOOLS_DIR/.wasi-sdk" \
        "/opt/wasi-sdk" \
        "$HOME/wasi-sdk" \
        "/usr/local/wasi-sdk"; do
        if [ -f "$sdk_path/bin/clang" ]; then
            export WASI_SDK_PATH="$sdk_path"
            echo "Using WASI SDK at: $WASI_SDK_PATH"
            return 0
        fi
    done

    # Not found - download it
    echo "WASI SDK not found. Downloading automatically..."
    download_wasi_sdk || return 1

    return 0
}

# ============================================
# Build Functions
# ============================================

build_native_tool() {
    local tool_name="$1"
    local tool_dir="$SRC_DIR/$tool_name"

    if [ ! -d "$tool_dir" ]; then
        echo "  Skipping $tool_name (no source directory)"
        return 0
    fi

    local src_file="$tool_dir/main.c"
    if [ ! -f "$src_file" ]; then
        echo "  Skipping $tool_name (no main.c)"
        return 0
    fi

    echo "  Building $tool_name..."

    "$WASI_SDK_PATH/bin/clang" \
        --target=wasm32-wasi \
        --sysroot="$WASI_SDK_PATH/share/wasi-sysroot" \
        -O2 \
        -o "$BIN_DIR/$tool_name.wasm" \
        "$src_file" 2>&1 || {
            echo "  Failed to build $tool_name"
            return 1
        }

    echo "  ✓ Built $tool_name"
}

# ============================================
# External Library Build Functions
# ============================================

# Check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Clone or update a git repository
clone_or_update_repo() {
    local repo_url="$1"
    local dest_dir="$2"
    local branch="${3:-}"

    if [ -d "$dest_dir/.git" ]; then
        echo "  Using existing clone at $dest_dir"
        return 0
    fi

    echo "  Cloning $repo_url..."
    rm -rf "$dest_dir"

    # Try specific branch if provided, otherwise clone default branch
    if [ -n "$branch" ]; then
        git clone --depth 1 --branch "$branch" "$repo_url" "$dest_dir" 2>/dev/null && return 0
    fi

    # Fall back to default branch
    git clone --depth 1 "$repo_url" "$dest_dir" 2>/dev/null && return 0

    echo "  Failed to clone $repo_url"
    return 1
}

# Build jq from source
build_jq() {
    local jq_version="1.7.1"
    local jq_src="$BUILD_DIR/jq"
    local jq_url="https://github.com/jqlang/jq"

    echo "  Building jq..."

    # Check for required tools
    if ! command_exists autoreconf; then
        echo "  Warning: autoreconf not found. Installing autotools may be required."
        echo "  On macOS: brew install autoconf automake libtool"
        echo "  On Ubuntu: sudo apt install autoconf automake libtool"
        return 1
    fi

    # Clone jq source
    clone_or_update_repo "$jq_url" "$jq_src" "jq-${jq_version}" || \
    clone_or_update_repo "$jq_url" "$jq_src" "master"

    (
        cd "$jq_src"

        # Initialize submodules for oniguruma
        git submodule update --init --recursive 2>/dev/null || true

        # Generate configure script
        if [ ! -f configure ]; then
            autoreconf -i 2>/dev/null || {
                echo "  Warning: autoreconf failed, trying without oniguruma..."
            }
        fi

        # Configure for WASI
        export CC="$WASI_SDK_PATH/bin/clang"
        export AR="$WASI_SDK_PATH/bin/llvm-ar"
        export RANLIB="$WASI_SDK_PATH/bin/llvm-ranlib"
        export CFLAGS="--target=wasm32-wasi --sysroot=$WASI_SDK_PATH/share/wasi-sysroot -O2 -DNDEBUG"
        export LDFLAGS="--target=wasm32-wasi --sysroot=$WASI_SDK_PATH/share/wasi-sysroot"

        # Try to configure and build
        if [ -f configure ]; then
            ./configure --host=wasm32-wasi \
                --disable-maintainer-mode \
                --with-oniguruma=builtin \
                --disable-docs 2>&1 || {
                # Try without oniguruma if it fails
                ./configure --host=wasm32-wasi \
                    --disable-maintainer-mode \
                    --without-oniguruma \
                    --disable-docs 2>&1
            }

            make clean 2>/dev/null || true
            make -j$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4) 2>&1

            if [ -f jq ]; then
                cp jq "$BIN_DIR/jq.wasm"
                echo "  ✓ Built jq"
                return 0
            fi
        fi

        echo "  Warning: jq build failed, using simplified implementation"
        return 1
    ) || return 1
}

# Build zlib/gzip from source
build_gzip() {
    local zlib_version="1.3.1"
    local zlib_src="$BUILD_DIR/zlib"

    echo "  Building gzip (zlib)..."

    # Download official zlib tarball
    echo "  Downloading zlib ${zlib_version}..."
    local tarball="$CACHE_DIR/zlib-${zlib_version}.tar.gz"
    if [ ! -f "$tarball" ]; then
        curl -L -f --progress-bar -o "$tarball" "https://zlib.net/zlib-${zlib_version}.tar.gz" || {
            echo "  Failed to download zlib"
            return 1
        }
    fi
    rm -rf "$zlib_src"
    mkdir -p "$zlib_src"
    tar -xzf "$tarball" -C "$zlib_src" --strip-components=1

    (
        cd "$zlib_src"

        # Compile zlib sources directly to avoid configure/make issues with WASI
        export CC="$WASI_SDK_PATH/bin/clang"
        export AR="$WASI_SDK_PATH/bin/llvm-ar"
        export CFLAGS="--target=wasm32-wasi --sysroot=$WASI_SDK_PATH/share/wasi-sysroot -O2"

        mkdir -p build_wasi

        # Compile core source files (exclude gzip file I/O which uses lseek)
        for src in adler32.c compress.c crc32.c deflate.c infback.c inffast.c \
                   inflate.c inftrees.c trees.c uncompr.c zutil.c; do
            $CC $CFLAGS -c "$src" -o "build_wasi/${src%.c}.o" 2>&1 || return 1
        done

        # Create static library
        $AR rcs build_wasi/libz.a build_wasi/*.o 2>&1

        # Build gzip wrapper using the library
        if [ -f build_wasi/libz.a ]; then
            # Create a simple gzip main that uses zlib
            cat > gzip_main.c << 'GZIP_EOF'
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "zlib.h"

#define CHUNK 16384

int main(int argc, char **argv) {
    int decompress = 0;
    FILE *source = stdin;
    FILE *dest = stdout;

    // Parse arguments
    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "-d") == 0) {
            decompress = 1;
        }
    }

    unsigned char in[CHUNK];
    unsigned char out[CHUNK];

    if (decompress) {
        // Decompress
        z_stream strm = {0};
        inflateInit2(&strm, 16 + MAX_WBITS);  // gzip format

        int ret;
        do {
            strm.avail_in = fread(in, 1, CHUNK, source);
            if (strm.avail_in == 0) break;
            strm.next_in = in;

            do {
                strm.avail_out = CHUNK;
                strm.next_out = out;
                ret = inflate(&strm, Z_NO_FLUSH);
                if (ret == Z_STREAM_ERROR || ret == Z_DATA_ERROR || ret == Z_MEM_ERROR) {
                    inflateEnd(&strm);
                    return 1;
                }
                fwrite(out, 1, CHUNK - strm.avail_out, dest);
            } while (strm.avail_out == 0);
        } while (ret != Z_STREAM_END);

        inflateEnd(&strm);
    } else {
        // Compress
        z_stream strm = {0};
        deflateInit2(&strm, Z_DEFAULT_COMPRESSION, Z_DEFLATED, 16 + MAX_WBITS, 8, Z_DEFAULT_STRATEGY);

        int flush;
        do {
            strm.avail_in = fread(in, 1, CHUNK, source);
            flush = feof(source) ? Z_FINISH : Z_NO_FLUSH;
            strm.next_in = in;

            do {
                strm.avail_out = CHUNK;
                strm.next_out = out;
                deflate(&strm, flush);
                fwrite(out, 1, CHUNK - strm.avail_out, dest);
            } while (strm.avail_out == 0);
        } while (flush != Z_FINISH);

        deflateEnd(&strm);
    }

    return 0;
}
GZIP_EOF

            $CC $CFLAGS -I. -c gzip_main.c -o build_wasi/gzip_main.o 2>&1
            $CC $CFLAGS -o "$BIN_DIR/gzip.wasm" build_wasi/gzip_main.o build_wasi/libz.a 2>&1

            if [ -f "$BIN_DIR/gzip.wasm" ]; then
                echo "  ✓ Built gzip"
                return 0
            fi
        fi

        echo "  Warning: gzip build failed"
        return 1
    ) || return 1
}

# Build ripgrep from Rust source
build_ripgrep() {
    echo "  Building ripgrep..."

    # Check for Rust/Cargo
    if ! command_exists cargo; then
        echo "  Warning: cargo (Rust) not found. Required for ripgrep."
        echo "  Install from: https://rustup.rs/"
        return 1
    fi

    # Check for wasm32-wasi target
    if ! rustup target list --installed 2>/dev/null | grep -q "wasm32-wasi"; then
        echo "  Installing Rust wasm32-wasi target..."
        rustup target add wasm32-wasi || {
            echo "  Warning: Failed to add wasm32-wasi target"
            return 1
        }
    fi

    local rg_src="$BUILD_DIR/ripgrep"

    clone_or_update_repo "https://github.com/BurntSushi/ripgrep" "$rg_src" || {
        echo "  Failed to clone ripgrep"
        return 1
    }

    (
        cd "$rg_src"

        # Build for WASM
        cargo build --release --target wasm32-wasi 2>&1

        if [ -f target/wasm32-wasi/release/rg.wasm ]; then
            cp target/wasm32-wasi/release/rg.wasm "$BIN_DIR/ripgrep.wasm"
            echo "  ✓ Built ripgrep"
            return 0
        fi

        echo "  Warning: ripgrep build failed"
        return 1
    ) || return 1
}

# Master function to build a library from source
build_from_source() {
    local tool_name="$1"

    case "$tool_name" in
        jq)
            build_jq
            ;;
        gzip)
            build_gzip
            ;;
        ripgrep)
            build_ripgrep
            ;;
        *)
            echo "  Warning: No build function for $tool_name"
            return 1
            ;;
    esac
}

download_external_lib() {
    local tool_name="$1"
    local source_url="$2"
    local binary_name="$3"

    local dest_file="$BIN_DIR/$binary_name"

    # Check if already built/downloaded
    if [ -f "$dest_file" ]; then
        echo "  $tool_name: Already available"
        return 0
    fi

    if [ "$source_url" = "BUILD_FROM_SOURCE" ]; then
        echo "  Building $tool_name from source..."
        build_from_source "$tool_name" || {
            echo "  Warning: $tool_name build failed, skipping"
            return 1
        }
        return 0
    fi

    echo "  Downloading $tool_name from $source_url..."

    curl -L -f --progress-bar -o "$dest_file" "$source_url" || {
        echo "  Warning: Failed to download $tool_name"
        return 1
    }

    echo "  ✓ Downloaded $tool_name"
}

# ============================================
# Main Script
# ============================================

echo "========================================"
echo "  WASM Tools Build System"
echo "========================================"
echo ""

# Parse arguments
BUILD_NATIVE=true
BUILD_EXTERNAL=true
SPECIFIC_TOOLS=()

while [[ $# -gt 0 ]]; do
    case $1 in
        --native-only)
            BUILD_EXTERNAL=false
            shift
            ;;
        --external-only)
            BUILD_NATIVE=false
            shift
            ;;
        --help)
            echo "Usage: $0 [options] [tool1] [tool2] ..."
            echo ""
            echo "This script builds all WASM tools automatically, including:"
            echo "  - Downloading and installing WASI SDK if not found"
            echo "  - Building native C tools (simple implementations)"
            echo "  - Building external libraries from source (gzip)"
            echo ""
            echo "Options:"
            echo "  --native-only    Only build native C tools"
            echo "  --external-only  Only build/download external libraries"
            echo "  --help           Show this help"
            echo ""
            echo "Native tools (${#NATIVE_TOOLS[@]} tools):"
            printf "  %s\n" "${NATIVE_TOOLS[@]}" | fmt -w 70 || printf "  %s\n" "${NATIVE_TOOLS[@]}"
            echo ""
            echo "External libraries (built from source):"
            for lib in "${EXTERNAL_LIBS[@]}"; do
                name="${lib%%|*}"
                source="${lib#*|}"
                source="${source%%|*}"
                if [ "$source" = "BUILD_FROM_SOURCE" ]; then
                    echo "  $name (built from source)"
                else
                    echo "  $name (pre-built)"
                fi
            done
            echo ""
            echo "Prerequisites for building from source:"
            echo "  - curl (for downloading dependencies)"
            exit 0
            ;;
        *)
            SPECIFIC_TOOLS+=("$1")
            shift
            ;;
    esac
done

# Ensure WASI SDK is available for any builds that need it
WASI_SDK_AVAILABLE=false
if [ "$BUILD_NATIVE" = true ] || [ "$BUILD_EXTERNAL" = true ]; then
    if check_wasi_sdk; then
        WASI_SDK_AVAILABLE=true
    fi
fi

# Build native tools
if [ "$BUILD_NATIVE" = true ]; then
    echo "Building native tools..."
    echo ""

    if [ "$WASI_SDK_AVAILABLE" = true ]; then
        if [ ${#SPECIFIC_TOOLS[@]} -eq 0 ]; then
            for tool in "${NATIVE_TOOLS[@]}"; do
                build_native_tool "$tool" || true
            done
        else
            for tool in "${SPECIFIC_TOOLS[@]}"; do
                build_native_tool "$tool" || true
            done
        fi
    else
        echo "Skipping native tools (WASI SDK not available)"
    fi
    echo ""
fi

# Build/download external libraries
if [ "$BUILD_EXTERNAL" = true ]; then
    echo "External libraries (building from source where needed)..."
    echo ""

    for lib_spec in "${EXTERNAL_LIBS[@]}"; do
        IFS='|' read -r tool_name source_url binary_name <<< "$lib_spec"

        if [ ${#SPECIFIC_TOOLS[@]} -eq 0 ] || [[ " ${SPECIFIC_TOOLS[*]} " =~ " ${tool_name} " ]]; then
            # Skip build-from-source tools if WASI SDK is not available
            if [ "$source_url" = "BUILD_FROM_SOURCE" ] && [ "$WASI_SDK_AVAILABLE" != true ]; then
                echo "  Skipping $tool_name (WASI SDK not available)"
                continue
            fi
            download_external_lib "$tool_name" "$source_url" "$binary_name" || true
        fi
    done
    echo ""
fi

# ============================================
# Generate Manifests and ZIP Packages
# ============================================

DIST_DIR="$WASM_TOOLS_DIR/dist"
mkdir -p "$DIST_DIR"

# Tool manifest lookup function (bash 3.x compatible)
# Returns: category|description|argStyle|fileAccess
get_tool_info() {
    local tool_name="$1"
    case "$tool_name" in
        # Crypto/Encoding tools
        base64) echo "crypto|Encode or decode data using Base64 encoding|positional|none" ;;
        md5sum) echo "crypto|Calculate MD5 hash of text|positional|none" ;;
        sha256sum) echo "crypto|Calculate SHA-256 hash of text|positional|none" ;;
        sha512sum) echo "crypto|Calculate SHA-512 hash of text|positional|none" ;;
        xxd) echo "crypto|Create a hex dump or reverse a hex dump|positional|none" ;;
        uuid) echo "crypto|Generate a random UUID v4|positional|none" ;;

        # Text Processing tools
        wc) echo "text|Count lines, words, and characters in text|cli|none" ;;
        head) echo "text|Output the first N lines of text|cli|none" ;;
        tail) echo "text|Output the last N lines of text|cli|none" ;;
        cut) echo "text|Extract columns/fields from text|cli|none" ;;
        sort) echo "text|Sort lines of text alphabetically or numerically|cli|none" ;;
        uniq) echo "text|Report or filter out repeated adjacent lines|cli|none" ;;
        tr) echo "text|Translate or delete characters in text|positional|none" ;;
        grep) echo "text|Search for patterns in text|cli|none" ;;
        sed) echo "text|Stream editor for text transformation|positional|none" ;;
        awk) echo "text|Pattern scanning and processing|cli|none" ;;
        diff) echo "text|Compare two texts and show differences|positional|none" ;;
        patch) echo "text|Apply a diff/patch to text|positional|none" ;;

        # Data Format tools
        toml2json) echo "data|Convert TOML to JSON format|positional|none" ;;
        csvtool) echo "data|Process CSV data|positional|none" ;;
        markdown) echo "data|Convert Markdown to HTML|positional|none" ;;
        jwt) echo "data|Decode and inspect JWT tokens|positional|none" ;;
        xmllint) echo "data|Validate and format XML documents|positional|none" ;;
        yq) echo "data|Query and transform YAML data|positional|none" ;;

        # File Utilities
        file) echo "file|Determine file type from content|positional|none" ;;
        du) echo "file|Calculate and format file sizes|cli|none" ;;
        stat) echo "file|Display formatted file information|positional|none" ;;
        tree) echo "file|Display directory structure as a tree|positional|none" ;;
        touch) echo "file|Create or update file timestamps|positional|write" ;;
        truncate) echo "file|Truncate or extend text to a specific length|positional|none" ;;

        # Code/Minification tools
        shfmt) echo "code|Format shell scripts|positional|none" ;;
        minify) echo "code|Minify JavaScript code|positional|none" ;;
        terser) echo "code|Minify JavaScript code (terser-like)|positional|none" ;;
        csso) echo "code|Minify CSS code|positional|none" ;;
        html-minifier) echo "code|Minify HTML code|positional|none" ;;

        # Search tools
        fzf) echo "search|Fuzzy find matching items from a list|positional|none" ;;

        # Compression tools
        gzip) echo "compression|Compress or decompress using gzip format|cli|none" ;;

        # Database tools
        sqlite3) echo "database|SQLite database engine|json|none" ;;

        # Default - unknown tool
        *) echo "" ;;
    esac
}

generate_manifest() {
    local tool_name="$1"
    local wasm_file="$2"
    local manifest_file="$3"

    # Get tool info from lookup function
    local info=$(get_tool_info "$tool_name")
    if [ -z "$info" ]; then
        echo "  Warning: No manifest info for $tool_name"
        return 1
    fi

    IFS='|' read -r category description arg_style file_access <<< "$info"

    # Generate JSON manifest
    cat > "$manifest_file" << EOF
{
  "name": "$tool_name",
  "version": "1.0.0",
  "description": "$description",
  "parameters": {
    "type": "object",
    "properties": {
      "input": {
        "type": "string",
        "description": "Input to process"
      }
    },
    "required": ["input"]
  },
  "returns": {
    "type": "string",
    "description": "The output of the command"
  },
  "execution": {
    "argStyle": "$arg_style",
    "fileAccess": "$file_access",
    "timeout": 30000
  },
  "category": "$category",
  "author": "Co-do",
  "license": "MIT"
}
EOF

    return 0
}

create_zip_package() {
    local tool_name="$1"
    local wasm_file="$BIN_DIR/${tool_name}.wasm"
    local manifest_file="$DIST_DIR/${tool_name}.manifest.json"
    local zip_file="$DIST_DIR/${tool_name}.zip"

    if [ ! -f "$wasm_file" ]; then
        return 1
    fi

    # Generate manifest
    generate_manifest "$tool_name" "$wasm_file" "$manifest_file" || return 1

    # Create ZIP package (manifest.json + tool.wasm)
    local temp_dir=$(mktemp -d)
    cp "$manifest_file" "$temp_dir/manifest.json"
    cp "$wasm_file" "$temp_dir/${tool_name}.wasm"

    (cd "$temp_dir" && zip -q "$zip_file" manifest.json "${tool_name}.wasm")
    rm -rf "$temp_dir"

    echo "  ✓ Created $tool_name.zip"
    return 0
}

echo ""
echo "========================================"
echo "  Generating Manifests and Packages"
echo "========================================"
echo ""

# Generate manifests and ZIP packages for all built tools
PACKAGED_COUNT=0
for wasm_file in "$BIN_DIR"/*.wasm; do
    if [ -f "$wasm_file" ]; then
        tool_name=$(basename "$wasm_file" .wasm)
        if create_zip_package "$tool_name"; then
            ((PACKAGED_COUNT++))
        fi
    fi
done

echo ""
echo "Packaged $PACKAGED_COUNT tools to: $DIST_DIR"

# Generate tools index file
echo ""
echo "Generating tools index..."

TOOLS_INDEX="$DIST_DIR/tools-index.json"
cat > "$TOOLS_INDEX" << 'HEADER'
{
  "version": "1.0.0",
  "generated": "TIMESTAMP",
  "tools": [
HEADER

# Replace timestamp
sed -i.bak "s/TIMESTAMP/$(date -u +%Y-%m-%dT%H:%M:%SZ)/" "$TOOLS_INDEX"
rm -f "${TOOLS_INDEX}.bak"

# Add each tool to the index
FIRST_TOOL=true
for manifest_file in "$DIST_DIR"/*.manifest.json; do
    if [ -f "$manifest_file" ]; then
        tool_name=$(basename "$manifest_file" .manifest.json)
        info=$(get_tool_info "$tool_name")
        if [ -n "$info" ]; then
            IFS='|' read -r category description arg_style file_access <<< "$info"
            wasm_size=$(stat -f%z "$BIN_DIR/${tool_name}.wasm" 2>/dev/null || stat --printf="%s" "$BIN_DIR/${tool_name}.wasm" 2>/dev/null || echo "0")

            if [ "$FIRST_TOOL" = true ]; then
                FIRST_TOOL=false
                printf '    {\n' >> "$TOOLS_INDEX"
            else
                printf ',\n    {\n' >> "$TOOLS_INDEX"
            fi

            cat >> "$TOOLS_INDEX" << EOF
      "name": "$tool_name",
      "category": "$category",
      "description": "$description",
      "wasmUrl": "wasm-tools/binaries/${tool_name}.wasm",
      "packageUrl": "wasm-tools/dist/${tool_name}.zip",
      "manifestUrl": "wasm-tools/dist/${tool_name}.manifest.json",
      "size": $wasm_size
    }
EOF
        fi
    fi
done

# Close the JSON array
cat >> "$TOOLS_INDEX" << 'FOOTER'

  ]
}
FOOTER

echo "  ✓ Generated tools-index.json with $(grep -c '"name":' "$TOOLS_INDEX") tools"

# Summary
echo ""
echo "========================================"
echo "  Build Summary"
echo "========================================"
echo ""
echo "Binaries directory: $BIN_DIR"
echo ""

if ls "$BIN_DIR"/*.wasm 1>/dev/null 2>&1; then
    echo "Built binaries:"
    ls -lh "$BIN_DIR"/*.wasm | awk '{print "  " $NF " (" $5 ")"}'
else
    echo "No binaries built yet."
fi

echo ""
echo "WASI SDK location: ${WASI_SDK_PATH:-not set}"
echo ""
if ls "$BUILD_DIR"/*/ 1>/dev/null 2>&1; then
    echo "Build cache: $BUILD_DIR"
    echo "To rebuild a specific tool, delete its directory from the cache."
fi
echo ""
echo "Run '$0 --help' for available options."
