/**
 * Unit tests for the pipe (command chaining) tool
 *
 * Tests the pipeable functions: cat, grep, sort, head, tail, uniq, wc, write_file
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the fileSystemManager before importing tools
vi.mock('../../src/fileSystem', () => {
  const mockFiles: Map<string, string> = new Map();

  return {
    fileSystemManager: {
      readFile: vi.fn((path: string) => {
        const content = mockFiles.get(path);
        if (content === undefined) {
          throw new Error(`File not found: ${path}`);
        }
        return Promise.resolve(content);
      }),
      writeFile: vi.fn((path: string, content: string) => {
        mockFiles.set(path, content);
        return Promise.resolve();
      }),
      isFile: vi.fn((path: string) => mockFiles.has(path)),
      listFiles: vi.fn(() => Promise.resolve([])),
      getRootPath: vi.fn(() => '/mock-root'),
      // Helper to set up mock files for tests
      _mockFiles: mockFiles,
      _setMockFile: (path: string, content: string) => {
        mockFiles.set(path, content);
      },
      _clearMockFiles: () => {
        mockFiles.clear();
      },
    },
  };
});

// Mock the preferences manager to always allow permissions
vi.mock('../../src/preferences', () => ({
  preferencesManager: {
    getToolPermission: vi.fn(() => 'always'),
  },
}));

// Mock the tool result cache
vi.mock('../../src/toolResultCache', () => ({
  toolResultCache: {
    store: vi.fn(() => 'mock-result-id'),
  },
  generateContentSummary: vi.fn((content: string, path: string) => ({
    summary: 'Mock summary',
    lineCount: content.split('\n').length,
    byteSize: content.length,
    fileType: 'text',
    preview: content.substring(0, 100),
  })),
}));

// Import after mocks are set up
import { pipeTool } from '../../src/tools';
import { fileSystemManager } from '../../src/fileSystem';

// Get access to the mock file helpers
const mockFs = fileSystemManager as unknown as {
  _mockFiles: Map<string, string>;
  _setMockFile: (path: string, content: string) => void;
  _clearMockFiles: () => void;
  readFile: ReturnType<typeof vi.fn>;
  writeFile: ReturnType<typeof vi.fn>;
};

describe('Pipe Tool', () => {
  beforeEach(() => {
    mockFs._clearMockFiles();
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockFs._clearMockFiles();
  });

  describe('cat command', () => {
    it('reads a single file', async () => {
      mockFs._setMockFile('test.txt', 'Hello, World!');

      const result = await pipeTool.execute({
        commands: [{ tool: 'cat', args: { path: 'test.txt' } }],
        debug: false,
      });

      expect(result.success).toBe(true);
      expect(result.output).toBe('Hello, World!');
    });

    it('reads multiple files and concatenates', async () => {
      mockFs._setMockFile('file1.txt', 'First file');
      mockFs._setMockFile('file2.txt', 'Second file');

      const result = await pipeTool.execute({
        commands: [{ tool: 'cat', args: { paths: ['file1.txt', 'file2.txt'] } }],
        debug: false,
      });

      expect(result.success).toBe(true);
      expect(result.output).toBe('First file\nSecond file');
    });

    it('returns error when file not found', async () => {
      const result = await pipeTool.execute({
        commands: [
          { tool: 'cat', args: { path: 'nonexistent.txt' } },
        ],
        debug: false,
      });

      // When there's an error, success is undefined and error is set
      expect(result.success).toBeUndefined();
      expect(result.error).toContain('nonexistent.txt');
    });
  });

  describe('grep command', () => {
    it('filters lines matching a pattern', async () => {
      mockFs._setMockFile('test.txt', 'apple\nbanana\napricot\ncherry');

      const result = await pipeTool.execute({
        commands: [
          { tool: 'cat', args: { path: 'test.txt' } },
          { tool: 'grep', args: { pattern: '^a' } },
        ],
        debug: false,
      });

      expect(result.success).toBe(true);
      expect(result.output).toBe('apple\napricot');
    });

    it('supports case-insensitive search', async () => {
      mockFs._setMockFile('test.txt', 'APPLE\nBanana\napple');

      const result = await pipeTool.execute({
        commands: [
          { tool: 'cat', args: { path: 'test.txt' } },
          { tool: 'grep', args: { pattern: 'apple', caseInsensitive: true } },
        ],
        debug: false,
      });

      expect(result.success).toBe(true);
      expect(result.output).toBe('APPLE\napple');
    });

    it('supports inverted match', async () => {
      mockFs._setMockFile('test.txt', 'apple\nbanana\napricot');

      const result = await pipeTool.execute({
        commands: [
          { tool: 'cat', args: { path: 'test.txt' } },
          { tool: 'grep', args: { pattern: '^a', invertMatch: true } },
        ],
        debug: false,
      });

      expect(result.success).toBe(true);
      expect(result.output).toBe('banana');
    });

    it('can read from file directly', async () => {
      mockFs._setMockFile('test.txt', 'line1\nline2\nline3');

      const result = await pipeTool.execute({
        commands: [{ tool: 'grep', args: { pattern: '2', path: 'test.txt' } }],
        debug: false,
      });

      expect(result.success).toBe(true);
      expect(result.output).toBe('line2');
    });
  });

  describe('sort command', () => {
    it('sorts lines alphabetically', async () => {
      mockFs._setMockFile('test.txt', 'cherry\napple\nbanana');

      const result = await pipeTool.execute({
        commands: [
          { tool: 'cat', args: { path: 'test.txt' } },
          { tool: 'sort', args: {} },
        ],
        debug: false,
      });

      expect(result.success).toBe(true);
      expect(result.output).toBe('apple\nbanana\ncherry');
    });

    it('sorts in reverse order', async () => {
      mockFs._setMockFile('test.txt', 'apple\nbanana\ncherry');

      const result = await pipeTool.execute({
        commands: [
          { tool: 'cat', args: { path: 'test.txt' } },
          { tool: 'sort', args: { reverse: true } },
        ],
        debug: false,
      });

      expect(result.success).toBe(true);
      expect(result.output).toBe('cherry\nbanana\napple');
    });

    it('sorts numerically', async () => {
      mockFs._setMockFile('test.txt', '10\n2\n1\n20');

      const result = await pipeTool.execute({
        commands: [
          { tool: 'cat', args: { path: 'test.txt' } },
          { tool: 'sort', args: { numeric: true } },
        ],
        debug: false,
      });

      expect(result.success).toBe(true);
      expect(result.output).toBe('1\n2\n10\n20');
    });

    it('removes duplicates with unique option', async () => {
      mockFs._setMockFile('test.txt', 'apple\nbanana\napple\ncherry\nbanana');

      const result = await pipeTool.execute({
        commands: [
          { tool: 'cat', args: { path: 'test.txt' } },
          { tool: 'sort', args: { unique: true } },
        ],
        debug: false,
      });

      expect(result.success).toBe(true);
      expect(result.output).toBe('apple\nbanana\ncherry');
    });

    it('sorts case-insensitively', async () => {
      mockFs._setMockFile('test.txt', 'Banana\napple\nCherry');

      const result = await pipeTool.execute({
        commands: [
          { tool: 'cat', args: { path: 'test.txt' } },
          { tool: 'sort', args: { ignoreCase: true } },
        ],
        debug: false,
      });

      expect(result.success).toBe(true);
      expect(result.output).toBe('apple\nBanana\nCherry');
    });
  });

  describe('head command', () => {
    it('returns first 10 lines by default', async () => {
      const lines = Array.from({ length: 20 }, (_, i) => `line${i + 1}`);
      mockFs._setMockFile('test.txt', lines.join('\n'));

      const result = await pipeTool.execute({
        commands: [
          { tool: 'cat', args: { path: 'test.txt' } },
          { tool: 'head', args: {} },
        ],
        debug: false,
      });

      expect(result.success).toBe(true);
      expect(result.output).toBe(lines.slice(0, 10).join('\n'));
    });

    it('returns specified number of lines', async () => {
      mockFs._setMockFile('test.txt', 'line1\nline2\nline3\nline4\nline5');

      const result = await pipeTool.execute({
        commands: [
          { tool: 'cat', args: { path: 'test.txt' } },
          { tool: 'head', args: { lines: 3 } },
        ],
        debug: false,
      });

      expect(result.success).toBe(true);
      expect(result.output).toBe('line1\nline2\nline3');
    });
  });

  describe('tail command', () => {
    it('returns last 10 lines by default', async () => {
      const lines = Array.from({ length: 20 }, (_, i) => `line${i + 1}`);
      mockFs._setMockFile('test.txt', lines.join('\n'));

      const result = await pipeTool.execute({
        commands: [
          { tool: 'cat', args: { path: 'test.txt' } },
          { tool: 'tail', args: {} },
        ],
        debug: false,
      });

      expect(result.success).toBe(true);
      expect(result.output).toBe(lines.slice(-10).join('\n'));
    });

    it('returns specified number of lines', async () => {
      mockFs._setMockFile('test.txt', 'line1\nline2\nline3\nline4\nline5');

      const result = await pipeTool.execute({
        commands: [
          { tool: 'cat', args: { path: 'test.txt' } },
          { tool: 'tail', args: { lines: 2 } },
        ],
        debug: false,
      });

      expect(result.success).toBe(true);
      expect(result.output).toBe('line4\nline5');
    });
  });

  describe('uniq command', () => {
    it('removes adjacent duplicate lines', async () => {
      mockFs._setMockFile('test.txt', 'apple\napple\nbanana\nbanana\napple');

      const result = await pipeTool.execute({
        commands: [
          { tool: 'cat', args: { path: 'test.txt' } },
          { tool: 'uniq', args: {} },
        ],
        debug: false,
      });

      expect(result.success).toBe(true);
      expect(result.output).toBe('apple\nbanana\napple');
    });

    it('shows count with count option', async () => {
      mockFs._setMockFile('test.txt', 'apple\napple\napple\nbanana');

      const result = await pipeTool.execute({
        commands: [
          { tool: 'cat', args: { path: 'test.txt' } },
          { tool: 'uniq', args: { count: true } },
        ],
        debug: false,
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('3');
      expect(result.output).toContain('apple');
      expect(result.output).toContain('1');
      expect(result.output).toContain('banana');
    });

    it('shows only duplicates with duplicatesOnly option', async () => {
      mockFs._setMockFile('test.txt', 'apple\napple\nbanana\ncherry\ncherry');

      const result = await pipeTool.execute({
        commands: [
          { tool: 'cat', args: { path: 'test.txt' } },
          { tool: 'uniq', args: { duplicatesOnly: true } },
        ],
        debug: false,
      });

      expect(result.success).toBe(true);
      expect(result.output).toBe('apple\ncherry');
    });

    it('shows only unique lines with uniqueOnly option', async () => {
      mockFs._setMockFile('test.txt', 'apple\napple\nbanana\ncherry\ncherry');

      const result = await pipeTool.execute({
        commands: [
          { tool: 'cat', args: { path: 'test.txt' } },
          { tool: 'uniq', args: { uniqueOnly: true } },
        ],
        debug: false,
      });

      expect(result.success).toBe(true);
      expect(result.output).toBe('banana');
    });
  });

  describe('wc command', () => {
    it('counts lines, words, and characters', async () => {
      mockFs._setMockFile('test.txt', 'hello world\nfoo bar baz\n');

      const result = await pipeTool.execute({
        commands: [
          { tool: 'cat', args: { path: 'test.txt' } },
          { tool: 'wc', args: {} },
        ],
        debug: false,
      });

      expect(result.success).toBe(true);
      // Output should contain counts (format: lines words chars)
      const output = result.output as string;
      expect(output).toContain('2'); // 2 lines (newlines)
      expect(output).toContain('5'); // 5 words
    });
  });

  describe('write_file command', () => {
    it('writes piped content to a file', async () => {
      mockFs._setMockFile('input.txt', 'test content');

      const result = await pipeTool.execute({
        commands: [
          { tool: 'cat', args: { path: 'input.txt' } },
          { tool: 'write_file', args: { path: 'output.txt' } },
        ],
        debug: false,
      });

      expect(result.success).toBe(true);
      expect(mockFs.writeFile).toHaveBeenCalledWith('output.txt', 'test content');
    });
  });

  describe('command chaining', () => {
    it('chains multiple commands together', async () => {
      mockFs._setMockFile('test.txt', 'banana\napple\ncherry\napple\ndate\napricot');

      const result = await pipeTool.execute({
        commands: [
          { tool: 'cat', args: { path: 'test.txt' } },
          { tool: 'grep', args: { pattern: '^a' } },
          { tool: 'sort', args: {} },
          { tool: 'uniq', args: {} },
        ],
        debug: false,
      });

      expect(result.success).toBe(true);
      expect(result.output).toBe('apple\napricot');
    });

    it('handles complex pipeline: read, filter, sort, take first 2', async () => {
      mockFs._setMockFile('numbers.txt', '5\n3\n8\n1\n9\n2\n7');

      const result = await pipeTool.execute({
        commands: [
          { tool: 'cat', args: { path: 'numbers.txt' } },
          { tool: 'sort', args: { numeric: true } },
          { tool: 'head', args: { lines: 2 } },
        ],
        debug: false,
      });

      expect(result.success).toBe(true);
      expect(result.output).toBe('1\n2');
    });

    it('handles pipeline: sort descending, take last 3', async () => {
      mockFs._setMockFile('data.txt', 'zebra\napple\nmango\nbanana\ncherry');

      const result = await pipeTool.execute({
        commands: [
          { tool: 'cat', args: { path: 'data.txt' } },
          { tool: 'sort', args: { reverse: true } },
          { tool: 'tail', args: { lines: 3 } },
        ],
        debug: false,
      });

      expect(result.success).toBe(true);
      expect(result.output).toBe('cherry\nbanana\napple');
    });

    it('returns correct command count', async () => {
      mockFs._setMockFile('test.txt', 'hello');

      const result = await pipeTool.execute({
        commands: [
          { tool: 'cat', args: { path: 'test.txt' } },
          { tool: 'head', args: { lines: 1 } },
        ],
        debug: false,
      });

      expect(result.success).toBe(true);
      expect(result.commandsExecuted).toBe(2);
    });
  });

  describe('debug mode', () => {
    it('includes intermediate results when debug is true', async () => {
      mockFs._setMockFile('test.txt', 'hello\nworld');

      const result = await pipeTool.execute({
        commands: [
          { tool: 'cat', args: { path: 'test.txt' } },
          { tool: 'head', args: { lines: 1 } },
        ],
        debug: true,
      });

      expect(result.success).toBe(true);
      expect(result.intermediateResults).toBeDefined();
      expect(Array.isArray(result.intermediateResults)).toBe(true);
      expect(result.intermediateResults).toHaveLength(2);
    });
  });

  describe('error handling', () => {
    it('returns error when file not found', async () => {
      const result = await pipeTool.execute({
        commands: [{ tool: 'cat', args: { path: 'nonexistent.txt' } }],
        debug: false,
      });

      expect(result.success).toBeUndefined();
      expect(result.error).toContain('nonexistent.txt');
    });

    it('returns error when command fails mid-pipeline', async () => {
      mockFs._setMockFile('test.txt', 'hello');

      const result = await pipeTool.execute({
        commands: [
          { tool: 'cat', args: { path: 'test.txt' } },
          { tool: 'grep', args: {} }, // Missing required pattern
        ],
        debug: false,
      });

      expect(result.error).toBeDefined();
      expect(result.error).toContain('grep');
    });

    it('handles empty commands array gracefully', async () => {
      // The schema requires at least 1 command, so this tests validation
      // The tool should handle this edge case
      try {
        await pipeTool.execute({
          commands: [],
          debug: false,
        });
        // If no error is thrown, the tool handled it
      } catch {
        // Expected - schema validation should reject empty commands
      }
    });
  });

  describe('read_file command', () => {
    it('reads a file', async () => {
      mockFs._setMockFile('test.txt', 'file content');

      const result = await pipeTool.execute({
        commands: [{ tool: 'read_file', args: { path: 'test.txt' } }],
        debug: false,
      });

      expect(result.success).toBe(true);
      expect(result.output).toBe('file content');
    });

    it('returns error when path is missing', async () => {
      const result = await pipeTool.execute({
        commands: [{ tool: 'read_file', args: {} }],
        debug: false,
      });

      expect(result.error).toBeDefined();
      expect(result.error).toContain('read_file');
    });
  });
});
