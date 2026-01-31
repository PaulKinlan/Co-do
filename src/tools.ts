/**
 * File operation tools for AI
 * Each tool checks permissions before executing
 */

import { Tool, tool } from 'ai';
import { z } from 'zod';
import { fileSystemManager } from './fileSystem';
import { preferencesManager, ToolName } from './preferences';
import { toolResultCache, generateContentSummary } from './toolResultCache';
import { computeLCS, generateDiffHunks, generateUnifiedDiff } from './diff';

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
 *
 * Returns a summary to the LLM to reduce context bloat.
 * Full content is cached and displayed to the user via UI.
 * Use read_file_content tool to explicitly request full content when needed.
 */
export const openFileTool = tool({
  description: 'Read a file and display its contents to the user. Returns a summary with file metadata. The full content is shown to the user automatically. If you need the actual file content for analysis, use the read_file_content tool instead.',
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
      const { summary, lineCount, byteSize, fileType, preview } = generateContentSummary(content, input.path);

      // Store full content in cache for UI display
      const resultId = toolResultCache.store('open_file', content, {
        path: input.path,
        lineCount,
        byteSize,
        fileType,
      });

      return {
        success: true,
        path: input.path,
        resultId, // UI uses this to retrieve full content
        summary, // e.g., "TypeScript, 150 lines, 4.2 KB"
        lineCount,
        byteSize,
        fileType,
        preview, // First few lines for LLM context
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
    const allowed = await checkPermission('list_files', {});
    if (!allowed) {
      return { error: 'Permission denied to list files' };
    }

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
    const allowed = await checkPermission('get_file_metadata', { path: input.path });
    if (!allowed) {
      return { error: 'Permission denied to get file metadata' };
    }

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
 *
 * This is an alias of the open_file tool, providing Unix-style naming.
 * Uses the same file reading logic but with separate permission checking.
 *
 * Returns a summary to the LLM to reduce context bloat.
 * Full content is cached and displayed to the user via UI.
 */
export const catTool = tool({
  description: 'Display the contents of a file (like Unix cat command). Shows full content to the user but returns a summary. If you need the actual content for analysis, use read_file_content instead.',
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
      const { summary, lineCount, byteSize, fileType, preview } = generateContentSummary(content, input.path);

      // Store full content in cache for UI display
      const resultId = toolResultCache.store('cat', content, {
        path: input.path,
        lineCount,
        byteSize,
        fileType,
      });

      return {
        success: true,
        path: input.path,
        resultId,
        summary,
        lineCount,
        byteSize,
        fileType,
        preview,
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
        ? new RegExp(input.pattern, 'i')
        : new RegExp(input.pattern);

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
          });
        } catch (error) {
          // If searching a specific file, surface the error
          if (input.path) {
            return {
              error: `Failed to read file '${filePath}': ${(error as Error).message}`,
            };
          }
          // When searching all files, skip files that can't be read
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
 * Read the first N lines of a file (like Linux head command)
 */
export const headFileTool = tool({
  description: 'Read the first N lines of a file. Similar to the Linux head command. Use this to preview the beginning of a file without reading the entire content. Maximum 10,000 lines.',
  inputSchema: z.object({
    path: z.string().describe('The path to the file relative to the root directory'),
    lines: z.number().int().positive().max(10000).default(10).describe('Number of lines to read from the beginning (default: 10, max: 10,000)'),
  }),
  execute: async (input) => {
    const allowed = await checkPermission('head_file', { path: input.path, lines: input.lines });
    if (!allowed) {
      return { error: 'Permission denied to read file head' };
    }

    try {
      const content = await fileSystemManager.readFile(input.path);
      // Split by newlines and filter out trailing empty string if file ends with newline
      const allLines = content.split('\n');
      // Remove trailing empty element caused by final newline
      if (allLines.length > 0 && allLines[allLines.length - 1] === '') {
        allLines.pop();
      }

      const headLines = allLines.slice(0, input.lines);
      const totalLines = allLines.length;

      return {
        success: true,
        path: input.path,
        content: headLines.join('\n'),
        linesReturned: headLines.length,
        totalLines: totalLines,
      };
    } catch (error) {
      return {
        error: `Failed to read file head: ${(error as Error).message}`,
      };
    }
  },
});

/**
 * Read the last N lines of a file (like Linux tail command)
 */
export const tailFileTool = tool({
  description: 'Read the last N lines of a file. Similar to the Linux tail command. Use this to view the end of a file, such as recent log entries or the end of a document. Maximum 10,000 lines.',
  inputSchema: z.object({
    path: z.string().describe('The path to the file relative to the root directory'),
    lines: z.number().int().positive().max(10000).default(10).describe('Number of lines to read from the end (default: 10, max: 10,000)'),
  }),
  execute: async (input) => {
    const allowed = await checkPermission('tail_file', { path: input.path, lines: input.lines });
    if (!allowed) {
      return { error: 'Permission denied to read file tail' };
    }

    try {
      const content = await fileSystemManager.readFile(input.path);
      // Split by newlines and filter out trailing empty string if file ends with newline
      const allLines = content.split('\n');
      // Remove trailing empty element caused by final newline
      if (allLines.length > 0 && allLines[allLines.length - 1] === '') {
        allLines.pop();
      }

      const tailLines = allLines.slice(-input.lines);
      const totalLines = allLines.length;

      return {
        success: true,
        path: input.path,
        content: tailLines.join('\n'),
        linesReturned: tailLines.length,
        totalLines: totalLines,
      };
    } catch (error) {
      return {
        error: `Failed to read file tail: ${(error as Error).message}`,
      };
    }
  },
});

/**
 * Copy a file to a new location (like Unix cp command)
 */
export const cpTool = tool({
  description:
    'Copy a file to a new location (like Unix cp command). Creates a duplicate of the source file at the destination path.',
  inputSchema: z.object({
    source: z.string().describe('The path to the source file relative to the root directory'),
    destination: z
      .string()
      .describe('The destination path for the copy relative to the root directory'),
  }),
  execute: async (input) => {
    const allowed = await checkPermission('cp', {
      source: input.source,
      destination: input.destination,
    });
    if (!allowed) {
      return { error: 'Permission denied to copy file' };
    }

    try {
      // Check if source file exists before attempting to copy
      if (!fileSystemManager.isFile(input.source)) {
        return {
          error: `Source file does not exist: "${input.source}"`,
        };
      }

      await fileSystemManager.copyFile(input.source, input.destination);
      return {
        success: true,
        source: input.source,
        destination: input.destination,
        message: `File copied: ${input.source} → ${input.destination}`,
      };
    } catch (error) {
      return {
        error: `Failed to copy file: ${(error as Error).message}`,
      };
    }
  },
});

/**
 * Create a directory (like Unix mkdir command)
 */
export const mkdirTool = tool({
  description:
    'Create a new directory (like Unix mkdir -p command). Creates parent directories if they do not exist.',
  inputSchema: z.object({
    path: z.string().describe('The path for the new directory relative to the root directory'),
  }),
  execute: async (input) => {
    const allowed = await checkPermission('mkdir', { path: input.path });
    if (!allowed) {
      return { error: 'Permission denied to create directory' };
    }

    try {
      await fileSystemManager.createDirectory(input.path);
      return {
        success: true,
        path: input.path,
        message: `Directory created: ${input.path}`,
      };
    } catch (error) {
      return {
        error: `Failed to create directory: ${(error as Error).message}`,
      };
    }
  },
});

/**
 * Display directory structure as a tree (like Unix tree command)
 */
export const treeTool = tool({
  description:
    'Display the directory structure as a tree (like Unix tree command). Shows a hierarchical view of files and directories.',
  inputSchema: z.object({
    path: z
      .string()
      .optional()
      .describe('Optional: starting directory path. If not provided, shows the entire tree'),
    maxDepth: z
      .number()
      .int()
      .min(0)
      .max(20)
      .optional()
      .describe('Optional: maximum depth to display (0 = root only, default: unlimited, max: 20)'),
  }),
  execute: async (input) => {
    const allowed = await checkPermission('tree', { path: input.path });
    if (!allowed) {
      return { error: 'Permission denied to display tree' };
    }

    try {
      const entries = await fileSystemManager.listFiles();

      // Normalize basePath: remove trailing slashes
      const basePath = input.path ? input.path.replace(/\/+$/, '') : '';
      const maxDepth = input.maxDepth;

      // If a path was provided, check if it exists
      if (basePath) {
        const pathEntry = entries.find((e) => e.path === basePath);
        if (!pathEntry) {
          return {
            error: `Path not found: "${basePath}". Check that the path exists and is accessible.`,
          };
        }

        // If the path is a file, return info about just that file
        if (pathEntry.kind === 'file') {
          return {
            success: true,
            tree: basePath,
            directories: 0,
            files: 1,
            message: `"${basePath}" is a file, not a directory`,
          };
        }
      }

      // Filter entries by base path if provided
      const filteredEntries = basePath
        ? entries.filter((e) => e.path === basePath || e.path.startsWith(basePath + '/'))
        : entries;

      // Build tree structure
      interface TreeNode {
        name: string;
        kind: 'file' | 'directory';
        children: Map<string, TreeNode>;
      }

      const root: TreeNode = { name: '', kind: 'directory', children: new Map() };

      for (const entry of filteredEntries) {
        // Get path relative to base path
        const relativePath = basePath ? entry.path.slice(basePath.length + 1) || entry.name : entry.path;
        const parts = relativePath.split('/').filter((p) => p.length > 0);

        // Check depth limit
        if (maxDepth !== undefined && parts.length > maxDepth) {
          continue;
        }

        let current = root;
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i]!;
          if (!current.children.has(part)) {
            const isLast = i === parts.length - 1;
            current.children.set(part, {
              name: part,
              kind: isLast ? entry.kind : 'directory',
              children: new Map(),
            });
          }
          current = current.children.get(part)!;
        }
      }

      // Generate tree string
      const lines: string[] = [];
      let fileCount = 0;
      let dirCount = 0;

      function renderTree(node: TreeNode, prefix: string, isLast: boolean, isRoot: boolean): void {
        if (!isRoot) {
          const connector = isLast ? '└── ' : '├── ';
          lines.push(prefix + connector + node.name);
        }

        const children = Array.from(node.children.values()).sort((a, b) => {
          // Directories first, then alphabetical
          if (a.kind !== b.kind) {
            return a.kind === 'directory' ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });

        children.forEach((child, index) => {
          const isChildLast = index === children.length - 1;
          const newPrefix = isRoot ? '' : prefix + (isLast ? '    ' : '│   ');

          if (child.kind === 'directory') {
            dirCount++;
          } else {
            fileCount++;
          }

          renderTree(child, newPrefix, isChildLast, false);
        });
      }

      const rootName = basePath || fileSystemManager.getRootPath() || '.';
      lines.push(rootName);
      renderTree(root, '', true, true);

      lines.push('');
      lines.push(`${dirCount} directories, ${fileCount} files`);

      return {
        success: true,
        tree: lines.join('\n'),
        directories: dirCount,
        files: fileCount,
      };
    } catch (error) {
      return {
        error: `Failed to generate tree: ${(error as Error).message}`,
      };
    }
  },
});

/**
 * Compare two files and show differences (like Unix diff command)
 */
export const diffTool = tool({
  description:
    'Compare two files and show differences (like Unix diff command). Shows line-by-line differences between files. Note: Uses O(m*n) algorithm where m and n are line counts, so may be slow for very large files (thousands of lines).',
  inputSchema: z.object({
    file1: z.string().describe('Path to the first file'),
    file2: z.string().describe('Path to the second file'),
    contextLines: z
      .number()
      .int()
      .min(0)
      .max(10)
      .optional()
      .default(3)
      .describe('Number of context lines around changes (default: 3)'),
  }),
  execute: async (input) => {
    const allowed = await checkPermission('diff', { file1: input.file1, file2: input.file2 });
    if (!allowed) {
      return { error: 'Permission denied to diff files' };
    }

    try {
      const content1 = await fileSystemManager.readFile(input.file1);
      const content2 = await fileSystemManager.readFile(input.file2);

      const lines1 = content1.split('\n');
      const lines2 = content2.split('\n');

      // Simple LCS-based diff algorithm
      const lcs = computeLCS(lines1, lines2);
      const hunks = generateDiffHunks(lines1, lines2, lcs, input.contextLines);

      if (hunks.length === 0) {
        return {
          success: true,
          file1: input.file1,
          file2: input.file2,
          identical: true,
          diff: 'Files are identical',
        };
      }

      // Format output in unified diff format
      const diffLines: string[] = [];
      diffLines.push(`--- ${input.file1}`);
      diffLines.push(`+++ ${input.file2}`);

      for (const hunk of hunks) {
        diffLines.push(hunk.header);
        diffLines.push(...hunk.lines);
      }

      return {
        success: true,
        file1: input.file1,
        file2: input.file2,
        identical: false,
        diff: diffLines.join('\n'),
        hunks: hunks.length,
      };
    } catch (error) {
      return {
        error: `Failed to diff files: ${(error as Error).message}`,
      };
    }
  },
});

// LCS and diff hunk generation are imported from ./diff

/**
 * Count lines, words, and characters in a file (like Unix wc command)
 */
export const wcTool = tool({
  description:
    'Count lines, words, and characters in a file (like Unix wc command). Can count for a single file or multiple files.',
  inputSchema: z.object({
    path: z
      .string()
      .optional()
      .describe('Optional: file path. If not provided, counts for all files'),
    countLines: z.boolean().optional().default(true).describe('Count lines (default: true)'),
    countWords: z.boolean().optional().default(true).describe('Count words (default: true)'),
    countChars: z.boolean().optional().default(true).describe('Count characters (default: true)'),
  }),
  execute: async (input) => {
    const allowed = await checkPermission('wc', { path: input.path });
    if (!allowed) {
      return { error: 'Permission denied to count file contents' };
    }

    try {
      const filesToCount: string[] = [];

      if (input.path) {
        filesToCount.push(input.path);
      } else {
        const entries = await fileSystemManager.listFiles();
        filesToCount.push(...entries.filter((e) => e.kind === 'file').map((e) => e.path));
      }

      const results: Array<{
        file: string;
        lines: number;
        words: number;
        chars: number;
      }> = [];

      let totalLines = 0;
      let totalWords = 0;
      let totalChars = 0;

      for (const filePath of filesToCount) {
        try {
          const content = await fileSystemManager.readFile(filePath);

          // Count newlines to match Unix wc -l behavior (counts newline characters, not lines)
          // An empty file has 0 lines, a file with trailing newline doesn't get an extra count
          const lines = input.countLines ? (content.match(/\n/g) || []).length : 0;
          const words = input.countWords ? content.split(/\s+/).filter((w) => w.length > 0).length : 0;
          const chars = input.countChars ? content.length : 0;

          results.push({ file: filePath, lines, words, chars });

          totalLines += lines;
          totalWords += words;
          totalChars += chars;
        } catch (error) {
          if (input.path) {
            return {
              error: `Failed to read file '${filePath}': ${(error as Error).message}`,
            };
          }
          // Skip unreadable files when counting all
          continue;
        }
      }

      return {
        success: true,
        results,
        total: {
          lines: totalLines,
          words: totalWords,
          chars: totalChars,
        },
        fileCount: results.length,
      };
    } catch (error) {
      return {
        error: `Failed to count: ${(error as Error).message}`,
      };
    }
  },
});

/**
 * Sort lines in a file (like Unix sort command)
 *
 * Returns a summary to the LLM to reduce context bloat.
 * Full sorted content is cached and displayed to the user via UI.
 */
export const sortTool = tool({
  description:
    'Sort lines in a file (like Unix sort command). Shows sorted content to the user but returns a summary. Does not modify the original file.',
  inputSchema: z.object({
    path: z.string().describe('The path to the file to sort'),
    reverse: z.boolean().optional().default(false).describe('Sort in reverse order (default: false)'),
    numeric: z
      .boolean()
      .optional()
      .default(false)
      .describe('Sort numerically instead of alphabetically (default: false)'),
    unique: z.boolean().optional().default(false).describe('Remove duplicate lines (default: false)'),
    ignoreCase: z
      .boolean()
      .optional()
      .default(false)
      .describe('Ignore case when sorting (default: false)'),
  }),
  execute: async (input) => {
    const allowed = await checkPermission('sort', { path: input.path });
    if (!allowed) {
      return { error: 'Permission denied to sort file' };
    }

    try {
      const content = await fileSystemManager.readFile(input.path);
      let lines = content.split('\n');
      const originalLineCount = lines.length;

      // Remove trailing empty line if present
      if (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop();
      }

      // Sort function
      const compareFn = (a: string, b: string): number => {
        const valA = input.ignoreCase ? a.toLowerCase() : a;
        const valB = input.ignoreCase ? b.toLowerCase() : b;

        if (input.numeric) {
          const numA = parseFloat(valA);
          const numB = parseFloat(valB);
          const aIsNaN = Number.isNaN(numA);
          const bIsNaN = Number.isNaN(numB);

          // Both non-numeric: fall back to string comparison
          if (aIsNaN && bIsNaN) {
            const result = valA.localeCompare(valB);
            return input.reverse ? -result : result;
          }

          // One non-numeric: place non-numeric after numeric in normal order
          if (aIsNaN) {
            return input.reverse ? -1 : 1;
          }
          if (bIsNaN) {
            return input.reverse ? 1 : -1;
          }

          // Both numeric
          const diff = numA - numB;
          return input.reverse ? -diff : diff;
        }

        const result = valA.localeCompare(valB);
        return input.reverse ? -result : result;
      };

      lines.sort(compareFn);

      // Remove duplicates if requested
      if (input.unique) {
        const seen = new Set<string>();
        lines = lines.filter((line) => {
          const key = input.ignoreCase ? line.toLowerCase() : line;
          if (seen.has(key)) {
            return false;
          }
          seen.add(key);
          return true;
        });
      }

      const sortedContent = lines.join('\n');

      // Store full sorted content in cache for UI display
      const resultId = toolResultCache.store('sort', sortedContent, {
        path: input.path,
        lineCount: lines.length,
      });

      // Generate preview of sorted content
      const previewLines = lines.slice(0, 5).map(line =>
        line.length > 100 ? line.substring(0, 100) + '...' : line
      ).join('\n');

      return {
        success: true,
        path: input.path,
        resultId,
        lineCount: lines.length,
        originalLineCount,
        options: {
          reverse: input.reverse,
          numeric: input.numeric,
          unique: input.unique,
          ignoreCase: input.ignoreCase,
        },
        preview: previewLines,
      };
    } catch (error) {
      return {
        error: `Failed to sort file: ${(error as Error).message}`,
      };
    }
  },
});

/**
 * Filter adjacent duplicate lines (like Unix uniq command)
 *
 * Returns a summary to the LLM to reduce context bloat.
 * Full processed content is cached and displayed to the user via UI.
 */
export const uniqTool = tool({
  description:
    'Filter or report adjacent duplicate lines in a file (like Unix uniq command). Shows processed content to the user but returns a summary. Note: uniq only removes adjacent duplicates; use sort first for full deduplication.',
  inputSchema: z.object({
    path: z.string().describe('The path to the file to process'),
    count: z
      .boolean()
      .optional()
      .default(false)
      .describe('Prefix lines with count of occurrences (default: false)'),
    duplicatesOnly: z
      .boolean()
      .optional()
      .default(false)
      .describe('Only show duplicate lines (default: false)'),
    uniqueOnly: z
      .boolean()
      .optional()
      .default(false)
      .describe('Only show unique lines (default: false)'),
    ignoreCase: z
      .boolean()
      .optional()
      .default(false)
      .describe('Ignore case when comparing (default: false)'),
  }),
  execute: async (input) => {
    const allowed = await checkPermission('uniq', { path: input.path });
    if (!allowed) {
      return { error: 'Permission denied to process file' };
    }

    try {
      const content = await fileSystemManager.readFile(input.path);
      const lines = content.split('\n');

      // Remove trailing empty line if present
      if (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop();
      }

      // Process lines, tracking adjacent duplicates
      const processed: Array<{ line: string; count: number }> = [];

      for (const line of lines) {
        const compareKey = input.ignoreCase ? line.toLowerCase() : line;
        const lastItem = processed[processed.length - 1];
        const lastKey = lastItem
          ? input.ignoreCase
            ? lastItem.line.toLowerCase()
            : lastItem.line
          : null;

        if (lastKey === compareKey && lastItem) {
          lastItem.count++;
        } else {
          processed.push({ line, count: 1 });
        }
      }

      // Filter based on options
      let filtered = processed;

      if (input.duplicatesOnly) {
        filtered = filtered.filter((item) => item.count > 1);
      } else if (input.uniqueOnly) {
        filtered = filtered.filter((item) => item.count === 1);
      }

      // Format output
      let outputLines: string[];

      if (input.count) {
        outputLines = filtered.map((item) => `${item.count.toString().padStart(7)} ${item.line}`);
      } else {
        outputLines = filtered.map((item) => item.line);
      }

      const processedContent = outputLines.join('\n');

      // Store full processed content in cache for UI display
      const resultId = toolResultCache.store('uniq', processedContent, {
        path: input.path,
        lineCount: outputLines.length,
      });

      // Generate preview
      const previewLines = outputLines.slice(0, 5).map(line =>
        line.length > 100 ? line.substring(0, 100) + '...' : line
      ).join('\n');

      return {
        success: true,
        path: input.path,
        resultId,
        lineCount: outputLines.length,
        originalLineCount: lines.length,
        duplicatesRemoved: lines.length - outputLines.length,
        options: {
          count: input.count,
          duplicatesOnly: input.duplicatesOnly,
          uniqueOnly: input.uniqueOnly,
          ignoreCase: input.ignoreCase,
        },
        preview: previewLines,
      };
    } catch (error) {
      return {
        error: `Failed to process file: ${(error as Error).message}`,
      };
    }
  },
});

/**
 * Read file content - for when the LLM explicitly needs full content
 *
 * This tool returns the actual file content (up to a size limit) when the LLM
 * needs to analyze or work with the content directly, rather than just displaying
 * it to the user.
 */
export const readFileContentTool = tool({
  description:
    'Read the full content of a file when you need to analyze or work with it directly. Use this when you need the actual text content (e.g., to find specific code, extract data, or understand file structure). For simply showing a file to the user, use open_file or cat instead.',
  inputSchema: z.object({
    path: z.string().describe('The path to the file relative to the root directory'),
    maxLines: z
      .number()
      .int()
      .positive()
      .max(1000)
      .optional()
      .default(500)
      .describe('Maximum number of lines to return (default: 500, max: 1000)'),
    startLine: z
      .number()
      .int()
      .min(1)
      .optional()
      .default(1)
      .describe('Line number to start from (1-indexed, default: 1)'),
  }),
  execute: async (input) => {
    const allowed = await checkPermission('read_file_content', { path: input.path });
    if (!allowed) {
      return { error: 'Permission denied to read file content' };
    }

    try {
      const content = await fileSystemManager.readFile(input.path);
      const allLines = content.split('\n');
      const totalLines = allLines.length;

      // Extract requested line range
      const startIdx = Math.max(0, (input.startLine || 1) - 1);
      const endIdx = Math.min(startIdx + (input.maxLines || 500), totalLines);
      const selectedLines = allLines.slice(startIdx, endIdx);

      const truncated = endIdx < totalLines;
      const byteSize = new TextEncoder().encode(content).length;

      return {
        success: true,
        path: input.path,
        content: selectedLines.join('\n'),
        linesReturned: selectedLines.length,
        totalLines,
        startLine: startIdx + 1,
        endLine: endIdx,
        truncated,
        byteSize,
      };
    } catch (error) {
      return {
        error: `Failed to read file content: ${(error as Error).message}`,
      };
    }
  },
});

// ============================================================================
// PIPEABLE COMMAND INFRASTRUCTURE
// ============================================================================

/**
 * Result from a pipeable command execution
 */
interface PipeableResult {
  success: boolean;
  output?: string;
  error?: string;
}

/**
 * Pipeable command names - tools that can be chained
 */
type PipeableToolName =
  | 'cat'
  | 'read_file'
  | 'grep'
  | 'sort'
  | 'uniq'
  | 'head'
  | 'tail'
  | 'wc'
  | 'write_file';

/**
 * Maps pipeable tool names to their required permission names
 */
const PIPEABLE_TOOL_PERMISSIONS: Record<PipeableToolName, ToolName> = {
  cat: 'cat',
  read_file: 'read_file_content',
  grep: 'grep',
  sort: 'sort',
  uniq: 'uniq',
  head: 'head_file',
  tail: 'tail_file',
  wc: 'wc',
  write_file: 'write_file',
};

/**
 * Internal pipeable functions that accept stdin and return output
 */
const pipeableFunctions: Record<
  PipeableToolName,
  (args: Record<string, unknown>, stdin?: string) => Promise<PipeableResult>
> = {
  /**
   * Cat - read file(s) or pass through stdin
   */
  cat: async (args, stdin) => {
    const paths = args.paths as string[] | undefined;
    const path = args.path as string | undefined;

    // If no paths provided, pass through stdin
    if (!paths && !path) {
      if (stdin !== undefined) {
        return { success: true, output: stdin };
      }
      return { success: false, error: 'cat: no input (provide paths or pipe input)' };
    }

    // Read file(s)
    const filePaths = paths || (path ? [path] : []);
    const contents: string[] = [];

    for (const filePath of filePaths) {
      try {
        const content = await fileSystemManager.readFile(filePath);
        contents.push(content);
      } catch (error) {
        return { success: false, error: `cat: ${filePath}: ${(error as Error).message}` };
      }
    }

    return { success: true, output: contents.join('\n') };
  },

  /**
   * Read file - read a single file
   */
  read_file: async (args) => {
    const path = args.path as string;
    if (!path) {
      return { success: false, error: 'read_file: path required' };
    }

    try {
      const content = await fileSystemManager.readFile(path);
      return { success: true, output: content };
    } catch (error) {
      return { success: false, error: `read_file: ${(error as Error).message}` };
    }
  },

  /**
   * Grep - filter lines matching pattern
   */
  grep: async (args, stdin) => {
    const pattern = args.pattern as string;
    const path = args.path as string | undefined;
    const caseInsensitive = args.caseInsensitive as boolean | undefined;
    const invertMatch = args.invertMatch as boolean | undefined;

    if (!pattern) {
      return { success: false, error: 'grep: pattern required' };
    }

    let content: string;

    // If path provided, read from file; otherwise use stdin
    if (path) {
      try {
        content = await fileSystemManager.readFile(path);
      } catch (error) {
        return { success: false, error: `grep: ${path}: ${(error as Error).message}` };
      }
    } else if (stdin !== undefined) {
      content = stdin;
    } else {
      return { success: false, error: 'grep: no input (provide path or pipe input)' };
    }

    const regex = caseInsensitive ? new RegExp(pattern, 'i') : new RegExp(pattern);
    const lines = content.split('\n');
    const matchedLines = lines.filter(line => {
      const matches = regex.test(line);
      return invertMatch ? !matches : matches;
    });

    return { success: true, output: matchedLines.join('\n') };
  },

  /**
   * Sort - sort lines
   */
  sort: async (args, stdin) => {
    const path = args.path as string | undefined;
    const reverse = args.reverse as boolean | undefined;
    const numeric = args.numeric as boolean | undefined;
    const unique = args.unique as boolean | undefined;
    const ignoreCase = args.ignoreCase as boolean | undefined;

    let content: string;

    if (path) {
      try {
        content = await fileSystemManager.readFile(path);
      } catch (error) {
        return { success: false, error: `sort: ${path}: ${(error as Error).message}` };
      }
    } else if (stdin !== undefined) {
      content = stdin;
    } else {
      return { success: false, error: 'sort: no input (provide path or pipe input)' };
    }

    let lines = content.split('\n');

    // Remove trailing empty line if present
    if (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop();
    }

    // Sort function
    const compareFn = (a: string, b: string): number => {
      const valA = ignoreCase ? a.toLowerCase() : a;
      const valB = ignoreCase ? b.toLowerCase() : b;

      if (numeric) {
        const numA = parseFloat(valA);
        const numB = parseFloat(valB);
        const aIsNaN = Number.isNaN(numA);
        const bIsNaN = Number.isNaN(numB);

        if (aIsNaN && bIsNaN) {
          const result = valA.localeCompare(valB);
          return reverse ? -result : result;
        }
        if (aIsNaN) return reverse ? -1 : 1;
        if (bIsNaN) return reverse ? 1 : -1;

        const diff = numA - numB;
        return reverse ? -diff : diff;
      }

      const result = valA.localeCompare(valB);
      return reverse ? -result : result;
    };

    lines.sort(compareFn);

    // Remove duplicates if requested
    if (unique) {
      const seen = new Set<string>();
      lines = lines.filter(line => {
        const key = ignoreCase ? line.toLowerCase() : line;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    return { success: true, output: lines.join('\n') };
  },

  /**
   * Uniq - filter adjacent duplicate lines
   */
  uniq: async (args, stdin) => {
    const path = args.path as string | undefined;
    const count = args.count as boolean | undefined;
    const duplicatesOnly = args.duplicatesOnly as boolean | undefined;
    const uniqueOnly = args.uniqueOnly as boolean | undefined;
    const ignoreCase = args.ignoreCase as boolean | undefined;

    let content: string;

    if (path) {
      try {
        content = await fileSystemManager.readFile(path);
      } catch (error) {
        return { success: false, error: `uniq: ${path}: ${(error as Error).message}` };
      }
    } else if (stdin !== undefined) {
      content = stdin;
    } else {
      return { success: false, error: 'uniq: no input (provide path or pipe input)' };
    }

    const lines = content.split('\n');

    // Remove trailing empty line if present
    if (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop();
    }

    // Process lines, tracking adjacent duplicates
    const processed: Array<{ line: string; count: number }> = [];

    for (const line of lines) {
      const compareKey = ignoreCase ? line.toLowerCase() : line;
      const lastItem = processed[processed.length - 1];
      const lastKey = lastItem
        ? ignoreCase ? lastItem.line.toLowerCase() : lastItem.line
        : null;

      if (lastKey === compareKey && lastItem) {
        lastItem.count++;
      } else {
        processed.push({ line, count: 1 });
      }
    }

    // Filter based on options
    let filtered = processed;
    if (duplicatesOnly) {
      filtered = filtered.filter(item => item.count > 1);
    } else if (uniqueOnly) {
      filtered = filtered.filter(item => item.count === 1);
    }

    // Format output
    let outputLines: string[];
    if (count) {
      outputLines = filtered.map(item => `${item.count.toString().padStart(7)} ${item.line}`);
    } else {
      outputLines = filtered.map(item => item.line);
    }

    return { success: true, output: outputLines.join('\n') };
  },

  /**
   * Head - get first N lines
   */
  head: async (args, stdin) => {
    const path = args.path as string | undefined;
    const lines = (args.lines as number | undefined) ?? 10;

    let content: string;

    if (path) {
      try {
        content = await fileSystemManager.readFile(path);
      } catch (error) {
        return { success: false, error: `head: ${path}: ${(error as Error).message}` };
      }
    } else if (stdin !== undefined) {
      content = stdin;
    } else {
      return { success: false, error: 'head: no input (provide path or pipe input)' };
    }

    const allLines = content.split('\n');
    // Remove trailing empty element caused by final newline
    if (allLines.length > 0 && allLines[allLines.length - 1] === '') {
      allLines.pop();
    }

    const headLines = allLines.slice(0, lines);
    return { success: true, output: headLines.join('\n') };
  },

  /**
   * Tail - get last N lines
   */
  tail: async (args, stdin) => {
    const path = args.path as string | undefined;
    const lines = (args.lines as number | undefined) ?? 10;

    let content: string;

    if (path) {
      try {
        content = await fileSystemManager.readFile(path);
      } catch (error) {
        return { success: false, error: `tail: ${path}: ${(error as Error).message}` };
      }
    } else if (stdin !== undefined) {
      content = stdin;
    } else {
      return { success: false, error: 'tail: no input (provide path or pipe input)' };
    }

    const allLines = content.split('\n');
    // Remove trailing empty element caused by final newline
    if (allLines.length > 0 && allLines[allLines.length - 1] === '') {
      allLines.pop();
    }

    const tailLines = allLines.slice(-lines);
    return { success: true, output: tailLines.join('\n') };
  },

  /**
   * Wc - count lines, words, characters
   */
  wc: async (args, stdin) => {
    const path = args.path as string | undefined;
    const countLines = args.countLines as boolean | undefined ?? true;
    const countWords = args.countWords as boolean | undefined ?? true;
    const countChars = args.countChars as boolean | undefined ?? true;

    let content: string;

    if (path) {
      try {
        content = await fileSystemManager.readFile(path);
      } catch (error) {
        return { success: false, error: `wc: ${path}: ${(error as Error).message}` };
      }
    } else if (stdin !== undefined) {
      content = stdin;
    } else {
      return { success: false, error: 'wc: no input (provide path or pipe input)' };
    }

    const lines = countLines ? (content.match(/\n/g) || []).length : 0;
    const words = countWords ? content.split(/\s+/).filter(w => w.length > 0).length : 0;
    const chars = countChars ? content.length : 0;

    // Format like Unix wc output
    const parts: string[] = [];
    if (countLines) parts.push(lines.toString().padStart(8));
    if (countWords) parts.push(words.toString().padStart(8));
    if (countChars) parts.push(chars.toString().padStart(8));

    return { success: true, output: parts.join('') };
  },

  /**
   * Write file - write stdin to file (terminal command)
   */
  write_file: async (args, stdin) => {
    const path = args.path as string;
    const content = (args.content as string | undefined) ?? stdin;

    if (!path) {
      return { success: false, error: 'write_file: path required' };
    }
    if (content === undefined) {
      return { success: false, error: 'write_file: no content (provide content or pipe input)' };
    }

    try {
      await fileSystemManager.writeFile(path, content);
      return { success: true, output: `Written to ${path}` };
    } catch (error) {
      return { success: false, error: `write_file: ${(error as Error).message}` };
    }
  },
};

/**
 * Command definition for the pipe tool
 */
const pipeCommandSchema = z.object({
  tool: z.enum(['cat', 'read_file', 'grep', 'sort', 'uniq', 'head', 'tail', 'wc', 'write_file'])
    .describe('The tool to execute'),
  args: z.record(z.unknown()).optional().default({})
    .describe('Arguments for the tool'),
});

/**
 * Pipe tool - chain multiple commands together
 *
 * Pre-validates all permissions before execution.
 * Only returns the final output to reduce context usage.
 */
export const pipeTool = tool({
  description: `Chain multiple commands together like Unix pipes. Output of each command becomes input to the next. Only the final output is returned, reducing context usage.

Available commands:
- cat: Read file(s) or pass through input. Args: { paths?: string[], path?: string }
- read_file: Read a single file. Args: { path: string }
- grep: Filter lines matching pattern. Args: { pattern: string, path?: string, caseInsensitive?: boolean, invertMatch?: boolean }
- sort: Sort lines. Args: { path?: string, reverse?: boolean, numeric?: boolean, unique?: boolean, ignoreCase?: boolean }
- uniq: Filter adjacent duplicates. Args: { path?: string, count?: boolean, duplicatesOnly?: boolean, uniqueOnly?: boolean, ignoreCase?: boolean }
- head: First N lines. Args: { path?: string, lines?: number }
- tail: Last N lines. Args: { path?: string, lines?: number }
- wc: Count lines/words/chars. Args: { path?: string, countLines?: boolean, countWords?: boolean, countChars?: boolean }
- write_file: Write to file (terminal). Args: { path: string, content?: string }

Example: Read file, filter imports, sort:
{ commands: [{ tool: "read_file", args: { path: "src/main.ts" } }, { tool: "grep", args: { pattern: "^import" } }, { tool: "sort", args: {} }] }`,
  inputSchema: z.object({
    commands: z.array(pipeCommandSchema).min(1)
      .describe('Commands to execute in sequence. Output of each becomes input to the next.'),
    debug: z.boolean().optional().default(false)
      .describe('If true, include intermediate results in output for debugging'),
  }),
  execute: async (input) => {
    const { commands, debug } = input;

    // First, check permission for the pipe tool itself
    const pipeAllowed = await checkPermission('pipe', { commands: commands.map(c => c.tool) });
    if (!pipeAllowed) {
      return { error: 'Permission denied for pipe command' };
    }

    // Pre-validate all command permissions before executing any
    const permissionErrors: string[] = [];
    for (const cmd of commands) {
      const permissionName = PIPEABLE_TOOL_PERMISSIONS[cmd.tool as PipeableToolName];
      if (!permissionName) {
        permissionErrors.push(`Unknown tool: ${cmd.tool}`);
        continue;
      }

      const allowed = await checkPermission(permissionName, cmd.args);
      if (!allowed) {
        permissionErrors.push(`Permission denied for ${cmd.tool}`);
      }
    }

    if (permissionErrors.length > 0) {
      return {
        error: `Permission check failed. No commands executed.\n${permissionErrors.join('\n')}`,
      };
    }

    // Execute commands in sequence
    let currentOutput: string | undefined;
    const intermediateResults: Array<{ tool: string; output?: string; error?: string }> = [];

    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i]!;
      const pipeableFn = pipeableFunctions[cmd.tool as PipeableToolName];

      if (!pipeableFn) {
        return { error: `Unknown tool: ${cmd.tool}` };
      }

      const result = await pipeableFn(cmd.args || {}, currentOutput);

      if (debug) {
        intermediateResults.push({
          tool: cmd.tool,
          output: result.success ? result.output : undefined,
          error: result.error,
        });
      }

      if (!result.success) {
        return {
          error: `Command ${i + 1} (${cmd.tool}) failed: ${result.error}`,
          ...(debug && { intermediateResults }),
        };
      }

      currentOutput = result.output;
    }

    // Return final result
    const response: Record<string, unknown> = {
      success: true,
      output: currentOutput,
      commandsExecuted: commands.length,
    };

    if (debug) {
      response.intermediateResults = intermediateResults;
    }

    return response;
  },
});

/**
 * Edit a file using search/replace or line-based operations.
 *
 * This is the preferred tool for making targeted changes to files.
 * Instead of rewriting an entire file with write_file, this tool applies
 * precise edits and returns a unified diff showing exactly what changed.
 *
 * Supports two editing modes:
 * 1. Search & Replace (primary) — find a unique string and replace it
 * 2. Line-based (fallback) — operate on specific line numbers
 *
 * Both modes generate and return a unified diff for the user to review.
 */
export const editFileTool = tool({
  description:
    'Edit a file by applying targeted changes instead of rewriting the whole file. Supports search/replace (preferred) and line-based editing. Returns a unified diff of changes. Use this instead of write_file when modifying existing files.',
  inputSchema: z.object({
    path: z.string().describe('The path to the file relative to the root directory'),
    edits: z
      .array(
        z.object({
          old_text: z
            .string()
            .optional()
            .describe(
              'The exact text to find and replace. Must be unique in the file unless replace_all is true. Provide this for search/replace mode.'
            ),
          new_text: z
            .string()
            .describe(
              'The replacement text. For search/replace: replaces old_text. For line-based: replaces content at the specified lines. Use empty string to delete.'
            ),
          replace_all: z
            .boolean()
            .optional()
            .default(false)
            .describe('Replace all occurrences of old_text (default: false, search/replace mode only)'),
          line: z
            .number()
            .int()
            .positive()
            .optional()
            .describe(
              'Start line number (1-indexed) for line-based editing. Provide this instead of old_text for line-based mode.'
            ),
          end_line: z
            .number()
            .int()
            .positive()
            .optional()
            .describe(
              'End line number (1-indexed, inclusive). Defaults to same as line. Only used with line-based mode.'
            ),
        })
      )
      .min(1)
      .describe('Array of edit operations to apply sequentially'),
    dry_run: z
      .boolean()
      .optional()
      .default(false)
      .describe('If true, preview the diff without writing changes to the file'),
  }),
  execute: async (input) => {
    const allowed = await checkPermission('edit_file', { path: input.path, edits: input.edits });
    if (!allowed) {
      return { error: 'Permission denied to edit file' };
    }

    try {
      const originalContent = await fileSystemManager.readFile(input.path);
      let content = originalContent;
      const editResults: Array<{
        editIndex: number;
        mode: 'search_replace' | 'line';
        description: string;
      }> = [];

      // Apply each edit sequentially
      for (let i = 0; i < input.edits.length; i++) {
        const edit = input.edits[i]!;

        // Validate: must provide old_text or line, not both
        if (edit.old_text !== undefined && edit.line !== undefined) {
          return {
            error: `Edit ${i + 1}: Provide either old_text (search/replace) or line (line-based), not both.`,
          };
        }
        if (edit.old_text === undefined && edit.line === undefined) {
          return {
            error: `Edit ${i + 1}: Must provide either old_text (search/replace) or line (line-based).`,
          };
        }

        if (edit.old_text !== undefined) {
          // Search & Replace mode
          if (edit.old_text === '') {
            return {
              error: `Edit ${i + 1}: old_text must not be empty. Provide the exact text to find and replace.`,
            };
          }

          const occurrences = content.split(edit.old_text).length - 1;

          if (occurrences === 0) {
            return {
              error: `Edit ${i + 1}: old_text not found in file. The text to find must match exactly (including whitespace and indentation).`,
            };
          }

          if (occurrences > 1 && !edit.replace_all) {
            return {
              error: `Edit ${i + 1}: old_text found ${occurrences} times. Provide more surrounding context to make it unique, or set replace_all to true.`,
            };
          }

          if (edit.replace_all) {
            content = content.split(edit.old_text).join(edit.new_text);
            editResults.push({
              editIndex: i,
              mode: 'search_replace',
              description: `Replaced ${occurrences} occurrence(s)`,
            });
          } else {
            // Replace first (and only) occurrence
            const idx = content.indexOf(edit.old_text);
            content = content.slice(0, idx) + edit.new_text + content.slice(idx + edit.old_text.length);
            editResults.push({
              editIndex: i,
              mode: 'search_replace',
              description: 'Replaced 1 occurrence',
            });
          }
        } else if (edit.line !== undefined) {
          // Line-based mode
          const lines = content.split('\n');
          const startLine = edit.line;
          const endLine = edit.end_line ?? startLine;

          if (startLine > lines.length) {
            return {
              error: `Edit ${i + 1}: line ${startLine} is beyond end of file (${lines.length} lines).`,
            };
          }
          if (endLine > lines.length) {
            return {
              error: `Edit ${i + 1}: end_line ${endLine} is beyond end of file (${lines.length} lines).`,
            };
          }
          if (endLine < startLine) {
            return {
              error: `Edit ${i + 1}: end_line (${endLine}) must be >= line (${startLine}).`,
            };
          }

          // Replace the line range with new content
          const startIdx = startLine - 1;
          const endIdx = endLine; // slice endIdx is exclusive
          const newLines = edit.new_text === '' ? [] : edit.new_text.split('\n');

          lines.splice(startIdx, endIdx - startIdx, ...newLines);
          content = lines.join('\n');

          const lineRange = startLine === endLine ? `line ${startLine}` : `lines ${startLine}-${endLine}`;
          if (edit.new_text === '') {
            editResults.push({
              editIndex: i,
              mode: 'line',
              description: `Deleted ${lineRange}`,
            });
          } else {
            editResults.push({
              editIndex: i,
              mode: 'line',
              description: `Replaced ${lineRange} with ${newLines.length} line(s)`,
            });
          }
        }
      }

      // Generate unified diff
      const { diff, hasChanges } = generateUnifiedDiff(
        originalContent,
        content,
        { oldLabel: input.path, newLabel: input.path }
      );

      if (!hasChanges) {
        return {
          success: true,
          path: input.path,
          message: 'No changes to apply (old and new content are identical)',
          editsApplied: 0,
        };
      }

      // Cache the diff for user display
      const resultId = toolResultCache.store('edit_file', diff, {
        path: input.path,
      });

      // Write unless dry_run
      if (!input.dry_run) {
        await fileSystemManager.writeFile(input.path, content);
      }

      return {
        success: true,
        path: input.path,
        resultId,
        dry_run: input.dry_run,
        editsApplied: editResults.length,
        editResults,
        message: input.dry_run
          ? `Dry run: ${editResults.length} edit(s) previewed`
          : `Applied ${editResults.length} edit(s) to ${input.path}`,
        diff,
      };
    } catch (error) {
      return {
        error: `Failed to edit file: ${(error as Error).message}`,
      };
    }
  },
});

/**
 * All available tools for AI
 */
export const fileTools: Record<string, Tool> = {
  open_file: openFileTool,
  read_file_content: readFileContentTool,
  create_file: createFileTool,
  write_file: writeFileTool,
  edit_file: editFileTool,
  rename_file: renameFileTool,
  move_file: moveFileTool,
  delete_file: deleteFileTool,
  list_files: listFilesTool,
  get_file_metadata: getFileMetadataTool,
  cat: catTool,
  grep: grepTool,
  head_file: headFileTool,
  tail_file: tailFileTool,
  cp: cpTool,
  mkdir: mkdirTool,
  tree: treeTool,
  diff: diffTool,
  wc: wcTool,
  sort: sortTool,
  uniq: uniqTool,
  pipe: pipeTool,
};
