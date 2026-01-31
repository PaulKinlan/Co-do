/**
 * WASM Worker Types
 *
 * Type definitions for communication between the main thread and WASM Workers.
 * This module is shared between both contexts.
 */

import type { ExecutionOptions, ExecutionResult } from './types';

/**
 * Memory limit categories for different tool types.
 * Values are in WebAssembly pages (64KB each).
 */
export const MEMORY_LIMITS = {
  /** Default limit: 32MB (512 pages) */
  DEFAULT: 512,
  /** Text processing: 32MB */
  TEXT: 512,
  /** Image processing: 128MB (2048 pages) */
  IMAGE: 2048,
  /** Media processing: 256MB (4096 pages) - use with caution */
  MEDIA: 4096,
} as const;

/**
 * Default timeout for WASM execution (30 seconds).
 */
export const DEFAULT_TIMEOUT = 30000;

/**
 * Maximum timeout allowed (5 minutes).
 */
export const MAX_TIMEOUT = 300000;

/**
 * Request message sent from main thread to Worker.
 */
export interface WorkerRequest {
  type: 'execute';
  /** Unique request ID for correlating responses */
  id: string;
  /** WASM binary to execute */
  wasmBinary: ArrayBuffer;
  /** Command-line arguments for the WASM module */
  args: string[];
  /** Execution options */
  options: WorkerExecutionOptions;
}

/**
 * Execution options for the Worker.
 * Subset of ExecutionOptions without file access (handled separately).
 */
export interface WorkerExecutionOptions {
  /** Timeout in milliseconds */
  timeout: number;
  /** Maximum memory in WebAssembly pages (64KB each) */
  memoryPages?: number;
  /** Standard input content (text) */
  stdin?: string;
  /** Binary stdin data. Takes precedence over `stdin` when both are set. */
  stdinBinary?: ArrayBuffer;
  /**
   * Pre-loaded text files for the WASM module.
   * Keys are virtual paths, values are file contents as text.
   */
  files?: Record<string, string>;
  /**
   * Pre-loaded binary files for the WASM module.
   * Keys are virtual paths, values are raw file contents.
   */
  filesBinary?: Record<string, ArrayBuffer>;
}

/**
 * Response message sent from Worker to main thread.
 */
export interface WorkerResponse {
  type: 'result' | 'error' | 'progress';
  /** Request ID this response correlates to */
  id: string;
  /** Execution result (for type: 'result') */
  result?: ExecutionResult;
  /** Error message (for type: 'error') */
  error?: string;
  /** Progress update with partial output */
  progress?: {
    stdout: string;
    stderr: string;
  };
}

/**
 * Generate a unique request ID.
 */
export function generateRequestId(): string {
  return `wasm-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Extended options that may include memoryPages and files.
 */
interface ExtendedOptions extends Omit<Partial<ExecutionOptions>, 'stdinBinary'> {
  memoryPages?: number;
  /** Binary stdin — accepts both Uint8Array (from ExecutionOptions) and ArrayBuffer (from WorkerManager). */
  stdinBinary?: Uint8Array | ArrayBuffer;
  files?: Record<string, string>;
  filesBinary?: Record<string, ArrayBuffer>;
}

/**
 * Validate and clamp execution options to safe values.
 * Supports both legacy `memoryLimit` and newer `memoryPages` options.
 */
export function sanitizeExecutionOptions(
  options: ExtendedOptions
): WorkerExecutionOptions {
  // Support both legacy `memoryLimit` and newer `memoryPages` options
  const rawMemoryPages =
    options.memoryPages != null
      ? options.memoryPages
      : options.memoryLimit;

  const memoryPages =
    rawMemoryPages != null
      ? Math.min(rawMemoryPages, MEMORY_LIMITS.MEDIA)
      : MEMORY_LIMITS.DEFAULT;

  // Normalize stdinBinary to ArrayBuffer for transfer over postMessage
  let stdinBinaryBuffer: ArrayBuffer | undefined;
  if (options.stdinBinary) {
    if (options.stdinBinary instanceof Uint8Array) {
      stdinBinaryBuffer = options.stdinBinary.buffer.slice(
        options.stdinBinary.byteOffset,
        options.stdinBinary.byteOffset + options.stdinBinary.byteLength
      ) as ArrayBuffer;
    } else {
      stdinBinaryBuffer = options.stdinBinary;
    }
  }

  return {
    timeout: Math.min(
      Math.max(options.timeout ?? DEFAULT_TIMEOUT, 100),
      MAX_TIMEOUT
    ),
    memoryPages,
    stdin: options.stdin,
    stdinBinary: stdinBinaryBuffer,
    // Pass through pre-loaded files when provided
    files: options.files,
    filesBinary: options.filesBinary,
  };
}
