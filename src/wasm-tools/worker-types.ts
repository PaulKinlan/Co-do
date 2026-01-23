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
  /** Standard input content */
  stdin?: string;
  /**
   * Pre-loaded files for the WASM module.
   * Keys are virtual paths, values are file contents.
   */
  files?: Record<string, string>;
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
 * Validate and clamp execution options to safe values.
 */
export function sanitizeExecutionOptions(
  options: Partial<ExecutionOptions>
): WorkerExecutionOptions {
  return {
    timeout: Math.min(
      Math.max(options.timeout ?? DEFAULT_TIMEOUT, 100),
      MAX_TIMEOUT
    ),
    memoryPages: options.memoryLimit
      ? Math.min(options.memoryLimit, MEMORY_LIMITS.MEDIA)
      : MEMORY_LIMITS.DEFAULT,
    stdin: options.stdin,
  };
}
