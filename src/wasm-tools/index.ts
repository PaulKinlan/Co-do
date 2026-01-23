/**
 * WASM Custom Tools Module
 *
 * This module provides the infrastructure for loading and executing
 * WebAssembly-based custom tools in Co-do.
 */

// Types
export * from './types';

// Registry
export { BUILTIN_TOOLS, getToolsByCategory, getCategories, hasNameConflict, getWasmToolName } from './registry';

// Virtual File System
export { VirtualFileSystem } from './vfs';

// Runtime
export { WasmRuntime, wasmRuntime } from './runtime';

// Loader
export { WasmToolLoader, wasmToolLoader } from './loader';

// Manager (main entry point)
export {
  WasmToolManager,
  wasmToolManager,
  setWasmPermissionCallback,
  getWasmToolPermission,
  setWasmToolPermission,
} from './manager';
