/**
 * Tool Result Cache
 *
 * Stores full tool results separately from what gets sent to the LLM.
 * This reduces context bloat by allowing tools to return summaries to the LLM
 * while the UI can retrieve full content from this cache for display.
 */

export interface CachedResult {
  id: string;
  toolName: string;
  timestamp: number;
  fullContent: string;
  metadata: {
    path?: string;
    lineCount?: number;
    byteSize?: number;
    fileType?: string;
  };
}

/**
 * Generate a summary of file content for LLM context
 */
export function generateContentSummary(
  content: string,
  path: string,
  options: { previewLines?: number } = {}
): {
  summary: string;
  lineCount: number;
  byteSize: number;
  fileType: string;
  preview: string;
} {
  const previewLines = options.previewLines ?? 5;
  const lines = content.split('\n');
  const lineCount = lines.length;
  const byteSize = new TextEncoder().encode(content).length;

  // Detect file type from extension
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const fileTypeMap: Record<string, string> = {
    'js': 'JavaScript',
    'ts': 'TypeScript',
    'jsx': 'React JSX',
    'tsx': 'React TSX',
    'json': 'JSON',
    'html': 'HTML',
    'css': 'CSS',
    'md': 'Markdown',
    'txt': 'Plain text',
    'py': 'Python',
    'rb': 'Ruby',
    'go': 'Go',
    'rs': 'Rust',
    'java': 'Java',
    'c': 'C',
    'cpp': 'C++',
    'h': 'C Header',
    'hpp': 'C++ Header',
    'sh': 'Shell script',
    'yaml': 'YAML',
    'yml': 'YAML',
    'xml': 'XML',
    'svg': 'SVG',
    'sql': 'SQL',
  };
  const fileType = fileTypeMap[ext] || `${ext.toUpperCase() || 'Unknown'} file`;

  // Generate preview (first few lines, truncated if needed)
  const previewContent = lines.slice(0, previewLines).map(line => {
    if (line.length > 100) {
      return line.substring(0, 100) + '...';
    }
    return line;
  }).join('\n');

  // Format byte size for readability
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} bytes`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const summary = `${fileType}, ${lineCount} lines, ${formatSize(byteSize)}`;

  return {
    summary,
    lineCount,
    byteSize,
    fileType,
    preview: previewContent,
  };
}

class ToolResultCache {
  private cache: Map<string, CachedResult> = new Map();
  private resultCounter = 0;
  private readonly maxCacheSize = 100; // Limit cache size
  private readonly maxCacheAge = 30 * 60 * 1000; // 30 minutes

  /**
   * Store a result and return its ID
   */
  store(toolName: string, fullContent: string, metadata: CachedResult['metadata'] = {}): string {
    this.cleanup();

    const id = `result_${Date.now()}_${this.resultCounter++}`;

    this.cache.set(id, {
      id,
      toolName,
      timestamp: Date.now(),
      fullContent,
      metadata,
    });

    return id;
  }

  /**
   * Retrieve a cached result by ID
   */
  get(id: string): CachedResult | undefined {
    return this.cache.get(id);
  }

  /**
   * Get the full content for a result ID
   */
  getContent(id: string): string | undefined {
    return this.cache.get(id)?.fullContent;
  }

  /**
   * Check if a result exists in the cache
   */
  has(id: string): boolean {
    return this.cache.has(id);
  }

  /**
   * Remove old entries to prevent memory bloat
   */
  private cleanup(): void {
    const now = Date.now();

    // Remove old entries
    for (const [id, result] of this.cache.entries()) {
      if (now - result.timestamp > this.maxCacheAge) {
        this.cache.delete(id);
      }
    }

    // If still too many, remove oldest
    if (this.cache.size >= this.maxCacheSize) {
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);

      const toRemove = entries.slice(0, this.cache.size - this.maxCacheSize + 10);
      for (const [id] of toRemove) {
        this.cache.delete(id);
      }
    }
  }

  /**
   * Clear all cached results
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; oldestAge: number | null } {
    if (this.cache.size === 0) {
      return { size: 0, oldestAge: null };
    }

    const now = Date.now();
    let oldest = now;

    for (const result of this.cache.values()) {
      if (result.timestamp < oldest) {
        oldest = result.timestamp;
      }
    }

    return {
      size: this.cache.size,
      oldestAge: now - oldest,
    };
  }
}

// Export singleton instance
export const toolResultCache = new ToolResultCache();
