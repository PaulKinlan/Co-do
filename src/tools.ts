/**
 * File operation tools for AI
 * Each tool checks permissions before executing
 */

import { Tool, tool } from 'ai';
import { z } from 'zod';
import { fileSystemManager } from './fileSystem';
import { preferencesManager, ToolName } from './preferences';
import { toolResultCache, generateContentSummary } from './toolResultCache';
import { generateUnifiedDiff } from './diff';
import {
  registerPipeable,
  getPipeable,
  getPipeableNames,
  buildPipeDescription,
} from './pipeable';
import type { PipeableResult } from './pipeable';
import {
  skillsManager,
  generateSkillMd,
  substituteArguments,
} from './skills';

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
// PIPEABLE COMMAND REGISTRATIONS
//
// Each registration makes a command available in the pipe tool.
// To add a new pipeable command, simply call registerPipeable() here
// (or in any other module) — the pipe tool discovers it automatically.
// ============================================================================

/**
 * Construct a RegExp safely, guarding against invalid patterns and
 * excessively long patterns that could cause ReDoS.
 */
function safeRegExp(pattern: string, flags?: string): RegExp {
  const MAX_PATTERN_LENGTH = 1000;
  if (pattern.length > MAX_PATTERN_LENGTH) {
    throw new Error(`Pattern too long (${pattern.length} chars, max ${MAX_PATTERN_LENGTH})`);
  }
  return new RegExp(pattern, flags);
}

/**
 * Read content from a file path or stdin, returning an error result
 * if neither is available. Shared helper for pipeable commands.
 */
async function resolveInput(
  commandName: string,
  path: string | undefined,
  stdin: string | undefined,
): Promise<PipeableResult & { content?: string }> {
  if (path) {
    try {
      const content = await fileSystemManager.readFile(path);
      return { success: true, content };
    } catch (error) {
      return { success: false, error: `${commandName}: ${path}: ${(error as Error).message}` };
    }
  }
  if (stdin !== undefined) {
    return { success: true, content: stdin };
  }
  return { success: false, error: `${commandName}: no input (provide path or pipe input)` };
}

// -- cat ---------------------------------------------------------------------
registerPipeable('cat', {
  description: 'Read file(s) or pass through input',
  argsDescription: '{ paths?: string[], path?: string }',
  permissionName: 'cat',
  execute: async (args, stdin) => {
    const paths = args.paths as string[] | undefined;
    const path = args.path as string | undefined;

    if (!paths && !path) {
      if (stdin !== undefined) {
        return { success: true, output: stdin };
      }
      return { success: false, error: 'cat: no input (provide paths or pipe input)' };
    }

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
});

// -- read_file ---------------------------------------------------------------
registerPipeable('read_file', {
  description: 'Read a single file',
  argsDescription: '{ path: string }',
  permissionName: 'read_file_content',
  execute: async (args) => {
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
});

// -- grep --------------------------------------------------------------------
registerPipeable('grep', {
  description: 'Filter lines matching a regex pattern',
  argsDescription: '{ pattern: string, path?: string, caseInsensitive?: boolean, invertMatch?: boolean }',
  permissionName: 'grep',
  execute: async (args, stdin) => {
    const pattern = args.pattern as string;
    if (!pattern) {
      return { success: false, error: 'grep: pattern required' };
    }

    const input = await resolveInput('grep', args.path as string | undefined, stdin);
    if (!input.success) return input as PipeableResult;

    let regex: RegExp;
    try {
      regex = safeRegExp(pattern, args.caseInsensitive ? 'i' : undefined);
    } catch (error) {
      return { success: false, error: `grep: invalid pattern: ${(error as Error).message}` };
    }

    const invertMatch = args.invertMatch as boolean | undefined;
    const lines = input.content!.split('\n');
    const matchedLines = lines.filter(line => {
      const matches = regex.test(line);
      return invertMatch ? !matches : matches;
    });

    return { success: true, output: matchedLines.join('\n') };
  },
});

// -- sort --------------------------------------------------------------------
registerPipeable('sort', {
  description: 'Sort lines alphabetically or numerically',
  argsDescription: '{ path?: string, reverse?: boolean, numeric?: boolean, unique?: boolean, ignoreCase?: boolean }',
  permissionName: 'sort',
  execute: async (args, stdin) => {
    const input = await resolveInput('sort', args.path as string | undefined, stdin);
    if (!input.success) return input as PipeableResult;

    const reverse = args.reverse as boolean | undefined;
    const numeric = args.numeric as boolean | undefined;
    const unique = args.unique as boolean | undefined;
    const ignoreCase = args.ignoreCase as boolean | undefined;

    let lines = input.content!.split('\n');

    // Remove trailing empty line if present
    if (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop();
    }

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
});

// -- uniq --------------------------------------------------------------------
registerPipeable('uniq', {
  description: 'Filter adjacent duplicate lines',
  argsDescription: '{ path?: string, count?: boolean, duplicatesOnly?: boolean, uniqueOnly?: boolean, ignoreCase?: boolean }',
  permissionName: 'uniq',
  execute: async (args, stdin) => {
    const input = await resolveInput('uniq', args.path as string | undefined, stdin);
    if (!input.success) return input as PipeableResult;

    const count = args.count as boolean | undefined;
    const duplicatesOnly = args.duplicatesOnly as boolean | undefined;
    const uniqueOnly = args.uniqueOnly as boolean | undefined;
    const ignoreCase = args.ignoreCase as boolean | undefined;

    const lines = input.content!.split('\n');

    if (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop();
    }

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

    let filtered = processed;
    if (duplicatesOnly) {
      filtered = filtered.filter(item => item.count > 1);
    } else if (uniqueOnly) {
      filtered = filtered.filter(item => item.count === 1);
    }

    let outputLines: string[];
    if (count) {
      outputLines = filtered.map(item => `${item.count.toString().padStart(7)} ${item.line}`);
    } else {
      outputLines = filtered.map(item => item.line);
    }

    return { success: true, output: outputLines.join('\n') };
  },
});

// -- head --------------------------------------------------------------------
registerPipeable('head', {
  description: 'Get first N lines (default 10)',
  argsDescription: '{ path?: string, lines?: number }',
  permissionName: 'head_file',
  execute: async (args, stdin) => {
    const input = await resolveInput('head', args.path as string | undefined, stdin);
    if (!input.success) return input as PipeableResult;

    const n = (args.lines as number | undefined) ?? 10;
    const allLines = input.content!.split('\n');

    if (allLines.length > 0 && allLines[allLines.length - 1] === '') {
      allLines.pop();
    }

    return { success: true, output: allLines.slice(0, n).join('\n') };
  },
});

// -- tail --------------------------------------------------------------------
registerPipeable('tail', {
  description: 'Get last N lines (default 10)',
  argsDescription: '{ path?: string, lines?: number }',
  permissionName: 'tail_file',
  execute: async (args, stdin) => {
    const input = await resolveInput('tail', args.path as string | undefined, stdin);
    if (!input.success) return input as PipeableResult;

    const n = (args.lines as number | undefined) ?? 10;
    const allLines = input.content!.split('\n');

    if (allLines.length > 0 && allLines[allLines.length - 1] === '') {
      allLines.pop();
    }

    return { success: true, output: allLines.slice(-n).join('\n') };
  },
});

// -- wc ----------------------------------------------------------------------
registerPipeable('wc', {
  description: 'Count lines, words, and/or characters',
  argsDescription: '{ path?: string, countLines?: boolean, countWords?: boolean, countChars?: boolean }',
  permissionName: 'wc',
  execute: async (args, stdin) => {
    const input = await resolveInput('wc', args.path as string | undefined, stdin);
    if (!input.success) return input as PipeableResult;

    const shouldCountLines = (args.countLines as boolean | undefined) ?? true;
    const shouldCountWords = (args.countWords as boolean | undefined) ?? true;
    const shouldCountChars = (args.countChars as boolean | undefined) ?? true;

    const content = input.content!;
    const lines = shouldCountLines ? (content.match(/\n/g) || []).length : 0;
    const words = shouldCountWords ? content.split(/\s+/).filter(w => w.length > 0).length : 0;
    const chars = shouldCountChars ? content.length : 0;

    const parts: string[] = [];
    if (shouldCountLines) parts.push(lines.toString().padStart(8));
    if (shouldCountWords) parts.push(words.toString().padStart(8));
    if (shouldCountChars) parts.push(chars.toString().padStart(8));

    return { success: true, output: parts.join('') };
  },
});

// -- write_file --------------------------------------------------------------
registerPipeable('write_file', {
  description: 'Write piped content (or explicit content) to a file',
  argsDescription: '{ path: string, content?: string }',
  permissionName: 'write_file',
  execute: async (args, stdin) => {
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
});

// ============================================================================
// PIPE TOOL
//
// Thin orchestrator that discovers commands from the pipeable registry.
// ============================================================================

/**
 * Pipe tool — chain multiple commands together.
 *
 * Pre-validates all permissions before execution.
 * Only returns the final output to reduce context usage.
 */
export const pipeTool = tool({
  description: buildPipeDescription(),
  inputSchema: z.object({
    commands: z.array(z.object({
      tool: z.string().describe('The pipeable command name to execute'),
      args: z.record(z.unknown()).optional().default({})
        .describe('Arguments for the command'),
    })).min(1)
      .describe('Commands to execute in sequence. Output of each becomes input to the next.'),
    debug: z.boolean().optional().default(false)
      .describe('If true, include intermediate results in output for debugging'),
  }),
  execute: async (input) => {
    const { commands, debug } = input;

    // Check permission for the pipe tool itself
    const pipeAllowed = await checkPermission('pipe', { commands: commands.map(c => c.tool) });
    if (!pipeAllowed) {
      return { error: 'Permission denied for pipe command' };
    }

    // Pre-validate: all commands must exist and have permission
    const permissionErrors: string[] = [];
    for (const cmd of commands) {
      const pipeable = getPipeable(cmd.tool);
      if (!pipeable) {
        const available = getPipeableNames().join(', ');
        permissionErrors.push(`Unknown command: ${cmd.tool}. Available: ${available}`);
        continue;
      }

      const allowed = await checkPermission(pipeable.permissionName, cmd.args);
      if (!allowed) {
        permissionErrors.push(`Permission denied for ${cmd.tool}`);
      }
    }

    if (permissionErrors.length > 0) {
      return {
        error: `Permission check failed. No commands executed.\n${permissionErrors.join('\n')}`,
      };
    }

    // Execute commands in sequence, piping output → stdin
    let currentOutput: string | undefined;
    const intermediateResults: Array<{ tool: string; output?: string; error?: string }> = [];

    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i]!;
      const pipeable = getPipeable(cmd.tool)!; // validated above

      const result = await pipeable.execute(cmd.args || {}, currentOutput);

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

// ============================================================================
// SKILL TOOLS
//
// Tools for creating, running, listing, and importing reusable AI workflows
// following the SKILL.md open standard.
// ============================================================================

/**
 * Create a reusable skill as a SKILL.md file.
 */
export const makeSkillTool = tool({
  description: 'Create a reusable skill as a SKILL.md file. Skills follow the open standard used by Claude Code and other AI tools. The skill is saved to .skills/<name>/SKILL.md in the workspace.',
  inputSchema: z.object({
    name: z.string().describe('Skill name in kebab-case (becomes the directory name)'),
    description: z.string().describe('What this skill does and when to use it (including trigger examples)'),
    instructions: z.string().describe('Markdown instructions the AI follows when running this skill. Use $ARGUMENTS, $0, $1 for parameter substitution.'),
    allowedTools: z.array(z.string()).optional().describe('Tools this skill is allowed to use'),
    model: z.string().optional().describe('Model to use (e.g., opus, sonnet, haiku)'),
    userInvocable: z.boolean().optional().describe('Whether user can invoke via name (default: true)'),
    argumentHint: z.string().optional().describe('Usage hint for arguments (e.g., "[directory] [format]")'),
  }),
  execute: async (input) => {
    const allowed = await checkPermission('make_skill', { name: input.name });
    if (!allowed) {
      return { error: 'Permission denied to create skill' };
    }

    try {
      // Validate name is kebab-case
      if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(input.name)) {
        return { error: 'Skill name must be in kebab-case (e.g., "rename-images", "find-todos")' };
      }

      // Generate SKILL.md content
      const content = generateSkillMd({
        name: input.name,
        description: input.description,
        instructions: input.instructions,
        allowedTools: input.allowedTools,
        model: input.model,
        userInvocable: input.userInvocable,
        argumentHint: input.argumentHint,
      });

      // Create the skill directory and file
      const dirPath = `.skills/${input.name}`;
      const filePath = `${dirPath}/SKILL.md`;

      await fileSystemManager.createDirectory(dirPath);
      await fileSystemManager.createFile(filePath, content);

      // Refresh the skills index
      await skillsManager.refreshIndex();

      return {
        success: true,
        path: filePath,
        name: input.name,
        message: `Skill "${input.name}" created at ${filePath}`,
      };
    } catch (error) {
      return { error: `Failed to create skill: ${(error as Error).message}` };
    }
  },
});

/**
 * Run a saved skill by name with the given arguments.
 *
 * Returns the filled instructions for the AI to follow rather than
 * executing them directly — the AI mediates execution adaptively.
 */
export const runSkillTool = tool({
  description: 'Run a saved skill by name with the given arguments. Returns the skill instructions for you to follow. The AI should then execute the instructions step by step.',
  inputSchema: z.object({
    name: z.string().describe('Name of the skill to run'),
    arguments: z.string().optional().default('').describe('Arguments string (substituted for $ARGUMENTS; split by whitespace for $0, $1, etc.)'),
  }),
  execute: async (input) => {
    const allowed = await checkPermission('run_skill', { name: input.name });
    if (!allowed) {
      return { error: 'Permission denied to run skill' };
    }

    try {
      const skill = await skillsManager.loadSkill(input.name);
      if (!skill) {
        // Provide helpful message with available skills
        const available = skillsManager.getInvocable();
        const names = available.map(s => s.name).join(', ');
        return {
          error: `Skill "${input.name}" not found. Available skills: ${names || '(none)'}`,
        };
      }

      // Substitute arguments into the skill body
      const filledBody = substituteArguments(skill.body, input.arguments ?? '');

      return {
        success: true,
        name: skill.frontmatter.name,
        description: skill.frontmatter.description,
        instructions: filledBody,
        allowedTools: skill.frontmatter['allowed-tools'],
        model: skill.frontmatter.model,
        argumentHint: skill.frontmatter['argument-hint'],
      };
    } catch (error) {
      return { error: `Failed to run skill: ${(error as Error).message}` };
    }
  },
});

/**
 * List all available skills from the workspace.
 */
export const listSkillsTool = tool({
  description: 'List all available skills from the workspace. Skills are reusable AI workflows saved as SKILL.md files.',
  inputSchema: z.object({
    query: z.string().optional().describe('Search query to filter skills by name or description'),
  }),
  execute: async (input) => {
    const allowed = await checkPermission('list_skills', {});
    if (!allowed) {
      return { error: 'Permission denied to list skills' };
    }

    try {
      // Ensure index is up to date
      await skillsManager.refreshIndex();

      const skills = input.query
        ? skillsManager.search(input.query)
        : skillsManager.getAll();

      const skillList = skills.map(s => ({
        name: s.name,
        description: s.description,
        source: s.readOnly ? 'claude-skills' : 'workspace',
        argumentHint: s.argumentHint,
        allowedTools: s.allowedTools,
        model: s.model,
      }));

      return {
        success: true,
        skills: skillList,
        count: skillList.length,
      };
    } catch (error) {
      return { error: `Failed to list skills: ${(error as Error).message}` };
    }
  },
});

/**
 * Import a skill from a file path within the workspace.
 * Copies the skill directory to .skills/<name>/.
 */
export const importSkillTool = tool({
  description: 'Import a skill from a file path or .claude/skills directory. Copies the skill to .skills/<name>/ for local use. Supports the SKILL.md open standard.',
  inputSchema: z.object({
    source: z.string().describe('Path to SKILL.md file or skill directory (e.g., ".claude/skills/my-skill" or "path/to/SKILL.md")'),
    targetName: z.string().optional().describe('Override the skill name (default: use name from SKILL.md frontmatter)'),
  }),
  execute: async (input) => {
    const allowed = await checkPermission('import_skill', { source: input.source });
    if (!allowed) {
      return { error: 'Permission denied to import skill' };
    }

    try {
      // Determine if source is a SKILL.md file or a directory
      let skillMdPath: string;
      let sourceDir: string;

      if (input.source.endsWith('SKILL.md') || input.source.endsWith('skill.md')) {
        skillMdPath = input.source;
        sourceDir = input.source.replace(/\/SKILL\.md$/i, '');
      } else {
        // Assume it's a directory containing SKILL.md
        skillMdPath = `${input.source}/SKILL.md`;
        sourceDir = input.source;
      }

      // Read and parse the source SKILL.md
      let content: string;
      try {
        content = await fileSystemManager.readFile(skillMdPath);
      } catch {
        return { error: `Could not read SKILL.md at "${skillMdPath}". Ensure the path exists.` };
      }

      const { parseFrontmatter } = await import('./skills');
      const parsed = parseFrontmatter(content);
      if (!parsed) {
        return { error: `Invalid SKILL.md format at "${skillMdPath}". Missing or invalid YAML frontmatter.` };
      }

      const name = input.targetName ?? parsed.frontmatter.name;

      // Validate name is kebab-case
      if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name)) {
        return { error: `Skill name "${name}" is not valid kebab-case. Use targetName to override.` };
      }

      // Create target directory
      const targetDir = `.skills/${name}`;
      const targetFile = `${targetDir}/SKILL.md`;

      await fileSystemManager.createDirectory(targetDir);

      // If targetName was provided, update the name in frontmatter
      if (input.targetName && input.targetName !== parsed.frontmatter.name) {
        const updatedContent = content.replace(
          /^name:\s*.+$/m,
          `name: ${input.targetName}`
        );
        await fileSystemManager.createFile(targetFile, updatedContent);
      } else {
        await fileSystemManager.createFile(targetFile, content);
      }

      // Try to copy supporting files from source directory
      try {
        const entries = await fileSystemManager.listFiles();
        const supportingFiles = entries.filter(e =>
          e.kind === 'file' &&
          e.path.startsWith(sourceDir + '/') &&
          !e.path.endsWith('/SKILL.md')
        );

        for (const file of supportingFiles) {
          const relativePath = file.path.slice(sourceDir.length);
          const targetPath = `${targetDir}${relativePath}`;
          // Ensure parent directories exist
          const parentDir = targetPath.replace(/\/[^/]+$/, '');
          if (parentDir !== targetDir) {
            await fileSystemManager.createDirectory(parentDir);
          }
          await fileSystemManager.copyFile(file.path, targetPath);
        }
      } catch {
        // Supporting file copy is best-effort
      }

      // Refresh the skills index
      await skillsManager.refreshIndex();

      return {
        success: true,
        name,
        path: targetFile,
        source: sourceDir,
        message: `Skill "${name}" imported to ${targetFile}`,
      };
    } catch (error) {
      return { error: `Failed to import skill: ${(error as Error).message}` };
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
  cp: cpTool,
  mkdir: mkdirTool,
  pipe: pipeTool,
  make_skill: makeSkillTool,
  run_skill: runSkillTool,
  list_skills: listSkillsTool,
  import_skill: importSkillTool,
};
