/**
 * WASM Tool Manager
 *
 * This is the central orchestrator for WASM custom tools. It handles:
 * - Loading and storing tools
 * - Converting tools to Vercel AI SDK format
 * - Executing tools with proper I/O handling (via Web Worker for isolation)
 * - Permission management
 *
 * Security: WASM execution runs in an isolated Web Worker by default.
 * This prevents long-running or malicious modules from blocking the UI
 * and enables true termination via Worker.terminate().
 */

import { tool, type Tool } from 'ai';
import { z } from 'zod';
import { storageManager } from '../storage';
import { fileSystemManager } from '../fileSystem';
import { toolResultCache } from '../toolResultCache';
import { registerPipeable } from '../pipeable';
import { WasmRuntime } from './runtime';
import { VirtualFileSystem } from './vfs';
import { WasmToolLoader } from './loader';
import { BUILTIN_TOOLS, getWasmToolName } from './registry';
import { wasmWorkerManager } from './worker-manager';
import type {
  StoredWasmTool,
  BuiltinToolConfig,
  WasmToolManifest,
  ToolExecutionResult,
} from './types';
import { base64ToUint8Array } from './adapters/utils';

/**
 * Map of tool names to their adapter module dynamic importers.
 * Tools with adapters bypass the standard WASI runtime and use
 * library-specific execution instead (e.g., @imagemagick/magick-wasm).
 */
const TOOL_ADAPTERS: Record<string, () => Promise<{ execute: (wasmBinary: ArrayBuffer, args: Record<string, unknown>) => Promise<ToolExecutionResult> }>> = {
  imagemagick: () => import('./adapters/imagemagick-adapter'),
  ffmpeg: () => import('./adapters/ffmpeg-adapter'),
};

/**
 * JSON.stringify with sorted keys so property insertion order doesn't
 * cause spurious manifest-comparison mismatches.
 */
function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v
  );
}

/**
 * Format a byte count for human-readable display.
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Permission callback type for asking user permission.
 */
type PermissionCallback = (toolName: string, args: unknown) => Promise<boolean>;

/**
 * Default permission callback that always allows execution.
 */
let permissionCallback: PermissionCallback = async () => true;

/**
 * Set the permission callback function.
 */
export function setWasmPermissionCallback(callback: PermissionCallback): void {
  permissionCallback = callback;
}

/**
 * Get WASM tool permission level from localStorage.
 */
export function getWasmToolPermission(toolName: string): 'always' | 'ask' | 'never' {
  const stored = localStorage.getItem(`wasm_tool_permission_${toolName}`);
  if (stored === 'always' || stored === 'ask' || stored === 'never') {
    return stored;
  }
  return 'ask'; // Default
}

/**
 * Set WASM tool permission level in localStorage.
 */
export function setWasmToolPermission(toolName: string, level: 'always' | 'ask' | 'never'): void {
  localStorage.setItem(`wasm_tool_permission_${toolName}`, level);
}

/**
 * Check if a WASM tool has permission to execute.
 */
async function checkWasmPermission(toolName: string, args: unknown): Promise<boolean> {
  const permission = getWasmToolPermission(toolName);

  switch (permission) {
    case 'always':
      return true;
    case 'never':
      return false;
    case 'ask':
      return await permissionCallback(toolName, args);
    default:
      return false;
  }
}

/**
 * WASM Tool Manager - central orchestrator for WASM custom tools.
 *
 * By default, uses Web Worker-based execution for security and performance.
 * Falls back to main thread execution if Workers are not supported.
 */
export class WasmToolManager {
  private tools: Map<string, StoredWasmTool> = new Map();
  private runtime: WasmRuntime = new WasmRuntime();
  private loader: WasmToolLoader = new WasmToolLoader();
  private initialized: boolean = false;

  /**
   * Whether to use Worker-based execution (default: true).
   * Set to false to run WASM on the main thread (not recommended).
   */
  private useWorker: boolean = true;

  /**
   * Initialize the tool manager.
   * Loads all tools from IndexedDB and checks Worker support.
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      // Check Worker support
      if (!wasmWorkerManager.supported) {
        console.warn(
          'Web Workers not supported. WASM tools will run on main thread (may cause UI freezing).'
        );
        this.useWorker = false;
      }

      // Load all tools from storage
      const storedTools = await storageManager.getAllWasmTools();

      for (const tool of storedTools) {
        this.tools.set(tool.manifest.name, tool);
      }

      this.initialized = true;
      console.log(
        `WasmToolManager initialized with ${this.tools.size} tools ` +
          `(Worker execution: ${this.useWorker ? 'enabled' : 'disabled'})`
      );
    } catch (error) {
      console.error('Failed to initialize WasmToolManager:', error);
      throw error;
    }
  }

  /**
   * Check if Worker-based execution is enabled.
   */
  get isWorkerEnabled(): boolean {
    return this.useWorker && wasmWorkerManager.supported;
  }

  /**
   * Enable or disable Worker-based execution.
   * @param enabled - Whether to use Workers (recommended: true)
   */
  setWorkerEnabled(enabled: boolean): void {
    if (enabled && !wasmWorkerManager.supported) {
      console.warn('Cannot enable Worker execution: Workers not supported');
      return;
    }
    this.useWorker = enabled;
    console.log(`Worker execution ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Cancel all running WASM executions.
   * Only works when using Worker-based execution.
   */
  cancelAllExecutions(): void {
    if (this.useWorker) {
      wasmWorkerManager.cancelAll();
    }
  }

  /**
   * Install a tool from a ZIP file.
   */
  async installTool(zipFile: File): Promise<StoredWasmTool> {
    // Load and validate the ZIP
    const { manifest, wasmBinary } = await this.loader.loadFromZip(zipFile);

    // Check if tool already exists
    const existing = await storageManager.getWasmToolByName(manifest.name);
    if (existing) {
      throw new Error(`Tool "${manifest.name}" is already installed. Uninstall it first to reinstall.`);
    }

    // Create stored tool
    const storedTool = this.loader.createStoredTool(manifest, wasmBinary, 'user');

    // Save to IndexedDB
    await storageManager.saveWasmTool(storedTool);

    // Add to in-memory cache
    this.tools.set(manifest.name, storedTool);

    console.log(`Installed WASM tool: ${manifest.name}`);
    return storedTool;
  }

  /**
   * Uninstall a tool by ID.
   */
  async uninstallTool(id: string): Promise<void> {
    const tool = await storageManager.getWasmTool(id);
    if (!tool) {
      throw new Error('Tool not found');
    }

    // Don't allow uninstalling built-in tools
    if (tool.source === 'builtin') {
      throw new Error('Cannot uninstall built-in tools. You can disable them instead.');
    }

    // Remove from IndexedDB
    await storageManager.deleteWasmTool(id);

    // Remove from in-memory cache
    this.tools.delete(tool.manifest.name);

    console.log(`Uninstalled WASM tool: ${tool.manifest.name}`);
  }

  /**
   * Enable a tool. For lazy-loaded tools whose binary hasn't been
   * downloaded yet, downloads the binary from the same origin first.
   */
  async enableTool(id: string): Promise<void> {
    const tool = await storageManager.getWasmTool(id);
    if (!tool) {
      throw new Error('Tool not found');
    }

    // Build an updated copy instead of mutating the original, so that
    // if the save fails the in-memory state stays consistent.
    let wasmBinary = tool.wasmBinary;
    let updatedAt = tool.updatedAt;

    // Check if this is a lazy-loaded tool that needs downloading
    if (wasmBinary.byteLength === 0) {
      const config = this.getBuiltinConfig(tool.manifest.name);
      if (!config?.wasmUrl) {
        throw new Error(`Tool "${tool.manifest.name}" has no binary and no download URL`);
      }

      wasmBinary = await this.loader.downloadLazyBinary(
        config.wasmUrl,
        tool.manifest.name
      );
      updatedAt = Date.now();
    }

    const updated: StoredWasmTool = {
      ...tool,
      wasmBinary,
      updatedAt,
      enabled: true,
    };
    await storageManager.saveWasmTool(updated);
    this.tools.set(updated.manifest.name, updated);
  }

  /**
   * Check if a tool's binary has been downloaded.
   * Returns false for lazy-loaded tools whose binary is still empty.
   */
  isToolDownloaded(tool: StoredWasmTool): boolean {
    return tool.wasmBinary.byteLength > 0;
  }

  /**
   * Look up the BuiltinToolConfig for a tool by name.
   */
  private getBuiltinConfig(toolName: string): BuiltinToolConfig | undefined {
    return BUILTIN_TOOLS.find(c => c.name === toolName);
  }

  /**
   * Disable a tool.
   */
  async disableTool(id: string): Promise<void> {
    await storageManager.setWasmToolEnabled(id, false);

    // Update in-memory cache
    const tool = await storageManager.getWasmTool(id);
    if (tool) {
      this.tools.set(tool.manifest.name, tool);
    }
  }

  /**
   * Get all installed tools.
   */
  async getAllTools(): Promise<StoredWasmTool[]> {
    return Array.from(this.tools.values());
  }

  /**
   * Get all enabled tools.
   */
  async getEnabledTools(): Promise<StoredWasmTool[]> {
    return Array.from(this.tools.values()).filter(t => t.enabled);
  }

  /**
   * Convert all enabled WASM tools to Vercel AI SDK format.
   */
  getAITools(): Record<string, Tool> {
    const aiTools: Record<string, Tool> = {};

    for (const [, storedTool] of this.tools) {
      if (!storedTool.enabled) continue;

      const toolName = getWasmToolName(storedTool.manifest);
      aiTools[toolName] = this.createAITool(storedTool);
    }

    return aiTools;
  }

  /**
   * Create a Vercel AI SDK tool from a stored WASM tool.
   *
   * Full stdout is cached in toolResultCache for direct UI display.
   * Only a summary and short preview are returned to the LLM to avoid
   * the model echoing back large tool output in a slow stream.
   */
  private createAITool(storedTool: StoredWasmTool): Tool {
    const manifest = storedTool.manifest;
    const zodSchema = this.manifestToZod(manifest.parameters);
    const toolName = storedTool.manifest.name;
    const toolDisplayName = getWasmToolName(manifest);

    return tool({
      description: manifest.description,
      inputSchema: zodSchema,
      execute: async (input: Record<string, unknown>) => {
        const result = await this.executeTool(toolName, input);

        // If the tool produced binary output, base64-encode it for the AI
        // and store the raw bytes in the cache for the UI to retrieve.
        if (result.stdoutBinary && result.stdoutBinary.length > 0) {
          const binarySize = result.stdoutBinary.length;
          // Convert to base64 for the AI
          let base64 = '';
          const chunk = 8192;
          for (let i = 0; i < result.stdoutBinary.length; i += chunk) {
            base64 += String.fromCharCode(
              ...result.stdoutBinary.subarray(i, i + chunk)
            );
          }
          base64 = btoa(base64);

          const summary = `${toolDisplayName}: ${result.success ? 'success' : 'failed'}, ${binarySize} bytes binary output`;

          const resultId = toolResultCache.store(
            toolDisplayName,
            `[Binary output: ${binarySize} bytes, base64-encoded]\n${base64}`,
            { lineCount: 1, byteSize: binarySize }
          );

          return {
            success: result.success,
            resultId,
            summary,
            lineCount: 1,
            byteSize: binarySize,
            isBinary: true,
            preview: `[Binary data: ${binarySize} bytes]`,
            exitCode: result.exitCode,
            stderr: result.stderr || undefined,
            error: result.error || undefined,
          };
        }

        const stdout = result.stdout?.trim() ? result.stdout : '';
        const lines = stdout ? stdout.split('\n') : [];
        const lineCount = lines.length;
        const byteSize = stdout ? new TextEncoder().encode(stdout).length : 0;

        const summaryBase = `${toolDisplayName}: ${result.success ? 'success' : 'failed'}`;
        const summary = lineCount > 0
          ? `${summaryBase}, ${lineCount} lines output`
          : `${summaryBase}, no output`;

        // Always cache stdout for UI display. The LLM only receives
        // a summary and preview to prevent it from echoing back the
        // full output in a slow streaming response.
        let resultId: string | undefined;
        let preview: string | undefined;

        if (stdout) {
          resultId = toolResultCache.store(toolDisplayName, stdout, {
            lineCount,
            byteSize,
          });

          const PREVIEW_LINES = 5;
          preview = lines.slice(0, PREVIEW_LINES).map(line =>
            line.length > 100 ? line.substring(0, 100) + '...' : line
          ).join('\n');
        }

        return {
          success: result.success,
          resultId,
          summary,
          lineCount,
          byteSize,
          preview,
          exitCode: result.exitCode,
          stderr: result.stderr || undefined,
          error: result.error || undefined,
        };
      },
    });
  }

  /**
   * Execute a tool by name. Public method for testing and direct invocation.
   */
  async executeTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<ToolExecutionResult> {
    const storedTool = this.tools.get(toolName);
    if (!storedTool) {
      return {
        success: false,
        stdout: '',
        stderr: '',
        exitCode: 1,
        error: `Tool not found: ${toolName}`,
      };
    }

    return this.executeToolInternal(storedTool, args);
  }

  /**
   * Internal tool execution.
   *
   * For tools with an adapter (e.g., ImageMagick, FFmpeg), routes execution
   * to the adapter module. For standard WASI tools, uses Worker-based execution
   * by default with main-thread fallback.
   */
  private async executeToolInternal(
    storedTool: StoredWasmTool,
    args: Record<string, unknown>
  ): Promise<ToolExecutionResult> {
    const { manifest } = storedTool;
    const toolDisplayName = getWasmToolName(manifest);

    // 1. Check permissions
    const allowed = await checkWasmPermission(toolDisplayName, args);
    if (!allowed) {
      return {
        success: false,
        stdout: '',
        stderr: '',
        exitCode: 1,
        error: 'Permission denied',
      };
    }

    // 2. Check for adapter-based execution (non-WASI tools like FFmpeg, ImageMagick)
    const adapterImporter = TOOL_ADAPTERS[manifest.name];
    if (adapterImporter) {
      return this.executeWithAdapter(storedTool, args, adapterImporter);
    }

    // 3. Convert args based on argStyle.
    // This may throw (e.g. invalid base64 in a binary parameter), so we
    // catch and return a structured error rather than an unhandled exception.
    let cliArgs: string[];
    let stdin: string | undefined;
    let stdinBinary: Uint8Array | undefined;
    try {
      ({ cliArgs, stdin, stdinBinary } = this.convertArgsToCliFormat(manifest, args));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        stdout: '',
        stderr: message,
        exitCode: 1,
        error: message,
      };
    }

    // 4. Determine execution mode
    // Worker mode currently only supports stdin/stdout tools (no file access)
    // Tools requiring file access must run on the main thread until
    // Worker file support is implemented
    const fileAccess = manifest.execution?.fileAccess ?? 'none';
    const canUseWorker = this.useWorker &&
                         wasmWorkerManager.supported &&
                         fileAccess === 'none';

    if (canUseWorker) {
      return this.executeInWorker(storedTool, cliArgs, stdin, stdinBinary);
    } else {
      return this.executeOnMainThread(storedTool, cliArgs, stdin, stdinBinary);
    }
  }

  /**
   * Execute a tool through its adapter module.
   * Used for non-WASI tools (ImageMagick, FFmpeg) that use library-specific APIs.
   *
   * Supports `inputPath` and `outputPath` parameters so the AI can reference
   * files by path instead of passing large base64 data through the conversation
   * context.  When `inputPath` is provided the file is read from the project
   * directory and delivered to the adapter as `_stdinBinary`.  When `outputPath`
   * is provided the adapter's binary output is written directly to disk and a
   * short success message is returned instead of the raw binary.
   */
  private async executeWithAdapter(
    storedTool: StoredWasmTool,
    args: Record<string, unknown>,
    adapterImporter: () => Promise<{ execute: (wasmBinary: ArrayBuffer, args: Record<string, unknown>) => Promise<ToolExecutionResult> }>
  ): Promise<ToolExecutionResult> {
    try {
      const adapterArgs: Record<string, unknown> = { ...args };

      // --- inputPath: read the file from disk so the AI doesn't need to ---
      // --- pass base64 data through the conversation context            ---
      const inputPath = typeof adapterArgs.inputPath === 'string'
        ? (adapterArgs.inputPath as string).trim()
        : undefined;

      if (inputPath) {
        try {
          const buffer = await fileSystemManager.readFileBinary(inputPath);
          adapterArgs._stdinBinary = new Uint8Array(buffer);
        } catch (error) {
          const msg = `Failed to read input file "${inputPath}": ${(error as Error).message}`;
          return { success: false, stdout: '', stderr: msg, exitCode: 1, error: msg };
        }
        // Remove inputPath so it doesn't confuse the adapter
        delete adapterArgs.inputPath;

        // For FFmpeg: derive inputFilename from inputPath when not explicitly provided
        if (!adapterArgs.inputFilename && inputPath.includes('/')) {
          adapterArgs.inputFilename = inputPath.split('/').pop();
        } else if (!adapterArgs.inputFilename) {
          adapterArgs.inputFilename = inputPath;
        }
      }

      // Fallback: decode inline base64 binary param if no inputPath was used
      if (!adapterArgs._stdinBinary) {
        const binaryParamName = findBinaryParam(storedTool.manifest);
        if (binaryParamName && typeof adapterArgs[binaryParamName] === 'string') {
          try {
            adapterArgs._stdinBinary = base64ToUint8Array(adapterArgs[binaryParamName] as string);
          } catch {
            return {
              success: false,
              stdout: '',
              stderr: 'Invalid base64 input data',
              exitCode: 1,
              error: 'Invalid base64 input data',
            };
          }
        }
      }

      // --- outputPath: extract the target path before executing ---
      const outputPath = typeof args.outputPath === 'string'
        ? (args.outputPath as string).trim()
        : undefined;
      // Remove outputPath so it doesn't confuse the adapter
      delete adapterArgs.outputPath;

      // For FFmpeg: derive outputFilename from outputPath when not explicitly provided
      if (outputPath && !adapterArgs.outputFilename) {
        const filename = outputPath.includes('/')
          ? outputPath.split('/').pop()
          : outputPath;
        adapterArgs.outputFilename = filename;
      }

      const adapter = await adapterImporter();
      const result = await adapter.execute(storedTool.wasmBinary, adapterArgs);

      // --- outputPath: write binary output directly to disk ---
      if (outputPath && result.success && result.stdoutBinary && result.stdoutBinary.length > 0) {
        try {
          if (!fileSystemManager.exists(outputPath)) {
            await fileSystemManager.createFile(outputPath, '');
          }
          await fileSystemManager.writeFile(outputPath, result.stdoutBinary);

          const outputSize = result.stdoutBinary.length;
          const inputSize = adapterArgs._stdinBinary instanceof Uint8Array
            ? adapterArgs._stdinBinary.length
            : undefined;
          const sizeInfo = inputSize
            ? `${formatBytes(inputSize)} → ${formatBytes(outputSize)}`
            : formatBytes(outputSize);

          return {
            success: true,
            stdout: `Output written to ${outputPath} (${sizeInfo})`,
            stderr: result.stderr,
            exitCode: 0,
            // No stdoutBinary — data was written to file, not returned
          };
        } catch (error) {
          const msg = `Failed to write output file "${outputPath}": ${(error as Error).message}`;
          return { success: false, stdout: '', stderr: msg, exitCode: 1, error: msg };
        }
      }

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        stdout: '',
        stderr: message,
        exitCode: 1,
        error: message,
      };
    }
  }

  /**
   * Execute WASM in an isolated Web Worker (recommended).
   *
   * Benefits:
   * - UI remains responsive during long-running operations
   * - True termination via Worker.terminate()
   * - Memory isolation from main thread
   * - Network access blocked (no fetch/XHR in WASI imports)
   */
  private async executeInWorker(
    storedTool: StoredWasmTool,
    cliArgs: string[],
    stdin?: string,
    stdinBinary?: Uint8Array
  ): Promise<ToolExecutionResult> {
    const { manifest } = storedTool;

    try {
      // Pre-load files if the tool needs file access
      // TODO: Implement file pre-loading for tools that need it
      // For now, we only support stdin/stdout tools in Worker mode
      const files: Record<string, string> = {};

      // Execute in Worker
      const result = await wasmWorkerManager.execute(
        storedTool.wasmBinary.slice(0), // Copy buffer (will be transferred)
        cliArgs,
        {
          timeout: manifest.execution.timeout ?? 30000,
          memoryPages: manifest.execution.memoryLimit,
          stdin,
          stdinBinary: stdinBinary
            ? stdinBinary.buffer.slice(
                stdinBinary.byteOffset,
                stdinBinary.byteOffset + stdinBinary.byteLength
              ) as ArrayBuffer
            : undefined,
          files,
        }
      );

      return {
        success: result.exitCode === 0,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        stdoutBinary: result.stdoutBinary,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        stdout: '',
        stderr: errorMessage,
        exitCode: 1,
        error: errorMessage,
      };
    }
  }

  /**
   * Execute WASM on the main thread (fallback).
   *
   * WARNING: This can block the UI for long-running operations.
   * Only used when Workers are not supported.
   */
  private async executeOnMainThread(
    storedTool: StoredWasmTool,
    cliArgs: string[],
    stdin?: string,
    stdinBinary?: Uint8Array
  ): Promise<ToolExecutionResult> {
    const { manifest } = storedTool;

    // Set up VFS with file system access
    const hasDirectoryAccess = fileSystemManager.getRootHandle() !== null;
    const vfs = new VirtualFileSystem(
      hasDirectoryAccess ? fileSystemManager : null,
      manifest.execution.fileAccess
    );

    // Set stdin: binary takes precedence over text
    if (stdinBinary) {
      vfs.setStdin(stdinBinary);
    } else if (stdin) {
      vfs.setStdin(stdin);
    }

    try {
      const result = await this.runtime.execute(
        storedTool.wasmBinary,
        cliArgs,
        {
          timeout: manifest.execution.timeout ?? 30000,
          memoryLimit: manifest.execution.memoryLimit,
          fileAccess: manifest.execution.fileAccess,
        },
        vfs
      );

      return {
        success: result.exitCode === 0,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        stdoutBinary: result.stdoutBinary,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        stdout: '',
        stderr: errorMessage,
        exitCode: 1,
        error: errorMessage,
      };
    }
  }

  /**
   * Convert arguments to CLI format based on the manifest's argStyle.
   * Delegates to the standalone `convertArgsToCliFormat` function.
   */
  private convertArgsToCliFormat(
    manifest: WasmToolManifest,
    args: Record<string, unknown>
  ): { cliArgs: string[]; stdin?: string; stdinBinary?: Uint8Array } {
    return convertArgsToCliFormat(manifest, args);
  }

  /**
   * Convert a JSON schema-like manifest definition into a Zod schema.
   */
  private manifestToZod(params: WasmToolManifest['parameters']): z.ZodObject<z.ZodRawShape> {
    const shape: Record<string, z.ZodTypeAny> = {};

    const properties = params.properties ?? {};
    const required: string[] = params.required ?? [];

    for (const [name, prop] of Object.entries(properties)) {
      let fieldSchema: z.ZodTypeAny;

      switch (prop.type) {
        case 'string': {
          if (Array.isArray(prop.enum) && prop.enum.length > 0) {
            const stringEnum = prop.enum as [string, ...string[]];
            fieldSchema = z.enum(stringEnum);
          } else {
            fieldSchema = z.string();
          }
          break;
        }
        case 'number': {
          fieldSchema = z.number();
          break;
        }
        case 'boolean': {
          fieldSchema = z.boolean();
          break;
        }
        case 'array': {
          const items = prop.items ?? { type: 'string' };
          let itemSchema: z.ZodTypeAny;

          switch (items.type) {
            case 'string':
              itemSchema = z.string();
              break;
            case 'number':
              itemSchema = z.number();
              break;
            case 'boolean':
              itemSchema = z.boolean();
              break;
            default:
              itemSchema = z.any();
          }
          fieldSchema = z.array(itemSchema);
          break;
        }
        case 'binary': {
          // Binary data is passed as a base64-encoded string by the AI
          fieldSchema = z.string();
          break;
        }
        default: {
          fieldSchema = z.any();
        }
      }

      // Apply default if provided
      if (prop.default !== undefined) {
        fieldSchema = fieldSchema.default(prop.default);
      }

      // Add description for AI SDK
      if (prop.description) {
        fieldSchema = fieldSchema.describe(prop.description);
      }

      // Handle optional vs required
      if (!required.includes(name)) {
        fieldSchema = fieldSchema.optional();
      }

      shape[name] = fieldSchema;
    }

    return z.object(shape);
  }

  /**
   * Load built-in tools into IndexedDB if they don't exist, and update
   * existing built-in tools whose manifests have changed (e.g. after a
   * release that adds stdinParam, changes argStyle, etc.).
   */
  async loadBuiltinTools(): Promise<number> {
    const builtinConfigs = this.loader.getBuiltinToolConfigs();
    let loadedCount = 0;

    for (const config of builtinConfigs) {
      const existing = await storageManager.getWasmToolByName(config.manifest.name);

      if (existing && existing.source === 'builtin') {
        // Sync manifest with registry so stale IndexedDB entries
        // pick up new fields (stdinParam, argStyle, etc.).
        if (stableStringify(existing.manifest) !== stableStringify(config.manifest)) {
          try {
            // For lazy-loaded tools that already have a downloaded binary,
            // preserve it and only update the manifest. This intentionally
            // keeps the binary even if the tool is currently disabled, so the
            // user doesn't have to re-download when they re-enable. Users can
            // clear IndexedDB manually if they want to reclaim storage.
            const isLazy = config.enabledByDefault === false;
            const hasDownloadedBinary = existing.wasmBinary.byteLength > 0;

            if (isLazy && hasDownloadedBinary) {
              const updated: StoredWasmTool = {
                ...existing,
                manifest: config.manifest,
                updatedAt: Date.now(),
              };
              await storageManager.saveWasmTool(updated);
              this.tools.set(updated.manifest.name, updated);
            } else {
              const reloaded = await this.loader.loadBuiltinTool(config);
              const updated: StoredWasmTool = {
                ...existing,
                manifest: reloaded.manifest,
                wasmBinary: reloaded.wasmBinary,
                updatedAt: Date.now(),
              };
              await storageManager.saveWasmTool(updated);
              this.tools.set(updated.manifest.name, updated);
            }
            loadedCount++;
            console.log(`Updated built-in tool manifest: ${config.name}`);
          } catch (error) {
            console.warn(`Failed to refresh built-in tool ${config.name}:`, error);
          }
        }
        continue;
      }

      if (existing) continue; // user-installed tool with same name, don't overwrite

      try {
        const tool = await this.loader.loadBuiltinTool(config);
        await storageManager.saveWasmTool(tool);
        this.tools.set(tool.manifest.name, tool);
        loadedCount++;
      } catch (error) {
        console.warn(`Failed to load built-in tool ${config.name}:`, error);
      }
    }

    return loadedCount;
  }

  /**
   * Register all enabled WASM tools that have `pipeable: true` in their
   * manifest into the pipeable command registry so they can participate
   * in pipe chains.
   *
   * When used in a pipe, stdin from the previous command is injected as
   * the `input` parameter (the first text-typed required parameter found
   * in the manifest). All other parameters can be passed via `args`.
   */
  registerPipeableTools(): number {
    let count = 0;

    for (const [, storedTool] of this.tools) {
      if (!storedTool.enabled) continue;
      if (!storedTool.manifest.pipeable) continue;

      const manifest = storedTool.manifest;
      const toolName = manifest.name;

      // Find the primary text input parameter name.
      // This is the parameter that stdin will be injected into.
      const inputParamName = this.findInputParam(manifest);

      // Build a human-readable args description excluding the stdin param
      const argsDesc = this.buildArgsDescription(manifest, inputParamName);

      const manager = this;

      registerPipeable(toolName, {
        description: manifest.description,
        argsDescription: argsDesc,
        // WASM tools use their own permission system (checkWasmPermission)
        // which is enforced inside executeTool(). Use 'pipe' here so the
        // pipe pre-validation passes; actual WASM permission is checked
        // at execution time.
        permissionName: 'pipe',
        execute: async (args, stdin) => {
          // Inject stdin as the input parameter when not explicitly provided
          const mergedArgs = { ...args };
          if (inputParamName && stdin !== undefined && mergedArgs[inputParamName] === undefined) {
            mergedArgs[inputParamName] = stdin;
          }

          const result = await manager.executeTool(toolName, mergedArgs);

          if (!result.success) {
            return {
              success: false,
              error: result.error || result.stderr || `${toolName} failed (exit ${result.exitCode})`,
            };
          }

          return {
            success: true,
            output: result.stdout,
          };
        },
      });

      count++;
    }

    if (count > 0) {
      console.log(`Registered ${count} WASM tools as pipeable commands`);
    }

    return count;
  }

  /**
   * Find the first string-typed parameter that serves as the primary
   * text input for a pipeable tool. Checks `required` list first,
   * then falls back to well-known names like "input" or "text".
   */
  private findInputParam(manifest: WasmToolManifest): string | null {
    const props = manifest.parameters.properties;
    const required = manifest.parameters.required ?? [];

    // Prefer the first required string param named "input" or "text"
    for (const name of required) {
      const prop = props[name];
      if (prop?.type === 'string' && (name === 'input' || name === 'text')) {
        return name;
      }
    }

    // Fall back to any required string param
    for (const name of required) {
      const prop = props[name];
      if (prop?.type === 'string') {
        return name;
      }
    }

    // Fall back to a well-known name in optional params
    for (const name of ['input', 'text']) {
      if (props[name]?.type === 'string') {
        return name;
      }
    }

    return null;
  }

  /**
   * Build a human-readable args description for the pipe tool help text.
   * Excludes the stdin input param since that is injected automatically.
   */
  private buildArgsDescription(manifest: WasmToolManifest, inputParam: string | null): string {
    const parts: string[] = [];
    const props = manifest.parameters.properties;
    const required = new Set(manifest.parameters.required ?? []);

    for (const [name, prop] of Object.entries(props)) {
      if (name === inputParam) continue; // stdin handles this
      const req = required.has(name) ? '' : '?';
      const enumStr = prop.enum ? ` (${prop.enum.join('|')})` : '';
      parts.push(`${name}${req}: ${prop.type}${enumStr}`);
    }

    if (parts.length === 0) {
      return '(stdin only)';
    }

    return `{ ${parts.join(', ')} }`;
  }
}

/**
 * Find the single parameter with type 'binary' in a manifest.
 *
 * Only one binary parameter is supported because binary data is delivered
 * via stdin. If multiple binary parameters are defined, this function throws
 * to avoid silently ignoring additional binary parameters.
 */
export function findBinaryParam(manifest: WasmToolManifest): string | null {
  const binaryParams: string[] = [];

  for (const [name, prop] of Object.entries(manifest.parameters.properties)) {
    if (prop.type === 'binary') {
      binaryParams.push(name);
    }
  }

  if (binaryParams.length === 0) {
    return null;
  }

  if (binaryParams.length > 1) {
    throw new Error(
      `WASM tool manifest "${manifest.name}" defines multiple binary parameters ` +
      `(${binaryParams.join(', ')}). Only a single binary parameter is supported ` +
      `because binary data is delivered via stdin.`
    );
  }

  return binaryParams[0] ?? null;
}

/**
 * Convert tool arguments to CLI format based on the manifest's argStyle.
 *
 * Exported separately so it can be unit-tested without instantiating
 * the full WasmToolManager.
 *
 * Binary parameters (type: 'binary') are expected to be base64-encoded
 * strings from the AI. They are decoded to Uint8Array and delivered
 * as binary stdin to the WASM module.
 *
 * @param manifest - The tool manifest describing parameter layout
 * @param args     - Key/value arguments from the AI SDK
 * @returns Object with `cliArgs` (argv array), optional `stdin` string,
 *          and optional `stdinBinary` Uint8Array
 */
export function convertArgsToCliFormat(
  manifest: WasmToolManifest,
  args: Record<string, unknown>
): { cliArgs: string[]; stdin?: string; stdinBinary?: Uint8Array } {
  const { argStyle, stdinParam } = manifest.execution;

  // Extract the stdin parameter value if configured.
  // This parameter is sent via stdin instead of being placed on argv,
  // which avoids issues with large text content in CLI arguments and
  // matches how many UNIX tools expect their input.
  let stdin: string | undefined;
  const filteredArgs = { ...args };
  if (stdinParam && filteredArgs[stdinParam] !== undefined) {
    stdin = String(filteredArgs[stdinParam]);
    delete filteredArgs[stdinParam];
  }

  // Check for binary parameters - if the tool has a 'binary' type param,
  // decode the base64 value and pass it as binary stdin
  let stdinBinary: Uint8Array | undefined;
  const binaryParamName = findBinaryParam(manifest);
  if (binaryParamName && typeof filteredArgs[binaryParamName] === 'string') {
    const base64 = filteredArgs[binaryParamName] as string;
    delete filteredArgs[binaryParamName];
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    stdinBinary = bytes;
  }

  switch (argStyle) {
    case 'cli': {
      // Convert to --key value pairs
      const result: string[] = [manifest.name];
      for (const [key, value] of Object.entries(filteredArgs)) {
        if (value === undefined || value === null) continue;

        if (typeof value === 'boolean') {
          if (value) {
            result.push(`--${key}`);
          }
        } else {
          result.push(`--${key}`, String(value));
        }
      }
      return { cliArgs: result, stdin, stdinBinary };
    }

    case 'positional': {
      // Use required fields order, then remaining properties
      const result: string[] = [manifest.name];
      const required = manifest.parameters.required ?? [];
      const seen = new Set<string>();

      // Add required args in order (stdinParam and binaryParam already extracted)
      for (const key of required) {
        if (key === stdinParam) { seen.add(key); continue; }
        if (filteredArgs[key] !== undefined) {
          result.push(String(filteredArgs[key]));
          seen.add(key);
        }
      }

      // Add remaining args in property order
      for (const key of Object.keys(manifest.parameters.properties)) {
        if (key === stdinParam) continue;
        if (!seen.has(key) && filteredArgs[key] !== undefined) {
          result.push(String(filteredArgs[key]));
        }
      }

      return { cliArgs: result, stdin, stdinBinary };
    }

    case 'json': {
      // Args passed via stdin as JSON.
      // filteredArgs already has stdinParam and binaryParam removed.
      // If text stdin was extracted via stdinParam, the remaining args
      // are serialized as JSON and passed as the first CLI argument so
      // the tool still receives them.
      if (stdin) {
        const remainingJson = JSON.stringify(filteredArgs);
        return {
          cliArgs: [manifest.name, remainingJson],
          stdin,
          stdinBinary,
        };
      }
      return {
        cliArgs: [manifest.name],
        stdin: JSON.stringify(filteredArgs),
        stdinBinary,
      };
    }

    default:
      throw new Error(`Unknown argStyle: ${argStyle}`);
  }
}

// Export singleton instance
export const wasmToolManager = new WasmToolManager();
