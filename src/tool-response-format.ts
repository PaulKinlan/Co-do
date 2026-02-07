/**
 * Tool Response Formatting Utilities
 *
 * Pure functions for formatting and generating tool response content.
 * Extracted from UIManager for testability.
 */

import { escapeHtml } from './escape-html.js';
export { escapeHtml };

/**
 * Format a tool result summary for display
 */
export function formatToolResultSummary(result: Record<string, unknown>): string {
  const lines: string[] = [];

  if (result.success) {
    lines.push('Status: Success');
  } else if (result.error) {
    lines.push(`Error: ${result.error}`);
    return lines.join('\n');
  }

  if (result.path) {
    lines.push(`Path: ${result.path}`);
  }

  if (result.summary) {
    lines.push(`Summary: ${result.summary}`);
  }

  if (result.lineCount !== undefined) {
    lines.push(`Lines: ${result.lineCount}`);
  }

  if (result.byteSize !== undefined) {
    const bytes = result.byteSize as number;
    const formatted =
      bytes < 1024
        ? `${bytes} bytes`
        : bytes < 1024 * 1024
          ? `${(bytes / 1024).toFixed(1)} KB`
          : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    lines.push(`Size: ${formatted}`);
  }

  if (result.fileType) {
    lines.push(`Type: ${result.fileType}`);
  }

  if (result.preview) {
    lines.push('');
    lines.push('Preview:');
    lines.push(result.preview as string);
  }

  return lines.join('\n');
}

/**
 * Generate the HTML for a tool call item
 */
export function generateToolCallHtml(toolName: string, args: unknown): string {
  let argsStr: string;
  try {
    argsStr = JSON.stringify(args, null, 2);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    argsStr = `[Unable to display arguments: ${message}]`;
  }
  const truncatedArgs = argsStr.length > 500 ? argsStr.substring(0, 500) + '...' : argsStr;

  return `
    <div class="tool-item-header">
      <span class="tool-item-icon">🔧</span>
      <span class="tool-item-name">${escapeHtml(toolName)}</span>
      <span class="tool-item-status pending">calling...</span>
    </div>
    <details class="tool-item-details">
      <summary>Arguments</summary>
      <pre class="tool-item-args">${escapeHtml(truncatedArgs)}</pre>
    </details>
  `;
}

/**
 * Serialize a tool result to a display string
 */
export function serializeToolResult(result: unknown): string {
  try {
    return JSON.stringify(result, null, 2);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return 'Error stringifying tool result: ' + errorMessage + '\nRaw result (toString): ' + String(result);
  }
}

/**
 * Generate the HTML for a tool result (non-cached)
 */
export function generateToolResultHtml(result: unknown): string {
  const resultStr = serializeToolResult(result);

  return `
    <details class="tool-item-details tool-result-details">
      <summary>Result</summary>
      <pre class="tool-item-result">${escapeHtml(resultStr)}</pre>
    </details>
  `;
}

/**
 * Format byte size into human-readable string
 */
export function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
