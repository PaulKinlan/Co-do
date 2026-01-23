# WASM Tools

This directory contains the source code and build scripts for WASM custom tools.

## Directory Structure

```
wasm-tools/
├── src/              # Source code for tools
│   └── base64/       # Example base64 tool
│       ├── main.c    # C source code
│       └── Makefile  # Build script
├── manifests/        # JSON manifests for tools
│   └── base64.json   # Manifest describing the base64 tool
├── binaries/         # Compiled WASM binaries (gitignored)
│   └── base64.wasm   # Compiled tool
└── README.md         # This file
```

## Building Tools

### Prerequisites

1. Install the [WASI SDK](https://github.com/WebAssembly/wasi-sdk)
2. Set the `WASI_SDK_PATH` environment variable:

```bash
export WASI_SDK_PATH=/path/to/wasi-sdk
```

### Build a Single Tool

```bash
cd src/base64
make
```

### Build All Tools

From the `wasm-tools` directory:

```bash
for dir in src/*/; do
  (cd "$dir" && make)
done
```

## Creating New Tools

1. Create a new directory in `src/` with your tool name
2. Write your C/C++/Rust code (must be WASI-compatible)
3. Create a `Makefile` based on the `base64` example
4. Create a manifest in `manifests/` describing your tool's interface
5. Build and test your tool

### Manifest Format

See `manifests/base64.json` for an example. Key fields:

- `name`: Tool identifier (lowercase, no spaces)
- `description`: What the tool does (used by the AI)
- `parameters`: JSON schema for input arguments
- `execution.argStyle`: How arguments are passed (`cli`, `positional`, or `json`)
- `execution.fileAccess`: File system access level (`none`, `read`, `write`, `readwrite`)

### WASI Compatibility

Tools must be compiled for WASI (WebAssembly System Interface). Key points:

- Use standard C library functions (stdio, string, etc.)
- stdout/stderr are captured and returned to the AI
- stdin can receive JSON input for `argStyle: "json"`
- File system access is sandboxed to the project directory

## Testing Tools

After building, you can test a tool by:

1. Creating a ZIP file containing the `.wasm` and `manifest.json`
2. Installing it via the Co-do UI
3. Using it through the AI chat

Or you can add it to the built-in registry in `src/wasm-tools/registry.ts`.
