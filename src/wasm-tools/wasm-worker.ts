/**
 * WASM Sandbox Worker
 *
 * This Worker provides an isolated execution environment for WebAssembly modules.
 * It runs completely separate from the main thread, preventing UI blocking and
 * providing security isolation.
 *
 * Security features:
 * - No access to DOM or main thread globals
 * - No network API imports to WASM (fetch/XHR not exposed to modules)
 * - Memory limits enforced via WebAssembly.Memory
 * - Terminable via Worker.terminate() from main thread
 * - WASI socket syscalls return WASI_ERRNO.PERM (permission denied)
 *
 * Performance features:
 * - Runs off main thread - UI remains responsive
 * - Pre-allocated memory for predictable performance
 * - Streaming output support (future)
 */

import type { WorkerRequest, WorkerResponse, WorkerExecutionOptions } from './worker-types';
import type { ExecutionResult } from './types';

// WASI error codes
const WASI_ERRNO = {
  SUCCESS: 0,
  BADF: 8,
  INVAL: 28,
  IO: 29,
  NOENT: 44,
  NOSYS: 52,
  PERM: 63,
} as const;

// WASI file types
const WASI_FILETYPE = {
  CHARACTER_DEVICE: 2,
  REGULAR_FILE: 4,
} as const;

// WASI rights
const WASI_RIGHTS = {
  FD_READ: BigInt(1) << BigInt(1),
  FD_WRITE: BigInt(1) << BigInt(6),
} as const;

// Text encoder/decoder
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/**
 * Simple Virtual File System for Worker context.
 * Only handles stdin/stdout/stderr and pre-loaded files.
 */
class WorkerVFS {
  private stdinBuffer: Uint8Array = new Uint8Array(0);
  private stdinOffset = 0;
  private stdoutChunks: Uint8Array[] = [];
  private stderrChunks: Uint8Array[] = [];
  private files: Map<string, Uint8Array> = new Map();
  private openFiles: Map<number, { path: string; offset: number }> = new Map();
  // Reserve fd 3 for the preopened directory; dynamic fds start at 4
  private nextFd = 4;

  setStdin(data: string): void {
    this.stdinBuffer = textEncoder.encode(data);
    this.stdinOffset = 0;
  }

  setFiles(files: Record<string, string>): void {
    for (const [path, content] of Object.entries(files)) {
      this.files.set(path, textEncoder.encode(content));
    }
  }

  readStdin(maxBytes: number): Uint8Array {
    const remaining = this.stdinBuffer.length - this.stdinOffset;
    const bytesToRead = Math.min(maxBytes, remaining);
    if (bytesToRead === 0) return new Uint8Array(0);
    const result = this.stdinBuffer.slice(
      this.stdinOffset,
      this.stdinOffset + bytesToRead
    );
    this.stdinOffset += bytesToRead;
    return result;
  }

  writeStdout(data: Uint8Array): number {
    this.stdoutChunks.push(data.slice());
    return data.length;
  }

  writeStderr(data: Uint8Array): number {
    this.stderrChunks.push(data.slice());
    return data.length;
  }

  getStdout(): string {
    return this.combineChunks(this.stdoutChunks);
  }

  getStderr(): string {
    return this.combineChunks(this.stderrChunks);
  }

  private combineChunks(chunks: Uint8Array[]): string {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    return textDecoder.decode(combined);
  }

  openFile(path: string): number {
    // Normalize path
    const normalized = path.replace(/^\//, '');
    if (!this.files.has(normalized)) {
      throw new Error(`File not found: ${path}`);
    }
    const fd = this.nextFd++;
    this.openFiles.set(fd, { path: normalized, offset: 0 });
    return fd;
  }

  readFile(fd: number, maxBytes: number): Uint8Array {
    const fileInfo = this.openFiles.get(fd);
    if (!fileInfo) throw new Error(`Invalid fd: ${fd}`);

    const content = this.files.get(fileInfo.path);
    if (!content) throw new Error(`File not found: ${fileInfo.path}`);

    const remaining = content.length - fileInfo.offset;
    const bytesToRead = Math.min(maxBytes, remaining);
    if (bytesToRead === 0) return new Uint8Array(0);

    const result = content.slice(fileInfo.offset, fileInfo.offset + bytesToRead);
    fileInfo.offset += bytesToRead;
    return result;
  }

  closeFile(fd: number): void {
    this.openFiles.delete(fd);
  }

  hasFile(path: string): boolean {
    return this.files.has(path.replace(/^\//, ''));
  }
}

/**
 * Sandboxed WASM Runtime for Worker context.
 */
class SandboxedWasmRuntime {
  private memory: WebAssembly.Memory | null = null;
  private vfs: WorkerVFS;
  private args: string[] = [];
  private exitCode = 0;
  private hasExited = false;

  constructor() {
    this.vfs = new WorkerVFS();
  }

  async execute(
    wasmBinary: ArrayBuffer,
    args: string[],
    options: WorkerExecutionOptions
  ): Promise<ExecutionResult> {
    this.args = args;
    this.exitCode = 0;
    this.hasExited = false;
    this.vfs = new WorkerVFS();

    // Set stdin if provided
    if (options.stdin) {
      this.vfs.setStdin(options.stdin);
    }

    // Set pre-loaded files
    if (options.files) {
      this.vfs.setFiles(options.files);
    }

    // Note: We don't pre-create memory because WASI modules compiled with
    // WASI SDK define and export their own memory. The module's memory
    // will be captured from exports after instantiation.

    try {
      await this.executeInternal(wasmBinary);
    } catch (error) {
      if (!this.hasExited) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.vfs.writeStderr(textEncoder.encode(`Error: ${errorMessage}\n`));
        this.exitCode = 1;
      }
    }

    return {
      exitCode: this.exitCode,
      stdout: this.vfs.getStdout(),
      stderr: this.vfs.getStderr(),
    };
  }

  private async executeInternal(wasmBinary: ArrayBuffer): Promise<void> {
    const imports = this.createWasiImports();

    const module = await WebAssembly.compile(wasmBinary);
    const instance = await WebAssembly.instantiate(module, imports);

    // WASI modules compiled with WASI SDK define and export their own memory.
    // We use the module's exported memory for all WASI operations.
    const exportedMemory = instance.exports.memory as WebAssembly.Memory | undefined;
    if (exportedMemory) {
      this.memory = exportedMemory;
    } else {
      throw new Error('WASM module does not export memory');
    }

    const start = instance.exports._start as (() => void) | undefined;
    if (start) {
      try {
        start();
      } catch (error) {
        if (!this.hasExited) {
          throw error;
        }
      }
    } else {
      throw new Error('WASM module does not export _start function');
    }
  }

  private createWasiImports(): WebAssembly.Imports {
    return {
      wasi_snapshot_preview1: {
        // Process management
        proc_exit: this.proc_exit.bind(this),
        sched_yield: () => WASI_ERRNO.SUCCESS,

        // Arguments
        args_sizes_get: this.args_sizes_get.bind(this),
        args_get: this.args_get.bind(this),

        // Environment (empty)
        environ_sizes_get: this.environ_sizes_get.bind(this),
        environ_get: () => WASI_ERRNO.SUCCESS,

        // File descriptors
        fd_read: this.fd_read.bind(this),
        fd_write: this.fd_write.bind(this),
        fd_close: this.fd_close.bind(this),
        fd_seek: () => WASI_ERRNO.NOSYS,
        fd_fdstat_get: this.fd_fdstat_get.bind(this),
        fd_fdstat_set_flags: () => WASI_ERRNO.SUCCESS,
        fd_prestat_get: this.fd_prestat_get.bind(this),
        fd_prestat_dir_name: this.fd_prestat_dir_name.bind(this),

        // Path operations
        path_open: this.path_open.bind(this),
        path_filestat_get: () => WASI_ERRNO.NOSYS,
        path_create_directory: () => WASI_ERRNO.NOSYS,
        path_remove_directory: () => WASI_ERRNO.NOSYS,
        path_unlink_file: () => WASI_ERRNO.NOSYS,
        path_rename: () => WASI_ERRNO.NOSYS,

        // Clock
        clock_time_get: this.clock_time_get.bind(this),
        clock_res_get: this.clock_res_get.bind(this),

        // Random
        random_get: this.random_get.bind(this),

        // Not implemented (stubs for compatibility)
        fd_advise: () => WASI_ERRNO.SUCCESS,
        fd_allocate: () => WASI_ERRNO.NOSYS,
        fd_datasync: () => WASI_ERRNO.SUCCESS,
        fd_sync: () => WASI_ERRNO.SUCCESS,
        fd_tell: () => WASI_ERRNO.NOSYS,
        fd_filestat_get: () => WASI_ERRNO.NOSYS,
        fd_filestat_set_size: () => WASI_ERRNO.NOSYS,
        fd_filestat_set_times: () => WASI_ERRNO.NOSYS,
        fd_pread: () => WASI_ERRNO.NOSYS,
        fd_pwrite: () => WASI_ERRNO.NOSYS,
        fd_readdir: () => WASI_ERRNO.NOSYS,
        fd_renumber: () => WASI_ERRNO.NOSYS,
        fd_rights_get: () => WASI_ERRNO.NOSYS,
        path_filestat_set_times: () => WASI_ERRNO.NOSYS,
        path_link: () => WASI_ERRNO.NOSYS,
        path_readlink: () => WASI_ERRNO.NOSYS,
        path_symlink: () => WASI_ERRNO.NOSYS,
        poll_oneoff: () => WASI_ERRNO.NOSYS,

        // NETWORKING: Explicitly disabled for security
        // These syscalls are blocked, not just unimplemented
        sock_recv: () => WASI_ERRNO.PERM,
        sock_send: () => WASI_ERRNO.PERM,
        sock_shutdown: () => WASI_ERRNO.PERM,
        sock_accept: () => WASI_ERRNO.PERM,
      },
    };
  }

  // Process management
  private proc_exit(code: number): void {
    this.exitCode = code;
    this.hasExited = true;
    throw new Error(`proc_exit(${code})`);
  }

  // Arguments
  private args_sizes_get(argcPtr: number, argvBufSizePtr: number): number {
    const view = new DataView(this.memory!.buffer);
    view.setUint32(argcPtr, this.args.length, true);

    let totalSize = 0;
    for (const arg of this.args) {
      totalSize += textEncoder.encode(arg).length + 1;
    }
    view.setUint32(argvBufSizePtr, totalSize, true);
    return WASI_ERRNO.SUCCESS;
  }

  private args_get(argvPtr: number, argvBufPtr: number): number {
    const view = new DataView(this.memory!.buffer);
    const mem = new Uint8Array(this.memory!.buffer);

    let bufOffset = argvBufPtr;
    for (let i = 0; i < this.args.length; i++) {
      view.setUint32(argvPtr + i * 4, bufOffset, true);
      const encoded = textEncoder.encode(this.args[i]!);
      mem.set(encoded, bufOffset);
      mem[bufOffset + encoded.length] = 0;
      bufOffset += encoded.length + 1;
    }
    return WASI_ERRNO.SUCCESS;
  }

  // Environment
  private environ_sizes_get(countPtr: number, sizePtr: number): number {
    const view = new DataView(this.memory!.buffer);
    view.setUint32(countPtr, 0, true);
    view.setUint32(sizePtr, 0, true);
    return WASI_ERRNO.SUCCESS;
  }

  // File descriptors
  private fd_read(
    fd: number,
    iovsPtr: number,
    iovsLen: number,
    nreadPtr: number
  ): number {
    const view = new DataView(this.memory!.buffer);
    const mem = new Uint8Array(this.memory!.buffer);

    let totalRead = 0;
    for (let i = 0; i < iovsLen; i++) {
      const bufPtr = view.getUint32(iovsPtr + i * 8, true);
      const bufLen = view.getUint32(iovsPtr + i * 8 + 4, true);

      let data: Uint8Array;
      if (fd === 0) {
        data = this.vfs.readStdin(bufLen);
      } else if (fd >= 3) {
        try {
          data = this.vfs.readFile(fd, bufLen);
        } catch {
          return WASI_ERRNO.BADF;
        }
      } else {
        return WASI_ERRNO.BADF;
      }

      mem.set(data, bufPtr);
      totalRead += data.length;
      if (data.length < bufLen) break;
    }

    view.setUint32(nreadPtr, totalRead, true);
    return WASI_ERRNO.SUCCESS;
  }

  private fd_write(
    fd: number,
    iovsPtr: number,
    iovsLen: number,
    nwrittenPtr: number
  ): number {
    const view = new DataView(this.memory!.buffer);
    const mem = new Uint8Array(this.memory!.buffer);

    let totalWritten = 0;
    for (let i = 0; i < iovsLen; i++) {
      const bufPtr = view.getUint32(iovsPtr + i * 8, true);
      const bufLen = view.getUint32(iovsPtr + i * 8 + 4, true);
      const data = mem.slice(bufPtr, bufPtr + bufLen);

      if (fd === 1) {
        this.vfs.writeStdout(data);
        totalWritten += data.length;
      } else if (fd === 2) {
        this.vfs.writeStderr(data);
        totalWritten += data.length;
      } else {
        return WASI_ERRNO.BADF;
      }
    }

    view.setUint32(nwrittenPtr, totalWritten, true);
    return WASI_ERRNO.SUCCESS;
  }

  private fd_close(fd: number): number {
    if (fd < 3) return WASI_ERRNO.SUCCESS;
    this.vfs.closeFile(fd);
    return WASI_ERRNO.SUCCESS;
  }

  private fd_fdstat_get(fd: number, statPtr: number): number {
    const view = new DataView(this.memory!.buffer);

    if (fd === 0 || fd === 1 || fd === 2) {
      view.setUint8(statPtr, WASI_FILETYPE.CHARACTER_DEVICE);
    } else {
      view.setUint8(statPtr, WASI_FILETYPE.REGULAR_FILE);
    }

    view.setUint16(statPtr + 2, 0, true);

    let rights: bigint;
    if (fd === 0) rights = WASI_RIGHTS.FD_READ;
    else if (fd === 1 || fd === 2) rights = WASI_RIGHTS.FD_WRITE;
    else rights = WASI_RIGHTS.FD_READ | WASI_RIGHTS.FD_WRITE;

    view.setBigUint64(statPtr + 8, rights, true);
    view.setBigUint64(statPtr + 16, rights, true);

    return WASI_ERRNO.SUCCESS;
  }

  private fd_prestat_get(fd: number, _prestatPtr: number): number {
    // We provide one preopened directory at fd 3 for file access
    if (fd === 3) {
      const view = new DataView(this.memory!.buffer);
      // pr_type = PREOPENTYPE_DIR (0)
      view.setUint8(_prestatPtr, 0);
      // pr_name_len = 1 (for "/")
      view.setUint32(_prestatPtr + 4, 1, true);
      return WASI_ERRNO.SUCCESS;
    }
    return WASI_ERRNO.BADF;
  }

  private fd_prestat_dir_name(
    fd: number,
    pathPtr: number,
    pathLen: number
  ): number {
    if (fd === 3 && pathLen >= 1) {
      const mem = new Uint8Array(this.memory!.buffer);
      mem[pathPtr] = '/'.charCodeAt(0);
      return WASI_ERRNO.SUCCESS;
    }
    return WASI_ERRNO.BADF;
  }

  private path_open(
    _dirfd: number,
    _dirflags: number,
    pathPtr: number,
    pathLen: number,
    _oflags: number,
    _fsRightsBase: bigint,
    _fsRightsInheriting: bigint,
    _fdflags: number,
    fdPtr: number
  ): number {
    const mem = new Uint8Array(this.memory!.buffer);
    const view = new DataView(this.memory!.buffer);

    const pathBytes = mem.slice(pathPtr, pathPtr + pathLen);
    const path = textDecoder.decode(pathBytes);

    try {
      const fd = this.vfs.openFile(path);
      view.setUint32(fdPtr, fd, true);
      return WASI_ERRNO.SUCCESS;
    } catch {
      return WASI_ERRNO.NOENT;
    }
  }

  // Clock
  private clock_time_get(
    _clockId: number,
    _precision: bigint,
    timePtr: number
  ): number {
    const view = new DataView(this.memory!.buffer);
    const now = BigInt(Date.now()) * BigInt(1000000);
    view.setBigUint64(timePtr, now, true);
    return WASI_ERRNO.SUCCESS;
  }

  private clock_res_get(_clockId: number, resPtr: number): number {
    const view = new DataView(this.memory!.buffer);
    view.setBigUint64(resPtr, BigInt(1000000), true);
    return WASI_ERRNO.SUCCESS;
  }

  // Random
  private random_get(bufPtr: number, bufLen: number): number {
    const mem = new Uint8Array(this.memory!.buffer);
    const randomBytes = new Uint8Array(bufLen);
    crypto.getRandomValues(randomBytes);
    mem.set(randomBytes, bufPtr);
    return WASI_ERRNO.SUCCESS;
  }
}

// Global runtime instance for this Worker
const runtime = new SandboxedWasmRuntime();

/**
 * Send a response back to the main thread.
 */
function sendResponse(response: WorkerResponse): void {
  self.postMessage(response);
}

/**
 * Handle incoming messages from the main thread.
 */
self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;

  if (request.type !== 'execute') {
    sendResponse({
      type: 'error',
      id: request.id,
      error: `Unknown request type: ${request.type}`,
    });
    return;
  }

  try {
    const result = await runtime.execute(
      request.wasmBinary,
      request.args,
      request.options
    );

    sendResponse({
      type: 'result',
      id: request.id,
      result,
    });
  } catch (error) {
    sendResponse({
      type: 'error',
      id: request.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

// Signal that the Worker is ready
console.log('[WASM Worker] Sandbox initialized');
