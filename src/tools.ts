/**
 * File operation tools for AI
 * Each tool checks permissions before executing
 */

import { Tool, tool } from 'ai';
import { z } from 'zod';
import { fileSystemManager } from './fileSystem';
import { preferencesManager, ToolName } from './preferences';
import { toolResultCache, generateContentSummary } from './toolResultCache';

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

/**
 * Compute Longest Common Subsequence for diff
 */
function computeLCS(lines1: string[], lines2: string[]): number[][] {
  const m = lines1.length;
  const n = lines2.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0) as number[]);

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (lines1[i - 1] === lines2[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }

  return dp;
}

/**
 * Generate diff hunks from LCS
 */
function generateDiffHunks(
  lines1: string[],
  lines2: string[],
  dp: number[][],
  contextLines: number
): Array<{ header: string; lines: string[] }> {
  // Backtrack to find differences
  const changes: Array<{ type: 'equal' | 'delete' | 'insert'; line1?: number; line2?: number }> =
    [];

  let i = lines1.length;
  let j = lines2.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && lines1[i - 1] === lines2[j - 1]) {
      changes.unshift({ type: 'equal', line1: i - 1, line2: j - 1 });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
      changes.unshift({ type: 'insert', line2: j - 1 });
      j--;
    } else {
      changes.unshift({ type: 'delete', line1: i - 1 });
      i--;
    }
  }

  // Group changes into hunks with context
  const hunks: Array<{ header: string; lines: string[] }> = [];
  let hunkStart = -1;
  let hunkLines: string[] = [];
  let line1Start = 0;
  let line2Start = 0;
  let line1Count = 0;
  let line2Count = 0;
  let lastChangeIdx = -contextLines - 1;

  for (let idx = 0; idx < changes.length; idx++) {
    const change = changes[idx]!;
    const isChange = change.type !== 'equal';
    const distanceFromLastChange = idx - lastChangeIdx;

    if (isChange) {
      // Helper to find line numbers by scanning changes from a start index
      const findLineNumbers = (startIdx: number): { line1: number; line2: number } => {
        let foundLine1: number | undefined;
        let foundLine2: number | undefined;
        for (let i = startIdx; i < changes.length && (foundLine1 === undefined || foundLine2 === undefined); i++) {
          const c = changes[i]!;
          if (foundLine1 === undefined && c.line1 !== undefined) {
            foundLine1 = c.line1;
          }
          if (foundLine2 === undefined && c.line2 !== undefined) {
            foundLine2 = c.line2;
          }
        }
        return { line1: foundLine1 ?? 0, line2: foundLine2 ?? 0 };
      };

      if (hunkStart === -1) {
        // Start new hunk with context
        hunkStart = Math.max(0, idx - contextLines);
        const lineNums = findLineNumbers(hunkStart);
        line1Start = lineNums.line1;
        line2Start = lineNums.line2;

        // Add leading context
        for (let c = hunkStart; c < idx; c++) {
          const ctx = changes[c]!;
          if (ctx.type === 'equal' && ctx.line1 !== undefined) {
            hunkLines.push(' ' + lines1[ctx.line1]);
            line1Count++;
            line2Count++;
          }
        }
      } else if (distanceFromLastChange > contextLines * 2) {
        // End current hunk and start new one
        // Add trailing context to current hunk
        for (let c = lastChangeIdx + 1; c <= Math.min(lastChangeIdx + contextLines, idx - 1); c++) {
          const ctx = changes[c]!;
          if (ctx.type === 'equal' && ctx.line1 !== undefined) {
            hunkLines.push(' ' + lines1[ctx.line1]);
            line1Count++;
            line2Count++;
          }
        }

        hunks.push({
          header: `@@ -${line1Start + 1},${line1Count} +${line2Start + 1},${line2Count} @@`,
          lines: hunkLines,
        });

        // Start new hunk
        hunkStart = idx - contextLines;
        hunkLines = [];
        const safeStart = Math.max(0, hunkStart);
        const lineNums = findLineNumbers(safeStart);
        line1Start = lineNums.line1;
        line2Start = lineNums.line2;
        line1Count = 0;
        line2Count = 0;

        // Add leading context
        for (let c = safeStart; c < idx; c++) {
          const ctx = changes[c]!;
          if (ctx.type === 'equal' && ctx.line1 !== undefined) {
            hunkLines.push(' ' + lines1[ctx.line1]);
            line1Count++;
            line2Count++;
          }
        }
      } else {
        // Fill gap with context
        for (let c = lastChangeIdx + 1; c < idx; c++) {
          const ctx = changes[c]!;
          if (ctx.type === 'equal' && ctx.line1 !== undefined) {
            hunkLines.push(' ' + lines1[ctx.line1]);
            line1Count++;
            line2Count++;
          }
        }
      }

      // Add the change
      if (change.type === 'delete' && change.line1 !== undefined) {
        hunkLines.push('-' + lines1[change.line1]);
        line1Count++;
      } else if (change.type === 'insert' && change.line2 !== undefined) {
        hunkLines.push('+' + lines2[change.line2]);
        line2Count++;
      }

      lastChangeIdx = idx;
    }
  }

  // Finalize last hunk
  if (hunkStart !== -1) {
    // Add trailing context
    for (
      let c = lastChangeIdx + 1;
      c <= Math.min(lastChangeIdx + contextLines, changes.length - 1);
      c++
    ) {
      const ctx = changes[c]!;
      if (ctx.type === 'equal' && ctx.line1 !== undefined) {
        hunkLines.push(' ' + lines1[ctx.line1]);
        line1Count++;
        line2Count++;
      }
    }

    hunks.push({
      header: `@@ -${line1Start + 1},${line1Count} +${line2Start + 1},${line2Count} @@`,
      lines: hunkLines,
    });
  }

  return hunks;
}

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

/**
 * All available tools for AI
 */
export const fileTools: Record<string, Tool> = {
  open_file: openFileTool,
  read_file_content: readFileContentTool,
  create_file: createFileTool,
  write_file: writeFileTool,
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
};
