/**
 * WASM Worker Manager
 *
 * Manages the lifecycle of WASM sandbox Workers from the main thread.
 * Handles:
 * - Worker creation and termination
 * - Message passing for execution requests
 * - Timeout enforcement with true termination
 * - Resource cleanup
 *
 * Security: Workers provide isolation from the main thread. If a WASM module
 * attempts to hang or consume resources, we can terminate the Worker cleanly.
 */

import type { ExecutionResult } from './types';
import type { WorkerRequest, WorkerResponse } from './worker-types';
import {
  generateRequestId,
  sanitizeExecutionOptions,
  DEFAULT_TIMEOUT,
  MAX_TIMEOUT,
} from './worker-types';

/**
 * Pending execution tracking.
 */
interface PendingExecution {
  resolve: (result: ExecutionResult) => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
  worker: Worker;
}

/**
 * Options for Worker execution.
 */
export interface WorkerManagerExecutionOptions {
  /** Timeout in milliseconds (default: 30000, max: 300000) */
  timeout?: number;
  /** Maximum memory in WebAssembly pages (64KB each) */
  memoryPages?: number;
  /** Standard input content */
  stdin?: string;
  /** Pre-loaded files (path -> content) */
  files?: Record<string, string>;
}

/**
 * WASM Worker Manager - handles Worker-based WASM execution.
 *
 * Each execution gets a fresh Worker for isolation. Workers are terminated
 * after execution completes or on timeout.
 */
export class WasmWorkerManager {
  private pending: Map<string, PendingExecution> = new Map();
  private isSupported: boolean = true;

  constructor() {
    // Check for Worker support
    if (typeof Worker === 'undefined') {
      console.warn('[WasmWorkerManager] Web Workers not supported, falling back to main thread');
      this.isSupported = false;
    }
  }

  /**
   * Check if Worker-based execution is supported.
   */
  get supported(): boolean {
    return this.isSupported;
  }

  /**
   * Execute a WASM module in an isolated Worker.
   *
   * @param wasmBinary - The compiled WASM binary
   * @param args - Command-line arguments for the module
   * @param options - Execution options
   * @returns Execution result with stdout, stderr, and exit code
   */
  async execute(
    wasmBinary: ArrayBuffer,
    args: string[],
    options: WorkerManagerExecutionOptions = {}
  ): Promise<ExecutionResult> {
    if (!this.isSupported) {
      throw new Error('Web Workers not supported in this environment');
    }

    const requestId = generateRequestId();
    const sanitizedOptions = sanitizeExecutionOptions(options);

    // Create a new Worker for this execution
    const worker = this.createWorker();

    return new Promise<ExecutionResult>((resolve, reject) => {
      // Set up timeout for true termination
      const timeout = options.timeout ?? DEFAULT_TIMEOUT;
      const timeoutId = setTimeout(() => {
        this.terminateExecution(requestId, 'Execution timeout');
      }, Math.min(timeout, MAX_TIMEOUT));

      // Track this pending execution
      this.pending.set(requestId, {
        resolve,
        reject,
        timeoutId,
        worker,
      });

      // Set up message handler
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        this.handleWorkerResponse(event.data);
      };

      worker.onerror = (error) => {
        this.terminateExecution(
          requestId,
          `Worker error: ${error.message || 'Unknown error'}`
        );
      };

      // Send execution request
      const request: WorkerRequest = {
        type: 'execute',
        id: requestId,
        wasmBinary,
        args,
        options: sanitizedOptions,
      };

      // Transfer the ArrayBuffer to avoid copying
      worker.postMessage(request, [wasmBinary]);
    });
  }

  /**
   * Create a new Worker instance.
   * Uses Vite's URL-based Worker support for proper bundling.
   */
  private createWorker(): Worker {
    // Use Vite's built-in Worker bundling via new URL() + import.meta.url
    // This ensures the Worker is properly compiled and bundled
    return new Worker(
      new URL('./wasm-worker.ts', import.meta.url),
      { type: 'module' }
    );
  }

  /**
   * Handle a response from a Worker.
   */
  private handleWorkerResponse(response: WorkerResponse): void {
    const pending = this.pending.get(response.id);
    if (!pending) {
      console.warn(`[WasmWorkerManager] Received response for unknown request: ${response.id}`);
      return;
    }

    // Clear timeout
    clearTimeout(pending.timeoutId);

    // Terminate the Worker (clean up)
    pending.worker.terminate();

    // Remove from pending
    this.pending.delete(response.id);

    // Handle response type
    switch (response.type) {
      case 'result':
        if (response.result) {
          pending.resolve(response.result);
        } else {
          pending.reject(new Error('No result in response'));
        }
        break;

      case 'error':
        pending.reject(new Error(response.error || 'Unknown error'));
        break;

      case 'progress':
        // Progress updates are informational, don't resolve yet
        // Future: Could emit events for streaming output
        break;

      default:
        pending.reject(new Error(`Unknown response type: ${response.type}`));
    }
  }

  /**
   * Terminate an execution (due to timeout or cancellation).
   */
  private terminateExecution(requestId: string, reason: string): void {
    const pending = this.pending.get(requestId);
    if (!pending) return;

    // Clear timeout
    clearTimeout(pending.timeoutId);

    // CRITICAL: Actually terminate the Worker
    // This is the key security feature - it truly stops WASM execution
    pending.worker.terminate();

    // Remove from pending
    this.pending.delete(requestId);

    // Reject the promise
    pending.reject(new Error(reason));
  }

  /**
   * Cancel a specific execution by request ID.
   */
  cancel(requestId: string): boolean {
    if (this.pending.has(requestId)) {
      this.terminateExecution(requestId, 'Cancelled by user');
      return true;
    }
    return false;
  }

  /**
   * Cancel all pending executions.
   * Useful for cleanup when the user navigates away or closes the tool manager.
   */
  cancelAll(): void {
    for (const requestId of this.pending.keys()) {
      this.terminateExecution(requestId, 'All executions cancelled');
    }
  }

  /**
   * Get the number of currently running executions.
   */
  get runningCount(): number {
    return this.pending.size;
  }

  /**
   * Get the IDs of currently running executions.
   */
  get runningIds(): string[] {
    return Array.from(this.pending.keys());
  }
}

// Export singleton instance
export const wasmWorkerManager = new WasmWorkerManager();
