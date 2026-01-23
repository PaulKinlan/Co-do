/**
 * WASM Custom Tools - Type Definitions
 *
 * This module defines all TypeScript interfaces and Zod schemas for
 * the WebAssembly custom tools system.
 */

import { z } from 'zod';

// =============================================================================
// Zod Schemas for Validation
// =============================================================================

/**
 * Schema for individual parameter definitions in tool manifests.
 */
export const ParameterDefinitionSchema = z.object({
  type: z.enum(['string', 'number', 'boolean', 'array']),
  description: z.string(),
  enum: z.array(z.string()).optional(),
  default: z.unknown().optional(),
  items: z.object({ type: z.string() }).optional(),
});

/**
 * Schema for the complete tool manifest.
 * Tool names must start with a letter and can contain lowercase letters,
 * numbers, hyphens, and underscores (but not end with separators).
 */
export const WasmToolManifestSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9]*(?:[_-][a-z0-9]+)*$/),
  version: z.string(),
  description: z.string(),
  parameters: z.object({
    type: z.literal('object'),
    properties: z.record(ParameterDefinitionSchema),
    required: z.array(z.string()).optional(),
  }),
  returns: z.object({
    type: z.enum(['string', 'object']),
    description: z.string(),
  }),
  execution: z.object({
    argStyle: z.enum(['cli', 'json', 'positional']),
    fileAccess: z.enum(['none', 'read', 'write', 'readwrite']),
    memoryLimit: z.number().optional(),
    timeout: z.number().optional(),
  }),
  category: z.string(),
  author: z.string().optional(),
  license: z.string().optional(),
  homepage: z.string().optional(),
});

// =============================================================================
// TypeScript Interfaces
// =============================================================================

/**
 * Definition for a single parameter in a tool manifest.
 */
export interface ParameterDefinition {
  type: 'string' | 'number' | 'boolean' | 'array';
  description: string;
  enum?: string[];
  default?: unknown;
  items?: { type: string };
}

/**
 * The manifest that describes a WASM tool's interface.
 * This is stored alongside the WASM binary in a ZIP package.
 */
export interface WasmToolManifest {
  // Identity
  name: string;
  version: string;
  description: string;

  // Schema for AI
  parameters: {
    type: 'object';
    properties: Record<string, ParameterDefinition>;
    required?: string[];
  };

  // Return type
  returns: {
    type: 'string' | 'object';
    description: string;
  };

  // Execution config
  execution: {
    argStyle: 'cli' | 'json' | 'positional';
    fileAccess: 'none' | 'read' | 'write' | 'readwrite';
    memoryLimit?: number;
    timeout?: number;
  };

  // Metadata
  category: string;
  author?: string;
  license?: string;
  homepage?: string;
}

/**
 * A WASM tool as stored in IndexedDB.
 */
export interface StoredWasmTool {
  id: string;
  manifest: WasmToolManifest;
  wasmBinary: ArrayBuffer;
  source: 'builtin' | 'user';
  enabled: boolean;
  installedAt: number;
  updatedAt: number;
}

/**
 * Configuration for a built-in tool in the registry.
 */
export interface BuiltinToolConfig {
  name: string;
  category: string;
  wasmUrl: string;
  manifest: WasmToolManifest;
}

/**
 * Options for WASM execution.
 */
export interface ExecutionOptions {
  timeout: number;
  memoryLimit?: number;
  fileAccess: 'none' | 'read' | 'write' | 'readwrite';
  stdin?: string;
}

/**
 * Result of WASM execution.
 */
export interface ExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * File statistics returned by the VFS.
 */
export interface FileStat {
  size: number;
  isFile: boolean;
  isDirectory: boolean;
  modifiedTime: number;
}

/**
 * Result returned to the AI from tool execution.
 */
export interface ToolExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  error?: string;
}
