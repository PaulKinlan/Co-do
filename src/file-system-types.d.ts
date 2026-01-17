/**
 * File System Access API TypeScript Definitions
 * https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API
 */

interface FileSystemHandle {
  readonly kind: 'file' | 'directory';
  readonly name: string;
  isSameEntry(other: FileSystemHandle): Promise<boolean>;
  queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
}

interface FileSystemFileHandle extends FileSystemHandle {
  readonly kind: 'file';
  getFile(): Promise<File>;
  createWritable(options?: FileSystemCreateWritableOptions): Promise<FileSystemWritableFileStream>;
}

interface FileSystemDirectoryHandle extends FileSystemHandle {
  readonly kind: 'directory';
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
  keys(): AsyncIterableIterator<string>;
  values(): AsyncIterableIterator<FileSystemHandle>;
  getFileHandle(name: string, options?: FileSystemGetFileOptions): Promise<FileSystemFileHandle>;
  getDirectoryHandle(name: string, options?: FileSystemGetDirectoryOptions): Promise<FileSystemDirectoryHandle>;
  removeEntry(name: string, options?: FileSystemRemoveOptions): Promise<void>;
  resolve(possibleDescendant: FileSystemHandle): Promise<string[] | null>;
}

interface FileSystemWritableFileStream extends WritableStream {
  write(data: BufferSource | Blob | string | WriteParams): Promise<void>;
  seek(position: number): Promise<void>;
  truncate(size: number): Promise<void>;
}

interface FileSystemHandlePermissionDescriptor {
  mode?: 'read' | 'readwrite';
}

interface FileSystemCreateWritableOptions {
  keepExistingData?: boolean;
}

interface FileSystemGetFileOptions {
  create?: boolean;
}

interface FileSystemGetDirectoryOptions {
  create?: boolean;
}

interface FileSystemRemoveOptions {
  recursive?: boolean;
}

interface WriteParams {
  type: 'write' | 'seek' | 'truncate';
  data?: BufferSource | Blob | string;
  position?: number;
  size?: number;
}

interface DirectoryPickerOptions {
  id?: string;
  mode?: 'read' | 'readwrite';
  startIn?: FileSystemHandle | string;
}

interface FilePickerOptions {
  types?: FilePickerAcceptType[];
  excludeAcceptAllOption?: boolean;
  id?: string;
  startIn?: FileSystemHandle | string;
  multiple?: boolean;
}

interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: FilePickerAcceptType[];
  excludeAcceptAllOption?: boolean;
  id?: string;
  startIn?: FileSystemHandle | string;
}

interface FilePickerAcceptType {
  description?: string;
  accept: Record<string, string[]>;
}

interface Window {
  showDirectoryPicker(options?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>;
  showOpenFilePicker(options?: FilePickerOptions): Promise<FileSystemFileHandle[]>;
  showSaveFilePicker(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;
}
