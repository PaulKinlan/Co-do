/**
 * WASM Tool Manager
 *
 * This is the central orchestrator for WASM custom tools. It handles:
 * - Loading and storing tools
 * - Converting tools to Vercel AI SDK format
 * - Executing tools with proper I/O handling
 * - Permission management
 */

import { tool, type Tool } from 'ai';
import { z } from 'zod';
import { storageManager } from '../storage';
import { fileSystemManager } from '../fileSystem';
import { WasmRuntime } from './runtime';
import { VirtualFileSystem } from './vfs';
import { WasmToolLoader } from './loader';
import { getWasmToolName } from './registry';
import type {
  StoredWasmTool,
  WasmToolManifest,
  ToolExecutionResult,
} from './types';

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
 */
export class WasmToolManager {
  private tools: Map<string, StoredWasmTool> = new Map();
  private runtime: WasmRuntime = new WasmRuntime();
  private loader: WasmToolLoader = new WasmToolLoader();
  private initialized: boolean = false;

  /**
   * Initialize the tool manager.
   * Loads all tools from IndexedDB.
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      // Load all tools from storage
      const storedTools = await storageManager.getAllWasmTools();

      for (const tool of storedTools) {
        this.tools.set(tool.manifest.name, tool);
      }

      this.initialized = true;
      console.log(`WasmToolManager initialized with ${this.tools.size} tools`);
    } catch (error) {
      console.error('Failed to initialize WasmToolManager:', error);
      throw error;
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
   * Enable a tool.
   */
  async enableTool(id: string): Promise<void> {
    await storageManager.setWasmToolEnabled(id, true);

    // Update in-memory cache
    const tool = await storageManager.getWasmTool(id);
    if (tool) {
      this.tools.set(tool.manifest.name, tool);
    }
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
   */
  private createAITool(storedTool: StoredWasmTool): Tool {
    const manifest = storedTool.manifest;
    const zodSchema = this.manifestToZod(manifest.parameters);
    const toolName = storedTool.manifest.name;

    return tool({
      description: manifest.description,
      inputSchema: zodSchema,
      execute: async (input: Record<string, unknown>) => {
        return this.executeTool(toolName, input);
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

    // 2. Set up VFS with file system access
    const hasDirectoryAccess = fileSystemManager.getRootHandle() !== null;
    const vfs = new VirtualFileSystem(
      hasDirectoryAccess ? fileSystemManager : null,
      manifest.execution.fileAccess
    );

    // 3. Convert args based on argStyle
    const { cliArgs, stdin } = this.convertArgsToCliFormat(manifest, args);

    // 4. Set stdin if using json argStyle
    if (stdin) {
      vfs.setStdin(stdin);
    }

    try {
      // 5. Run WASM
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

      // 6. Return result
      return {
        success: result.exitCode === 0,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
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
   */
  private convertArgsToCliFormat(
    manifest: WasmToolManifest,
    args: Record<string, unknown>
  ): { cliArgs: string[]; stdin?: string } {
    const { argStyle } = manifest.execution;

    switch (argStyle) {
      case 'cli': {
        // Convert to --key value pairs
        const result: string[] = [manifest.name];
        for (const [key, value] of Object.entries(args)) {
          if (value === undefined || value === null) continue;

          if (typeof value === 'boolean') {
            if (value) {
              result.push(`--${key}`);
            }
          } else {
            result.push(`--${key}`, String(value));
          }
        }
        return { cliArgs: result };
      }

      case 'positional': {
        // Use required fields order, then remaining properties
        const result: string[] = [manifest.name];
        const required = manifest.parameters.required ?? [];
        const seen = new Set<string>();

        // Add required args in order
        for (const key of required) {
          if (args[key] !== undefined) {
            result.push(String(args[key]));
            seen.add(key);
          }
        }

        // Add remaining args in property order
        for (const key of Object.keys(manifest.parameters.properties)) {
          if (!seen.has(key) && args[key] !== undefined) {
            result.push(String(args[key]));
          }
        }

        return { cliArgs: result };
      }

      case 'json': {
        // Args passed via stdin as JSON
        return {
          cliArgs: [manifest.name],
          stdin: JSON.stringify(args),
        };
      }

      default:
        throw new Error(`Unknown argStyle: ${argStyle}`);
    }
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
   * Load built-in tools into IndexedDB if they don't exist.
   */
  async loadBuiltinTools(): Promise<number> {
    const builtinConfigs = this.loader.getBuiltinToolConfigs();
    let loadedCount = 0;

    for (const config of builtinConfigs) {
      // Check if already installed
      const existing = await storageManager.getWasmToolByName(config.manifest.name);
      if (existing) continue;

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
}

// Export singleton instance
export const wasmToolManager = new WasmToolManager();
