/**
 * File System Access API Manager
 * Handles all interactions with the File System Access API
 */

// TypeScript declarations for FileSystemObserver (experimental API)
interface FileSystemChangeRecord {
  root: FileSystemHandle;
  changedHandle: FileSystemHandle;
  relativePathComponents: string[];
  type: 'appeared' | 'disappeared' | 'modified' | 'moved' | 'unknown' | 'errored';
  relativePathMovedFrom?: string[];
}

interface FileSystemObserverCallback {
  (records: FileSystemChangeRecord[], observer: FileSystemObserver): void;
}

declare class FileSystemObserver {
  constructor(callback: FileSystemObserverCallback);
  observe(handle: FileSystemHandle, options?: { recursive?: boolean }): Promise<void>;
  unobserve(handle: FileSystemHandle): void;
  disconnect(): void;
}

export interface FileEntry {
  name: string;
  path: string;
  handle: FileSystemFileHandle;
  kind: 'file';
}

export interface DirectoryEntry {
  name: string;
  path: string;
  handle: FileSystemDirectoryHandle;
  kind: 'directory';
}

export type FileSystemEntry = FileEntry | DirectoryEntry;

export type FileSystemChangeCallback = (changes: FileSystemChangeRecord[]) => void;

export class FileSystemManager {
  private rootHandle: FileSystemDirectoryHandle | null = null;
  private rootPath: string = '';
  private fileCache: Map<string, FileSystemEntry> = new Map();
  private observer: FileSystemObserver | null = null;
  private changeCallback: FileSystemChangeCallback | null = null;

  /**
   * Check if File System Access API is supported
   */
  isSupported(): boolean {
    return 'showDirectoryPicker' in window;
  }

  /**
   * Check if FileSystemObserver API is supported
   */
  isObserverSupported(): boolean {
    return 'FileSystemObserver' in self;
  }

  /**
   * Set a callback to be notified of file system changes
   */
  setChangeCallback(callback: FileSystemChangeCallback | null): void {
    this.changeCallback = callback;
  }

  /**
   * Request user to select a directory
   */
  async selectDirectory(): Promise<FileSystemDirectoryHandle> {
    if (!this.isSupported()) {
      throw new Error('File System Access API is not supported in this browser');
    }

    try {
      const handle = await window.showDirectoryPicker({
        mode: 'readwrite',
      });

      this.rootHandle = handle;
      this.rootPath = handle.name;
      this.fileCache.clear();

      // Start observing the directory for changes if supported
      await this.startObserving();

      return handle;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new Error('Directory selection was cancelled');
      }
      throw error;
    }
  }

  /**
   * Get the current root directory handle
   */
  getRootHandle(): FileSystemDirectoryHandle | null {
    return this.rootHandle;
  }

  /**
   * Get the root directory name/path
   */
  getRootPath(): string {
    return this.rootPath;
  }

  /**
   * List all files and directories in the root directory (recursive)
   */
  async listFiles(
    directoryHandle: FileSystemDirectoryHandle = this.rootHandle!,
    basePath: string = ''
  ): Promise<FileSystemEntry[]> {
    if (!this.rootHandle) {
      throw new Error('No directory selected');
    }

    const entries: FileSystemEntry[] = [];

    for await (const [name, handle] of directoryHandle.entries()) {
      const path = basePath ? `${basePath}/${name}` : name;

      if (handle.kind === 'file') {
        const entry: FileEntry = {
          name,
          path,
          handle: handle as FileSystemFileHandle,
          kind: 'file',
        };
        entries.push(entry);
        this.fileCache.set(path, entry);
      } else if (handle.kind === 'directory') {
        const entry: DirectoryEntry = {
          name,
          path,
          handle: handle as FileSystemDirectoryHandle,
          kind: 'directory',
        };
        entries.push(entry);
        this.fileCache.set(path, entry);

        // Recursively list subdirectory contents
        const subEntries = await this.listFiles(handle as FileSystemDirectoryHandle, path);
        entries.push(...subEntries);
      }
    }

    return entries;
  }

  /**
   * Read file contents
   */
  async readFile(path: string): Promise<string> {
    const entry = this.fileCache.get(path);
    if (!entry || entry.kind !== 'file') {
      throw new Error(`File not found: ${path}`);
    }

    const file = await entry.handle.getFile();
    return await file.text();
  }

  /**
   * Write content to a file
   */
  async writeFile(path: string, content: string): Promise<void> {
    const entry = this.fileCache.get(path);
    if (!entry || entry.kind !== 'file') {
      throw new Error(`File not found: ${path}`);
    }

    const writable = await entry.handle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  /**
   * Create a new file
   * Note: Both the created file and any parent directories are added to the cache.
   */
  async createFile(path: string, content: string = ''): Promise<FileEntry> {
    if (!this.rootHandle) {
      throw new Error('No directory selected');
    }

    const pathParts = path.split('/');
    const fileName = pathParts.pop()!;

    let dirHandle = this.rootHandle;
    let currentPath = '';

    // Navigate to the directory (create if needed) and cache any created directories
    for (const part of pathParts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      dirHandle = await dirHandle.getDirectoryHandle(part, { create: true });

      // Cache the directory if not already cached
      if (!this.fileCache.has(currentPath)) {
        const dirEntry: DirectoryEntry = {
          name: part,
          path: currentPath,
          handle: dirHandle,
          kind: 'directory',
        };
        this.fileCache.set(currentPath, dirEntry);
      }
    }

    const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });

    // Write initial content
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();

    const entry: FileEntry = {
      name: fileName,
      path,
      handle: fileHandle,
      kind: 'file',
    };

    this.fileCache.set(path, entry);
    return entry;
  }

  /**
   * Delete a file
   */
  async deleteFile(path: string): Promise<void> {
    if (!this.rootHandle) {
      throw new Error('No directory selected');
    }

    const pathParts = path.split('/');
    const fileName = pathParts.pop()!;
    const dirPath = pathParts.join('/');

    let dirHandle = this.rootHandle;

    // Navigate to the directory
    if (dirPath) {
      for (const part of pathParts) {
        dirHandle = await dirHandle.getDirectoryHandle(part);
      }
    }

    await dirHandle.removeEntry(fileName);
    this.fileCache.delete(path);
  }

  /**
   * Rename/move a file
   * Uses a safe approach: create new file, then delete old file
   * If deletion fails, cleans up the new file to prevent duplicates
   */
  async renameFile(oldPath: string, newPath: string): Promise<void> {
    // Read the file content first
    const content = await this.readFile(oldPath);

    // Create new file with the content
    await this.createFile(newPath, content);

    // Try to delete the old file
    try {
      await this.deleteFile(oldPath);
    } catch (deleteError) {
      // If deletion fails, clean up the newly created file to prevent duplicates
      try {
        await this.deleteFile(newPath);
      } catch {
        // Ignore cleanup errors
      }
      throw new Error(
        `Failed to complete rename: could not delete original file "${oldPath}". ` +
          `Error: ${(deleteError as Error).message}`
      );
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(path: string): Promise<{
    name: string;
    size: number;
    lastModified: number;
    type: string;
  }> {
    const entry = this.fileCache.get(path);
    if (!entry || entry.kind !== 'file') {
      throw new Error(`File not found: ${path}`);
    }

    const file = await entry.handle.getFile();
    return {
      name: file.name,
      size: file.size,
      lastModified: file.lastModified,
      type: file.type,
    };
  }

  /**
   * Check if we have permission to access the directory
   */
  async verifyPermission(mode: 'read' | 'readwrite' = 'readwrite'): Promise<boolean> {
    if (!this.rootHandle) {
      return false;
    }

    const options: FileSystemHandlePermissionDescriptor = { mode };

    // Check if permission was already granted
    if ((await this.rootHandle.queryPermission(options)) === 'granted') {
      return true;
    }

    // Request permission
    if ((await this.rootHandle.requestPermission(options)) === 'granted') {
      return true;
    }

    return false;
  }

  /**
   * Get a file handle by path
   */
  getFileHandle(path: string): FileSystemFileHandle | null {
    const entry = this.fileCache.get(path);
    if (!entry || entry.kind !== 'file') {
      return null;
    }
    return entry.handle;
  }

  /**
   * Start observing the root directory for changes
   */
  async startObserving(): Promise<boolean> {
    if (!this.rootHandle) {
      console.warn('Cannot start observing: no root directory selected');
      return false;
    }

    if (!this.isObserverSupported()) {
      console.info('FileSystemObserver is not supported in this browser');
      return false;
    }

    try {
      // Stop any existing observer
      this.stopObserving();

      // Create new observer
      this.observer = new FileSystemObserver((records) => {
        this.handleFileSystemChanges(records);
      });

      // Start observing the root directory recursively
      await this.observer.observe(this.rootHandle, { recursive: true });
      console.info('FileSystemObserver started for:', this.rootPath);
      return true;
    } catch (error) {
      console.error('Failed to start FileSystemObserver:', error);
      return false;
    }
  }

  /**
   * Stop observing file system changes
   */
  stopObserving(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
      console.info('FileSystemObserver stopped');
    }
  }

  /**
   * Handle file system change events
   */
  private handleFileSystemChanges(records: FileSystemChangeRecord[]): void {
    console.log('File system changes detected:', records);

    // Notify callback if set
    if (this.changeCallback) {
      this.changeCallback(records);
    }

    // Update cache based on change types
    for (const record of records) {
      const path = record.relativePathComponents.join('/');

      switch (record.type) {
        case 'disappeared':
          // Remove from cache
          this.fileCache.delete(path);
          break;

        case 'appeared':
        case 'modified':
          // Cache will be updated on next listFiles() call
          // or we could proactively update it here
          break;

        case 'moved':
          // Handle file/directory move
          if (record.relativePathMovedFrom) {
            const oldPath = record.relativePathMovedFrom.join('/');
            this.fileCache.delete(oldPath);
          }
          break;

        case 'unknown':
        case 'errored':
          // Clear cache and let it be rebuilt
          console.warn('FileSystemObserver encountered unknown/error event, clearing cache');
          this.fileCache.clear();
          break;
      }
    }
  }

  /**
   * Clear the cache and reset state
   */
  reset(): void {
    this.stopObserving();
    this.rootHandle = null;
    this.rootPath = '';
    this.fileCache.clear();
  }
}

// Export a singleton instance
export const fileSystemManager = new FileSystemManager();
