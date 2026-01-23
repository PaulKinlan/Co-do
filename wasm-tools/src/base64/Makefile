# base64 WASM Tool Makefile
#
# Requirements:
# - WASI SDK installed (https://github.com/WebAssembly/wasi-sdk)
# - Set WASI_SDK_PATH environment variable to the SDK location
#
# Example: export WASI_SDK_PATH=/opt/wasi-sdk

WASI_SDK_PATH ?= /opt/wasi-sdk
CC = $(WASI_SDK_PATH)/bin/clang
CFLAGS = --target=wasm32-wasi -O2
# Note: Do NOT use --no-entry for WASI programs with main().
# WASI programs export _start as the entry point, which calls main().
LDFLAGS = -Wl,--export-all

OUTPUT_DIR = ../../binaries

.PHONY: all clean

all: $(OUTPUT_DIR)/base64.wasm

$(OUTPUT_DIR)/base64.wasm: main.c | $(OUTPUT_DIR)
	$(CC) $(CFLAGS) $(LDFLAGS) -o $@ $<

$(OUTPUT_DIR):
	mkdir -p $(OUTPUT_DIR)

clean:
	rm -f $(OUTPUT_DIR)/base64.wasm
