#!/bin/bash
# Build script for WASM tools
# Requires WASI SDK for native tools
# Downloads pre-built binaries for complex libraries

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WASM_TOOLS_DIR="$SCRIPT_DIR"
SRC_DIR="$WASM_TOOLS_DIR/src"
BIN_DIR="$WASM_TOOLS_DIR/binaries"
LIB_DIR="$WASM_TOOLS_DIR/libs"
CACHE_DIR="$WASM_TOOLS_DIR/.cache"

# Create directories
mkdir -p "$BIN_DIR" "$LIB_DIR" "$CACHE_DIR"

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

    # JSON processing - jq needs to be built from source with WASI SDK
    "jq|BUILD_FROM_SOURCE|jq.wasm"

    # Compression - use real libraries
    "gzip|BUILD_FROM_SOURCE|gzip.wasm"      # Build zlib with WASI SDK
    "brotli|BUILD_FROM_SOURCE|brotli.wasm"  # Build google/brotli
    "zstd|BUILD_FROM_SOURCE|zstd.wasm"      # Build facebook/zstd

    # Archive
    "tar|BUILD_FROM_SOURCE|tar.wasm"        # Build libarchive
    "zip|BUILD_FROM_SOURCE|zip.wasm"        # Build libarchive or minizip
    "unzip|BUILD_FROM_SOURCE|unzip.wasm"

    # Text processing - ripgrep is Rust, can compile to wasm32-wasi
    "ripgrep|BUILD_FROM_SOURCE|ripgrep.wasm"
)

# Heavy tools - load on demand (large binaries)
HEAVY_TOOLS=(
    "ffprobe"   # ffmpeg.wasm ~25MB
    "ffmpeg"    # Full ffmpeg
)

# ============================================
# WASI SDK Setup
# ============================================

check_wasi_sdk() {
    if [ -z "$WASI_SDK_PATH" ]; then
        if [ -d "/opt/wasi-sdk" ]; then
            export WASI_SDK_PATH="/opt/wasi-sdk"
        elif [ -d "$HOME/wasi-sdk" ]; then
            export WASI_SDK_PATH="$HOME/wasi-sdk"
        elif [ -d "/usr/local/wasi-sdk" ]; then
            export WASI_SDK_PATH="/usr/local/wasi-sdk"
        else
            echo "Warning: WASI SDK not found. Native tools won't be built."
            echo "Download from: https://github.com/WebAssembly/wasi-sdk/releases"
            return 1
        fi
    fi

    if [ ! -f "$WASI_SDK_PATH/bin/clang" ]; then
        echo "Error: WASI SDK clang not found at $WASI_SDK_PATH/bin/clang"
        return 1
    fi

    echo "Using WASI SDK at: $WASI_SDK_PATH"
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

download_external_lib() {
    local tool_name="$1"
    local source_url="$2"
    local binary_name="$3"

    if [ "$source_url" = "BUILD_FROM_SOURCE" ]; then
        echo "  $tool_name: Requires building from source (see LIBRARIES.md)"
        return 0
    fi

    local dest_file="$BIN_DIR/$binary_name"

    if [ -f "$dest_file" ]; then
        echo "  $tool_name: Already downloaded"
        return 0
    fi

    echo "  Downloading $tool_name from $source_url..."

    curl -L -f -o "$dest_file" "$source_url" 2>/dev/null || {
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
            echo "Options:"
            echo "  --native-only    Only build native C tools"
            echo "  --external-only  Only download external libraries"
            echo "  --help           Show this help"
            echo ""
            echo "Native tools (simple implementations):"
            printf "  %s\n" "${NATIVE_TOOLS[@]}"
            echo ""
            echo "External libraries (real implementations):"
            for lib in "${EXTERNAL_LIBS[@]}"; do
                echo "  ${lib%%|*}"
            done
            exit 0
            ;;
        *)
            SPECIFIC_TOOLS+=("$1")
            shift
            ;;
    esac
done

# Build native tools
if [ "$BUILD_NATIVE" = true ]; then
    echo "Building native tools..."
    echo ""

    if check_wasi_sdk; then
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

# Download external libraries
if [ "$BUILD_EXTERNAL" = true ]; then
    echo "External libraries..."
    echo "(Note: Some require manual building - see LIBRARIES.md)"
    echo ""

    for lib_spec in "${EXTERNAL_LIBS[@]}"; do
        IFS='|' read -r tool_name source_url binary_name <<< "$lib_spec"

        if [ ${#SPECIFIC_TOOLS[@]} -eq 0 ] || [[ " ${SPECIFIC_TOOLS[*]} " =~ " ${tool_name} " ]]; then
            download_external_lib "$tool_name" "$source_url" "$binary_name" || true
        fi
    done
    echo ""
fi

# Summary
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
echo "For external libraries that need building from source:"
echo "  1. Download the library source"
echo "  2. Configure with WASI SDK"
echo "  3. Build and copy .wasm to $BIN_DIR"
echo ""
echo "See LIBRARIES.md for detailed instructions."
