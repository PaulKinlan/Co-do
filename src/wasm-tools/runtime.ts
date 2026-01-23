/**
 * WASM Runtime for executing WebAssembly tools
 *
 * This module provides a WASI-compatible runtime for executing WASM tools.
 * It implements the wasi_snapshot_preview1 interface for file I/O and
 * process management.
 */

import { VirtualFileSystem } from './vfs';
import type { ExecutionResult, ExecutionOptions } from './types';

/**
 * WASI error codes
 */
const WASI_ERRNO = {
  SUCCESS: 0,
  BADF: 8,      // Bad file descriptor
  INVAL: 28,    // Invalid argument
  IO: 29,       // I/O error
  NOENT: 44,    // No such file or directory
  NOSYS: 52,    // Function not supported
  PERM: 63,     // Operation not permitted
} as const;

/**
 * WASI file types
 */
const WASI_FILETYPE = {
  UNKNOWN: 0,
  BLOCK_DEVICE: 1,
  CHARACTER_DEVICE: 2,
  DIRECTORY: 3,
  REGULAR_FILE: 4,
  SOCKET_DGRAM: 5,
  SOCKET_STREAM: 6,
  SYMBOLIC_LINK: 7,
} as const;

/**
 * WASI rights flags
 */
const WASI_RIGHTS = {
  FD_READ: BigInt(1) << BigInt(1),
  FD_WRITE: BigInt(1) << BigInt(6),
} as const;

/**
 * Text encoder/decoder for string conversion
 */
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/**
 * WASM Runtime that executes WebAssembly modules with WASI support.
 */
export class WasmRuntime {
  private memory: WebAssembly.Memory | null = null;
  private vfs: VirtualFileSystem | null = null;
  private args: string[] = [];
  private exitCode: number = 0;
  private hasExited: boolean = false;

  /**
   * Execute a WASM module with the given arguments.
   */
  async execute(
    wasmBinary: ArrayBuffer,
    args: string[],
    options: ExecutionOptions,
    vfs: VirtualFileSystem
  ): Promise<ExecutionResult> {
    this.vfs = vfs;
    this.args = args;
    this.exitCode = 0;
    this.hasExited = false;

    // Set stdin if provided
    if (options.stdin) {
      vfs.setStdin(options.stdin);
    }

    // Create timeout promise
    const timeoutMs = options.timeout ?? 30000;
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Tool execution timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    // Execute with timeout
    const executionPromise = this.executeInternal(wasmBinary);

    try {
      await Promise.race([executionPromise, timeoutPromise]);
    } catch (error) {
      // Check if this is a normal exit (proc_exit was called)
      if (!this.hasExited) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        vfs.writeStderr(textEncoder.encode(`Error: ${errorMessage}\n`));
        this.exitCode = 1;
      }
    }

    return {
      exitCode: this.exitCode,
      stdout: vfs.getStdout(),
      stderr: vfs.getStderr(),
    };
  }

  /**
   * Internal execution logic.
   */
  private async executeInternal(wasmBinary: ArrayBuffer): Promise<void> {
    const imports = this.createWasiImports();

    // Compile and instantiate the module
    const module = await WebAssembly.compile(wasmBinary);
    const instance = await WebAssembly.instantiate(module, imports);

    // Get memory from exports
    this.memory = instance.exports.memory as WebAssembly.Memory;

    // Call the WASI _start function
    const start = instance.exports._start as (() => void) | undefined;
    if (start) {
      try {
        start();
      } catch (error) {
        // Check if this is a normal exit
        if (!this.hasExited) {
          throw error;
        }
      }
    } else {
      throw new Error('WASM module does not export _start function');
    }
  }

  /**
   * Create WASI preview1 imports.
   */
  private createWasiImports(): WebAssembly.Imports {
    return {
      wasi_snapshot_preview1: {
        // Process management
        proc_exit: this.proc_exit.bind(this),
        sched_yield: this.sched_yield.bind(this),

        // Command line arguments
        args_sizes_get: this.args_sizes_get.bind(this),
        args_get: this.args_get.bind(this),

        // Environment variables
        environ_sizes_get: this.environ_sizes_get.bind(this),
        environ_get: this.environ_get.bind(this),

        // File descriptors
        fd_read: this.fd_read.bind(this),
        fd_write: this.fd_write.bind(this),
        fd_close: this.fd_close.bind(this),
        fd_seek: this.fd_seek.bind(this),
        fd_fdstat_get: this.fd_fdstat_get.bind(this),
        fd_fdstat_set_flags: this.fd_fdstat_set_flags.bind(this),
        fd_prestat_get: this.fd_prestat_get.bind(this),
        fd_prestat_dir_name: this.fd_prestat_dir_name.bind(this),

        // File operations
        path_open: this.path_open.bind(this),
        path_filestat_get: this.path_filestat_get.bind(this),
        path_create_directory: this.path_create_directory.bind(this),
        path_remove_directory: this.path_remove_directory.bind(this),
        path_unlink_file: this.path_unlink_file.bind(this),
        path_rename: this.path_rename.bind(this),

        // Clock
        clock_time_get: this.clock_time_get.bind(this),
        clock_res_get: this.clock_res_get.bind(this),

        // Random
        random_get: this.random_get.bind(this),

        // Not implemented but needed for compatibility
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
        sock_recv: () => WASI_ERRNO.NOSYS,
        sock_send: () => WASI_ERRNO.NOSYS,
        sock_shutdown: () => WASI_ERRNO.NOSYS,
        sock_accept: () => WASI_ERRNO.NOSYS,
      },
    };
  }

  // ===========================================================================
  // Process Management
  // ===========================================================================

  private proc_exit(code: number): void {
    this.exitCode = code;
    this.hasExited = true;
    // Throw to unwind the stack
    throw new Error(`proc_exit(${code})`);
  }

  private sched_yield(): number {
    return WASI_ERRNO.SUCCESS;
  }

  // ===========================================================================
  // Command Line Arguments
  // ===========================================================================

  private args_sizes_get(argcPtr: number, argvBufSizePtr: number): number {
    const view = new DataView(this.memory!.buffer);

    // Number of arguments
    view.setUint32(argcPtr, this.args.length, true);

    // Total size of argument strings (including null terminators)
    let totalSize = 0;
    for (const arg of this.args) {
      totalSize += textEncoder.encode(arg).length + 1; // +1 for null terminator
    }
    view.setUint32(argvBufSizePtr, totalSize, true);

    return WASI_ERRNO.SUCCESS;
  }

  private args_get(argvPtr: number, argvBufPtr: number): number {
    const view = new DataView(this.memory!.buffer);
    const mem = new Uint8Array(this.memory!.buffer);

    let bufOffset = argvBufPtr;
    for (let i = 0; i < this.args.length; i++) {
      // Store pointer to this argument string
      view.setUint32(argvPtr + i * 4, bufOffset, true);

      // Store the argument string
      const encoded = textEncoder.encode(this.args[i]!);
      mem.set(encoded, bufOffset);
      mem[bufOffset + encoded.length] = 0; // null terminator
      bufOffset += encoded.length + 1;
    }

    return WASI_ERRNO.SUCCESS;
  }

  // ===========================================================================
  // Environment Variables
  // ===========================================================================

  private environ_sizes_get(countPtr: number, sizePtr: number): number {
    const view = new DataView(this.memory!.buffer);
    view.setUint32(countPtr, 0, true); // No environment variables
    view.setUint32(sizePtr, 0, true);
    return WASI_ERRNO.SUCCESS;
  }

  private environ_get(_environPtr: number, _environBufPtr: number): number {
    return WASI_ERRNO.SUCCESS;
  }

  // ===========================================================================
  // File Descriptor Operations
  // ===========================================================================

  private fd_read(fd: number, iovsPtr: number, iovsLen: number, nreadPtr: number): number {
    const view = new DataView(this.memory!.buffer);
    const mem = new Uint8Array(this.memory!.buffer);

    let totalRead = 0;

    for (let i = 0; i < iovsLen; i++) {
      const bufPtr = view.getUint32(iovsPtr + i * 8, true);
      const bufLen = view.getUint32(iovsPtr + i * 8 + 4, true);

      if (fd === 0) {
        // stdin
        const data = this.vfs!.readStdin(bufLen);
        mem.set(data, bufPtr);
        totalRead += data.length;
        if (data.length < bufLen) break; // EOF
      } else {
        // Other file descriptors not fully implemented for reading
        return WASI_ERRNO.BADF;
      }
    }

    view.setUint32(nreadPtr, totalRead, true);
    return WASI_ERRNO.SUCCESS;
  }

  private fd_write(fd: number, iovsPtr: number, iovsLen: number, nwrittenPtr: number): number {
    const view = new DataView(this.memory!.buffer);
    const mem = new Uint8Array(this.memory!.buffer);

    let totalWritten = 0;

    for (let i = 0; i < iovsLen; i++) {
      const bufPtr = view.getUint32(iovsPtr + i * 8, true);
      const bufLen = view.getUint32(iovsPtr + i * 8 + 4, true);
      const data = mem.slice(bufPtr, bufPtr + bufLen);

      if (fd === 1) {
        // stdout
        this.vfs!.writeStdout(data);
        totalWritten += data.length;
      } else if (fd === 2) {
        // stderr
        this.vfs!.writeStderr(data);
        totalWritten += data.length;
      } else {
        return WASI_ERRNO.BADF;
      }
    }

    view.setUint32(nwrittenPtr, totalWritten, true);
    return WASI_ERRNO.SUCCESS;
  }

  private fd_close(fd: number): number {
    if (fd < 3) {
      return WASI_ERRNO.SUCCESS; // Can't close stdin/stdout/stderr
    }
    this.vfs!.closeFile(fd);
    return WASI_ERRNO.SUCCESS;
  }

  private fd_seek(_fd: number, _offset: bigint, _whence: number, _newoffsetPtr: number): number {
    return WASI_ERRNO.NOSYS;
  }

  private fd_fdstat_get(fd: number, statPtr: number): number {
    const view = new DataView(this.memory!.buffer);

    // fs_filetype (1 byte)
    if (fd === 0 || fd === 1 || fd === 2) {
      view.setUint8(statPtr, WASI_FILETYPE.CHARACTER_DEVICE);
    } else {
      view.setUint8(statPtr, WASI_FILETYPE.REGULAR_FILE);
    }

    // fs_flags (2 bytes)
    view.setUint16(statPtr + 2, 0, true);

    // fs_rights_base (8 bytes)
    let rights = BigInt(0);
    if (fd === 0) rights = WASI_RIGHTS.FD_READ;
    else if (fd === 1 || fd === 2) rights = WASI_RIGHTS.FD_WRITE;
    else rights = WASI_RIGHTS.FD_READ | WASI_RIGHTS.FD_WRITE;
    view.setBigUint64(statPtr + 8, rights, true);

    // fs_rights_inheriting (8 bytes)
    view.setBigUint64(statPtr + 16, rights, true);

    return WASI_ERRNO.SUCCESS;
  }

  private fd_fdstat_set_flags(_fd: number, _flags: number): number {
    return WASI_ERRNO.SUCCESS;
  }

  private fd_prestat_get(fd: number, _prestatPtr: number): number {
    // Return BADF for all pre-opened directories (we don't have any)
    if (fd >= 3) {
      return WASI_ERRNO.BADF;
    }
    return WASI_ERRNO.BADF;
  }

  private fd_prestat_dir_name(_fd: number, _pathPtr: number, _pathLen: number): number {
    return WASI_ERRNO.BADF;
  }

  // ===========================================================================
  // Path Operations
  // ===========================================================================

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
      const fd = this.vfs!.openFile(path, 'read');
      view.setUint32(fdPtr, fd, true);
      return WASI_ERRNO.SUCCESS;
    } catch {
      return WASI_ERRNO.NOENT;
    }
  }

  private path_filestat_get(
    _fd: number,
    _flags: number,
    _pathPtr: number,
    _pathLen: number,
    _statPtr: number
  ): number {
    return WASI_ERRNO.NOSYS;
  }

  private path_create_directory(_fd: number, _pathPtr: number, _pathLen: number): number {
    return WASI_ERRNO.NOSYS;
  }

  private path_remove_directory(_fd: number, _pathPtr: number, _pathLen: number): number {
    return WASI_ERRNO.NOSYS;
  }

  private path_unlink_file(_fd: number, _pathPtr: number, _pathLen: number): number {
    return WASI_ERRNO.NOSYS;
  }

  private path_rename(
    _fd: number,
    _oldPathPtr: number,
    _oldPathLen: number,
    _newFd: number,
    _newPathPtr: number,
    _newPathLen: number
  ): number {
    return WASI_ERRNO.NOSYS;
  }

  // ===========================================================================
  // Clock Operations
  // ===========================================================================

  private clock_time_get(_clockId: number, _precision: bigint, timePtr: number): number {
    const view = new DataView(this.memory!.buffer);
    const now = BigInt(Date.now()) * BigInt(1000000); // Convert to nanoseconds
    view.setBigUint64(timePtr, now, true);
    return WASI_ERRNO.SUCCESS;
  }

  private clock_res_get(_clockId: number, resPtr: number): number {
    const view = new DataView(this.memory!.buffer);
    view.setBigUint64(resPtr, BigInt(1000000), true); // 1ms resolution
    return WASI_ERRNO.SUCCESS;
  }

  // ===========================================================================
  // Random
  // ===========================================================================

  private random_get(bufPtr: number, bufLen: number): number {
    const mem = new Uint8Array(this.memory!.buffer);
    const randomBytes = new Uint8Array(bufLen);
    crypto.getRandomValues(randomBytes);
    mem.set(randomBytes, bufPtr);
    return WASI_ERRNO.SUCCESS;
  }
}

// Export singleton instance
export const wasmRuntime = new WasmRuntime();
