/**
 * Pipeable Command Registry
 *
 * Provides a self-registration pattern for tools that can be chained
 * together via the pipe tool. Any module can register pipeable commands
 * by calling registerPipeable() — the pipe tool discovers them
 * automatically at runtime.
 *
 * When adding a new pipeable command:
 *   1. Import { registerPipeable } from './pipeable'
 *   2. Call registerPipeable('name', { execute, permissionName, description, argsDescription })
 *   3. That's it — the pipe tool picks it up automatically
 */

import type { ToolName } from './preferences';

/**
 * Result from a pipeable command execution.
 * All pipeable commands produce plain string output (or an error).
 */
export interface PipeableResult {
  success: boolean;
  output?: string;
  error?: string;
}

/**
 * A command that can participate in a pipe chain.
 */
export interface PipeableCommand {
  /** Execute the command with arguments and optional stdin from the previous command */
  execute: (args: Record<string, unknown>, stdin?: string) => Promise<PipeableResult>;
  /** The ToolName used for permission checks */
  permissionName: ToolName;
  /** Short description shown in the pipe tool's help text */
  description: string;
  /** Argument schema description shown in the pipe tool's help text */
  argsDescription: string;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const registry = new Map<string, PipeableCommand>();

/**
 * Register a command as pipeable. Call this at module evaluation time
 * so the command is available before the pipe tool's description is built.
 */
export function registerPipeable(name: string, command: PipeableCommand): void {
  registry.set(name, command);
}

/**
 * Look up a pipeable command by name.
 */
export function getPipeable(name: string): PipeableCommand | undefined {
  return registry.get(name);
}

/**
 * Get all registered pipeable command names.
 */
export function getPipeableNames(): string[] {
  return Array.from(registry.keys());
}

/**
 * Iterate over all registered pipeable commands.
 */
export function getAllPipeables(): ReadonlyMap<string, PipeableCommand> {
  return registry;
}

/**
 * Auto-generate the pipe tool's description from the registry.
 * Call this after all commands have been registered.
 */
export function buildPipeDescription(): string {
  const lines = [
    'Chain multiple commands together like Unix pipes. Output of each command becomes input to the next. Only the final output is returned, reducing context usage.',
    '',
    'Available commands:',
  ];

  for (const [name, cmd] of registry) {
    lines.push(`- ${name}: ${cmd.description}. Args: ${cmd.argsDescription}`);
  }

  lines.push('');
  lines.push('Example: Read file, filter imports, sort:');
  lines.push(
    '{ commands: [{ tool: "cat", args: { path: "src/main.ts" } }, { tool: "grep", args: { pattern: "^import" } }, { tool: "sort", args: {} }] }'
  );

  return lines.join('\n');
}
