/**
 * Virtual File System for WASM Tools
 *
 * This module provides a bridge between WASM tools and the real file system
 * accessed through the File System Access API. It also manages stdin/stdout/stderr
 * buffers for WASI-style I/O.
 */

import type { FileSystemManager } from '../fileSystem';
import type { FileStat } from './types';

/**
 * Text encoder/decoder for converting between strings and Uint8Array
 */
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/**
 * Virtual File System that bridges WASM tools with the real file system.
 *
 * Standard I/O streams are mapped to WASI file descriptors:
 * - stdin  (fd 0): fd_read reads from the stdin buffer
 * - stdout (fd 1): fd_write appends to the stdout buffer
 * - stderr (fd 2): fd_write appends to the stderr buffer
 */
export class VirtualFileSystem {
  private fileSystem: FileSystemManager | null;
  private fileAccess: 'none' | 'read' | 'write' | 'readwrite';

  // Standard I/O buffers
  private stdinBuffer: Uint8Array = new Uint8Array(0);
  private stdinOffset: number = 0;
  private stdoutBuffer: Uint8Array[] = [];
  private stderrBuffer: Uint8Array[] = [];

  // Open file handles (fd -> path mapping)
  private openFiles: Map<number, { path: string; mode: 'read' | 'write' }> = new Map();
  private nextFd: number = 3; // Start after stdin/stdout/stderr

  constructor(fileSystem: FileSystemManager | null, fileAccess: 'none' | 'read' | 'write' | 'readwrite' = 'none') {
    this.fileSystem = fileSystem;
    this.fileAccess = fileAccess;
  }

  // ===========================================================================
  // Standard I/O Operations
  // ===========================================================================

  /**
   * Set the stdin buffer content.
   * This is typically used to pass JSON input to tools with argStyle: 'json'.
   */
  setStdin(data: string | Uint8Array): void {
    if (typeof data === 'string') {
      this.stdinBuffer = textEncoder.encode(data);
    } else {
      this.stdinBuffer = data;
    }
    this.stdinOffset = 0;
  }

  /**
   * Read from stdin buffer (called by fd_read for fd 0).
   */
  readStdin(maxBytes: number): Uint8Array {
    const remaining = this.stdinBuffer.length - this.stdinOffset;
    const bytesToRead = Math.min(maxBytes, remaining);

    if (bytesToRead === 0) {
      return new Uint8Array(0);
    }

    const result = this.stdinBuffer.slice(this.stdinOffset, this.stdinOffset + bytesToRead);
    this.stdinOffset += bytesToRead;
    return result;
  }

  /**
   * Write to stdout buffer (called by fd_write for fd 1).
   */
  writeStdout(data: Uint8Array): number {
    this.stdoutBuffer.push(data.slice());
    return data.length;
  }

  /**
   * Write to stderr buffer (called by fd_write for fd 2).
   */
  writeStderr(data: Uint8Array): number {
    this.stderrBuffer.push(data.slice());
    return data.length;
  }

  /**
   * Combine an array of Uint8Array chunks into a single Uint8Array.
   */
  private combineChunks(chunks: Uint8Array[]): Uint8Array {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    return combined;
  }

  /**
   * Get the accumulated stdout content as a string.
   */
  getStdout(): string {
    return textDecoder.decode(this.combineChunks(this.stdoutBuffer));
  }

  /**
   * Get the accumulated stdout content as raw bytes.
   * Use this when the output may contain non-UTF-8 binary data.
   */
  getStdoutBinary(): Uint8Array {
    return this.combineChunks(this.stdoutBuffer);
  }

  /**
   * Get the accumulated stderr content as a string.
   */
  getStderr(): string {
    return textDecoder.decode(this.combineChunks(this.stderrBuffer));
  }

  /**
   * Get the accumulated stderr content as raw bytes.
   */
  getStderrBinary(): Uint8Array {
    return this.combineChunks(this.stderrBuffer);
  }

  /**
   * Clear all I/O buffers.
   */
  reset(): void {
    this.stdinBuffer = new Uint8Array(0);
    this.stdinOffset = 0;
    this.stdoutBuffer = [];
    this.stderrBuffer = [];
    this.openFiles.clear();
    this.nextFd = 3;
  }

  // ===========================================================================
  // File System Operations (for paths opened via path_open)
  // ===========================================================================

  /**
   * Check if file access is allowed for the given operation.
   */
  private checkAccess(operation: 'read' | 'write'): void {
    if (this.fileAccess === 'none') {
      throw new Error('File system access is not allowed for this tool');
    }
    if (operation === 'write' && this.fileAccess === 'read') {
      throw new Error('Write access is not allowed for this tool');
    }
    if (operation === 'read' && this.fileAccess === 'write') {
      throw new Error('Read access is not allowed for this tool');
    }
  }

  /**
   * Normalize a path to prevent directory traversal.
   */
  private normalizePath(path: string): string {
    // Remove leading slash if present
    let normalized = path.startsWith('/') ? path.slice(1) : path;

    // Split into segments and filter out empty and '.' segments
    const segments = normalized.split('/').filter(s => s && s !== '.');

    // Process '..' segments
    const result: string[] = [];
    for (const segment of segments) {
      if (segment === '..') {
        if (result.length > 0) {
          result.pop();
        }
        // Silently ignore '..' at root (don't throw, just don't go up)
      } else {
        result.push(segment);
      }
    }

    return result.join('/');
  }

  /**
   * Read a file from the project directory as raw bytes.
   * This preserves binary data without UTF-8 encoding loss.
   */
  async readFile(path: string): Promise<Uint8Array> {
    this.checkAccess('read');

    if (!this.fileSystem) {
      throw new Error('No file system available');
    }

    const normalizedPath = this.normalizePath(path);
    const buffer = await this.fileSystem.readFileBinary(normalizedPath);
    return new Uint8Array(buffer);
  }

  /**
   * Read a file as a string.
   */
  async readFileAsString(path: string): Promise<string> {
    this.checkAccess('read');

    if (!this.fileSystem) {
      throw new Error('No file system available');
    }

    const normalizedPath = this.normalizePath(path);
    return await this.fileSystem.readFile(normalizedPath);
  }

  /**
   * Write data to a file in the project directory.
   * Accepts both text strings and raw binary data (Uint8Array).
   * Binary data is written directly without text conversion.
   */
  async writeFile(path: string, data: Uint8Array | string): Promise<void> {
    this.checkAccess('write');

    if (!this.fileSystem) {
      throw new Error('No file system available');
    }

    const normalizedPath = this.normalizePath(path);
    await this.fileSystem.writeFile(normalizedPath, data);
  }

  /**
   * Get file statistics.
   * Note: Only works for files, not directories.
   */
  async stat(path: string): Promise<FileStat> {
    this.checkAccess('read');

    if (!this.fileSystem) {
      throw new Error('No file system available');
    }

    const normalizedPath = this.normalizePath(path);

    try {
      const metadata = await this.fileSystem.getFileMetadata(normalizedPath);
      return {
        size: metadata.size,
        isFile: true,
        isDirectory: false,
        modifiedTime: metadata.lastModified,
      };
    } catch {
      throw new Error(`File not found: ${path}`);
    }
  }

  /**
   * Check if a file exists.
   */
  async exists(path: string): Promise<boolean> {
    try {
      await this.stat(path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Read directory contents.
   * Note: Currently returns all files in the project, filtered by path prefix.
   */
  async readdir(path: string): Promise<string[]> {
    this.checkAccess('read');

    if (!this.fileSystem) {
      throw new Error('No file system available');
    }

    const normalizedPath = this.normalizePath(path);
    // listFiles returns all entries recursively from the root
    const allEntries = await this.fileSystem.listFiles();

    // Filter to entries in the requested directory (direct children only)
    const prefix = normalizedPath ? `${normalizedPath}/` : '';
    const results: string[] = [];

    for (const entry of allEntries) {
      if (normalizedPath === '') {
        // Root directory - get top-level entries only
        if (!entry.path.includes('/')) {
          results.push(entry.name);
        }
      } else if (entry.path.startsWith(prefix)) {
        // Check if it's a direct child (no more slashes after the prefix)
        const relativePath = entry.path.slice(prefix.length);
        if (!relativePath.includes('/')) {
          results.push(entry.name);
        }
      }
    }

    return [...new Set(results)]; // Remove duplicates
  }

  // ===========================================================================
  // File Descriptor Operations (for WASI compatibility)
  // ===========================================================================

  /**
   * Open a file and return a file descriptor.
   */
  openFile(path: string, mode: 'read' | 'write'): number {
    if (mode === 'read') {
      this.checkAccess('read');
    } else {
      this.checkAccess('write');
    }

    const fd = this.nextFd++;
    const normalizedPath = this.normalizePath(path);
    this.openFiles.set(fd, { path: normalizedPath, mode });
    return fd;
  }

  /**
   * Close a file descriptor.
   */
  closeFile(fd: number): void {
    if (fd < 3) {
      // Can't close stdin/stdout/stderr
      return;
    }
    this.openFiles.delete(fd);
  }

  /**
   * Check if a file descriptor is valid.
   */
  isValidFd(fd: number): boolean {
    if (fd >= 0 && fd <= 2) return true; // stdin/stdout/stderr
    return this.openFiles.has(fd);
  }

  /**
   * Get the path for a file descriptor.
   */
  getFdPath(fd: number): string | null {
    const info = this.openFiles.get(fd);
    return info?.path ?? null;
  }
}
