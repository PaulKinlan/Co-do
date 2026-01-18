/**
 * File operation tools for AI
 * Each tool checks permissions before executing
 */

import { Tool, tool } from 'ai';
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
  inputSchema: z.object({
    path: z.string().describe('The path to the file relative to the root directory'),
  }),
  execute: async (input) => {
    const allowed = await checkPermission('open_file', { path: input.path });
    if (!allowed) {
      return { error: 'Permission denied to open file' };
    }

    try {
      const content = await fileSystemManager.readFile(input.path);
      return {
        success: true,
        path: input.path,
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
  inputSchema: z.object({
    path: z.string().describe('The path for the new file relative to the root directory'),
    content: z
      .string()
      .describe('The content to write to the file')
      .default(''),
  }),
  execute: async (input) => {
    const allowed = await checkPermission('create_file', { path: input.path, content: input.content });
    if (!allowed) {
      return { error: 'Permission denied to create file' };
    }

    try {
      await fileSystemManager.createFile(input.path, input.content);
      return {
        success: true,
        path: input.path,
        message: `File created: ${input.path}`,
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
  inputSchema: z.object({
    path: z.string().describe('The path to the file relative to the root directory'),
    content: z.string().describe('The new content for the file'),
  }),
  execute: async (input) => {
    const allowed = await checkPermission('write_file', { path: input.path, content: input.content });
    if (!allowed) {
      return { error: 'Permission denied to write file' };
    }

    try {
      await fileSystemManager.writeFile(input.path, input.content);
      return {
        success: true,
        path: input.path,
        message: `File updated: ${input.path}`,
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
  inputSchema: z.object({
    oldPath: z
      .string()
      .describe('The current path to the file relative to the root directory'),
    newPath: z
      .string()
      .describe('The new path for the file relative to the root directory'),
  }),
  execute: async (input) => {
    const allowed = await checkPermission('rename_file', { oldPath: input.oldPath, newPath: input.newPath });
    if (!allowed) {
      return { error: 'Permission denied to rename file' };
    }

    try {
      await fileSystemManager.renameFile(input.oldPath, input.newPath);
      return {
        success: true,
        oldPath: input.oldPath,
        newPath: input.newPath,
        message: `File renamed: ${input.oldPath} → ${input.newPath}`,
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
  inputSchema: z.object({
    sourcePath: z
      .string()
      .describe('The current path to the file relative to the root directory'),
    destinationPath: z
      .string()
      .describe('The destination path for the file relative to the root directory'),
  }),
  execute: async (input) => {
    const allowed = await checkPermission('move_file', {
      sourcePath: input.sourcePath,
      destinationPath: input.destinationPath,
    });
    if (!allowed) {
      return { error: 'Permission denied to move file' };
    }

    try {
      await fileSystemManager.renameFile(input.sourcePath, input.destinationPath);
      return {
        success: true,
        sourcePath: input.sourcePath,
        destinationPath: input.destinationPath,
        message: `File moved: ${input.sourcePath} → ${input.destinationPath}`,
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
  inputSchema: z.object({
    path: z.string().describe('The path to the file to delete relative to the root directory'),
  }),
  execute: async (input) => {
    const allowed = await checkPermission('delete_file', { path: input.path });
    if (!allowed) {
      return { error: 'Permission denied to delete file' };
    }

    try {
      await fileSystemManager.deleteFile(input.path);
      return {
        success: true,
        path: input.path,
        message: `File deleted: ${input.path}`,
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
  inputSchema: z.object({}),
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
  inputSchema: z.object({
    path: z.string().describe('The path to the file relative to the root directory'),
  }),
  execute: async (input) => {
    try {
      const metadata = await fileSystemManager.getFileMetadata(input.path);
      return {
        success: true,
        path: input.path,
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
 * Cat - Display file contents
 */
export const catTool = tool({
  description: 'Display the contents of a file (like Unix cat command). Returns the file content as text.',
  inputSchema: z.object({
    path: z.string().describe('The path to the file relative to the root directory'),
  }),
  execute: async (input) => {
    const allowed = await checkPermission('cat', { path: input.path });
    if (!allowed) {
      return { error: 'Permission denied to cat file' };
    }

    try {
      const content = await fileSystemManager.readFile(input.path);
      return {
        success: true,
        path: input.path,
        content,
      };
    } catch (error) {
      return {
        error: `Failed to cat file: ${(error as Error).message}`,
      };
    }
  },
});

/**
 * Grep - Search for patterns in files
 */
export const grepTool = tool({
  description: 'Search for a pattern in files (like Unix grep command). Searches in specified file or all files if no path provided. Returns matching lines with line numbers.',
  inputSchema: z.object({
    pattern: z.string().describe('The pattern or text to search for'),
    path: z.string().optional().describe('Optional: specific file path to search in. If not provided, searches all files'),
    caseInsensitive: z.boolean().optional().default(false).describe('Whether to perform case-insensitive search'),
  }),
  execute: async (input) => {
    const allowed = await checkPermission('grep', { pattern: input.pattern, path: input.path });
    if (!allowed) {
      return { error: 'Permission denied to grep files' };
    }

    try {
      const filesToSearch: string[] = [];

      if (input.path) {
        // Search specific file
        filesToSearch.push(input.path);
      } else {
        // Search all files
        const entries = await fileSystemManager.listFiles();
        filesToSearch.push(...entries.filter((e) => e.kind === 'file').map((e) => e.path));
      }

      const matches: Array<{ file: string; lineNumber: number; line: string }> = [];
      const pattern = input.caseInsensitive
        ? new RegExp(input.pattern, 'gi')
        : new RegExp(input.pattern, 'g');

      for (const filePath of filesToSearch) {
        try {
          const content = await fileSystemManager.readFile(filePath);
          const lines = content.split('\n');

          lines.forEach((line, index) => {
            if (pattern.test(line)) {
              matches.push({
                file: filePath,
                lineNumber: index + 1,
                line: line.trim(),
              });
            }
            // Reset regex state for next match
            pattern.lastIndex = 0;
          });
        } catch (error) {
          // Skip files that can't be read
          continue;
        }
      }

      return {
        success: true,
        pattern: input.pattern,
        searchPath: input.path || 'all files',
        matchCount: matches.length,
        matches,
      };
    } catch (error) {
      return {
        error: `Failed to grep: ${(error as Error).message}`,
      };
    }
  },
});

/**
 * All available tools for AI
 */
export const fileTools: Record<string, Tool> = {
  open_file: openFileTool,
  create_file: createFileTool,
  write_file: writeFileTool,
  rename_file: renameFileTool,
  move_file: moveFileTool,
  delete_file: deleteFileTool,
  list_files: listFilesTool,
  get_file_metadata: getFileMetadataTool,
  cat: catTool,
  grep: grepTool,
};
