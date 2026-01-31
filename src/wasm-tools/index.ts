/**
 * WASM Custom Tools Module
 *
 * This module provides the infrastructure for loading and executing
 * WebAssembly-based custom tools in Co-do.
 *
 * Security: By default, WASM tools execute in isolated Web Workers.
 * This prevents UI blocking and enables true termination of runaway modules.
 */

// Types
export * from './types';
export * from './worker-types';

// Registry
export { BUILTIN_TOOLS, getToolsByCategory, getCategories, getWasmToolName, getCategoryDisplayName, CATEGORY_DISPLAY_NAMES, CATEGORY_DISPLAY_ORDER } from './registry';

// Virtual File System
export { VirtualFileSystem } from './vfs';

// Runtime (main thread - used as fallback)
export { WasmRuntime, wasmRuntime } from './runtime';

// Worker Manager (recommended for production)
export { WasmWorkerManager, wasmWorkerManager } from './worker-manager';

// Loader
export { WasmToolLoader, wasmToolLoader } from './loader';

// Manager (main entry point)
export {
  WasmToolManager,
  wasmToolManager,
  setWasmPermissionCallback,
  getWasmToolPermission,
  setWasmToolPermission,
  convertArgsToCliFormat,
} from './manager';
