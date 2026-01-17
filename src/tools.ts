/**
 * File operation tools for AI
 * Each tool checks permissions before executing
 */

import { CoreTool, tool } from 'ai';
import { z } from 'zod';
import { fileSystemManager } from './fileSystem';
import { preferencesManager, ToolName } from './preferences';

/**
 * Permission dialog callback type
 */
export type PermissionCallback = (
  toolName: ToolName,
  args: unknown
) => Promise<boolean>;

let permissionCallback: PermissionCallback | null = null;

/**
 * Set the permission callback function
 */
export function setPermissionCallback(callback: PermissionCallback): void {
  permissionCallback = callback;
}

/**
 * Check if a tool can be executed based on permissions
 */
async function checkPermission(
  toolName: ToolName,
  args: unknown
): Promise<boolean> {
  const permission = preferencesManager.getToolPermission(toolName);

  switch (permission) {
    case 'always':
      return true;
    case 'never':
      return false;
    case 'ask':
      if (!permissionCallback) {
        throw new Error('Permission callback not set');
      }
      return await permissionCallback(toolName, args);
    default:
      return false;
  }
}

/**
 * Open and read a file
 */
export const openFileTool = tool({
  description: 'Read the contents of a file. Returns the file content as text.',
  parameters: z.object({
    path: z.string().describe('The path to the file relative to the root directory'),
  }),
  execute: async ({ path }) => {
    const allowed = await checkPermission('open_file', { path });
    if (!allowed) {
      return { error: 'Permission denied to open file' };
    }

    try {
      const content = await fileSystemManager.readFile(path);
      return {
        success: true,
        path,
        content,
      };
    } catch (error) {
      return {
        error: `Failed to read file: ${(error as Error).message}`,
      };
    }
  },
});

/**
 * Create a new file
 */
export const createFileTool = tool({
  description:
    'Create a new file with specified content. Use this to create new files in the directory.',
  parameters: z.object({
    path: z.string().describe('The path for the new file relative to the root directory'),
    content: z
      .string()
      .describe('The content to write to the file')
      .default(''),
  }),
  execute: async ({ path, content }) => {
    const allowed = await checkPermission('create_file', { path, content });
    if (!allowed) {
      return { error: 'Permission denied to create file' };
    }

    try {
      await fileSystemManager.createFile(path, content);
      return {
        success: true,
        path,
        message: `File created: ${path}`,
      };
    } catch (error) {
      return {
        error: `Failed to create file: ${(error as Error).message}`,
      };
    }
  },
});

/**
 * Write to an existing file
 */
export const writeFileTool = tool({
  description:
    'Write or update content in an existing file. This will overwrite the entire file content.',
  parameters: z.object({
    path: z.string().describe('The path to the file relative to the root directory'),
    content: z.string().describe('The new content for the file'),
  }),
  execute: async ({ path, content }) => {
    const allowed = await checkPermission('write_file', { path, content });
    if (!allowed) {
      return { error: 'Permission denied to write file' };
    }

    try {
      await fileSystemManager.writeFile(path, content);
      return {
        success: true,
        path,
        message: `File updated: ${path}`,
      };
    } catch (error) {
      return {
        error: `Failed to write file: ${(error as Error).message}`,
      };
    }
  },
});

/**
 * Rename a file
 */
export const renameFileTool = tool({
  description: 'Rename a file. Can also be used to move a file to a different location.',
  parameters: z.object({
    oldPath: z
      .string()
      .describe('The current path to the file relative to the root directory'),
    newPath: z
      .string()
      .describe('The new path for the file relative to the root directory'),
  }),
  execute: async ({ oldPath, newPath }) => {
    const allowed = await checkPermission('rename_file', { oldPath, newPath });
    if (!allowed) {
      return { error: 'Permission denied to rename file' };
    }

    try {
      await fileSystemManager.renameFile(oldPath, newPath);
      return {
        success: true,
        oldPath,
        newPath,
        message: `File renamed: ${oldPath} → ${newPath}`,
      };
    } catch (error) {
      return {
        error: `Failed to rename file: ${(error as Error).message}`,
      };
    }
  },
});

/**
 * Move a file
 */
export const moveFileTool = tool({
  description: 'Move a file to a different location within the directory.',
  parameters: z.object({
    sourcePath: z
      .string()
      .describe('The current path to the file relative to the root directory'),
    destinationPath: z
      .string()
      .describe('The destination path for the file relative to the root directory'),
  }),
  execute: async ({ sourcePath, destinationPath }) => {
    const allowed = await checkPermission('move_file', {
      sourcePath,
      destinationPath,
    });
    if (!allowed) {
      return { error: 'Permission denied to move file' };
    }

    try {
      await fileSystemManager.renameFile(sourcePath, destinationPath);
      return {
        success: true,
        sourcePath,
        destinationPath,
        message: `File moved: ${sourcePath} → ${destinationPath}`,
      };
    } catch (error) {
      return {
        error: `Failed to move file: ${(error as Error).message}`,
      };
    }
  },
});

/**
 * Delete a file
 */
export const deleteFileTool = tool({
  description:
    'Delete a file. Use with caution as this operation cannot be undone. Always confirm with the user before deleting files.',
  parameters: z.object({
    path: z.string().describe('The path to the file to delete relative to the root directory'),
  }),
  execute: async ({ path }) => {
    const allowed = await checkPermission('delete_file', { path });
    if (!allowed) {
      return { error: 'Permission denied to delete file' };
    }

    try {
      await fileSystemManager.deleteFile(path);
      return {
        success: true,
        path,
        message: `File deleted: ${path}`,
      };
    } catch (error) {
      return {
        error: `Failed to delete file: ${(error as Error).message}`,
      };
    }
  },
});

/**
 * List all files in the directory
 */
export const listFilesTool = tool({
  description:
    'List all files in the directory. Returns an array of file paths. Use this to see what files are available before performing operations.',
  parameters: z.object({}),
  execute: async () => {
    try {
      const entries = await fileSystemManager.listFiles();
      const files = entries.filter((e) => e.kind === 'file').map((e) => e.path);
      return {
        success: true,
        files,
        count: files.length,
      };
    } catch (error) {
      return {
        error: `Failed to list files: ${(error as Error).message}`,
      };
    }
  },
});

/**
 * Get file metadata
 */
export const getFileMetadataTool = tool({
  description: 'Get metadata about a file (size, last modified, type).',
  parameters: z.object({
    path: z.string().describe('The path to the file relative to the root directory'),
  }),
  execute: async ({ path }) => {
    try {
      const metadata = await fileSystemManager.getFileMetadata(path);
      return {
        success: true,
        path,
        metadata,
      };
    } catch (error) {
      return {
        error: `Failed to get file metadata: ${(error as Error).message}`,
      };
    }
  },
});

/**
 * All available tools for AI
 */
export const fileTools: Record<string, CoreTool> = {
  open_file: openFileTool,
  create_file: createFileTool,
  write_file: writeFileTool,
  rename_file: renameFileTool,
  move_file: moveFileTool,
  delete_file: deleteFileTool,
  list_files: listFilesTool,
  get_file_metadata: getFileMetadataTool,
};
