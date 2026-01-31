/**
 * Unit tests for the WASM tool pipeline
 *
 * Tests the core functions that convert AI tool calls into WASM CLI
 * invocations, ensuring stdin/stdout are handled correctly and args
 * are formatted properly for each argStyle.
 */
import { describe, it, expect } from 'vitest';
import { convertArgsToCliFormat } from '../../src/wasm-tools/manager';
import { sanitizeExecutionOptions } from '../../src/wasm-tools/worker-types';
import { VirtualFileSystem } from '../../src/wasm-tools/vfs';
import type { WasmToolManifest } from '../../src/wasm-tools/types';

// ---------------------------------------------------------------------------
// Helper: minimal manifest builder
// ---------------------------------------------------------------------------

function makeManifest(overrides: Partial<WasmToolManifest> & {
  name: string;
  parameters: WasmToolManifest['parameters'];
  execution: WasmToolManifest['execution'];
}): WasmToolManifest {
  return {
    version: '1.0.0',
    description: 'test tool',
    returns: { type: 'string', description: 'output' },
    category: 'test',
    ...overrides,
  };
}

// ===========================================================================
// convertArgsToCliFormat
// ===========================================================================

describe('convertArgsToCliFormat', () => {
  // -------------------------------------------------------------------------
  // Positional arg style
  // -------------------------------------------------------------------------
  describe('positional argStyle', () => {
    it('extracts stdinParam into stdin and excludes it from cliArgs', () => {
      const manifest = makeManifest({
        name: 'xxd',
        parameters: {
          type: 'object',
          properties: {
            mode: { type: 'string', description: 'mode' },
            input: { type: 'string', description: 'input text' },
          },
          required: ['mode', 'input'],
        },
        execution: {
          argStyle: 'positional',
          fileAccess: 'none',
          stdinParam: 'input',
        },
      });

      const result = convertArgsToCliFormat(manifest, {
        mode: 'dump',
        input: 'hello world',
      });

      expect(result.cliArgs).toEqual(['xxd', 'dump']);
      expect(result.stdin).toBe('hello world');
    });

    it('passes all args positionally when no stdinParam is set', () => {
      const manifest = makeManifest({
        name: 'xxd',
        parameters: {
          type: 'object',
          properties: {
            mode: { type: 'string', description: 'mode' },
            input: { type: 'string', description: 'input text' },
          },
          required: ['mode', 'input'],
        },
        execution: {
          argStyle: 'positional',
          fileAccess: 'none',
        },
      });

      const result = convertArgsToCliFormat(manifest, {
        mode: 'dump',
        input: 'hello world',
      });

      expect(result.cliArgs).toEqual(['xxd', 'dump', 'hello world']);
      expect(result.stdin).toBeUndefined();
    });

    it('handles large content via stdinParam correctly', () => {
      const largeContent = 'x'.repeat(100_000);
      const manifest = makeManifest({
        name: 'base64',
        parameters: {
          type: 'object',
          properties: {
            mode: { type: 'string', description: 'mode' },
            input: { type: 'string', description: 'input text' },
          },
          required: ['mode', 'input'],
        },
        execution: {
          argStyle: 'positional',
          fileAccess: 'none',
          stdinParam: 'input',
        },
      });

      const result = convertArgsToCliFormat(manifest, {
        mode: 'encode',
        input: largeContent,
      });

      expect(result.cliArgs).toEqual(['base64', 'encode']);
      expect(result.stdin).toBe(largeContent);
      expect(result.stdin!.length).toBe(100_000);
    });

    it('preserves order of required params', () => {
      const manifest = makeManifest({
        name: 'tool',
        parameters: {
          type: 'object',
          properties: {
            a: { type: 'string', description: 'first' },
            b: { type: 'string', description: 'second' },
            c: { type: 'string', description: 'third' },
          },
          required: ['a', 'b', 'c'],
        },
        execution: {
          argStyle: 'positional',
          fileAccess: 'none',
        },
      });

      const result = convertArgsToCliFormat(manifest, {
        c: 'third',
        a: 'first',
        b: 'second',
      });

      // Order follows `required` array, not object key order
      expect(result.cliArgs).toEqual(['tool', 'first', 'second', 'third']);
    });

    it('adds optional params after required ones in property order', () => {
      const manifest = makeManifest({
        name: 'tool',
        parameters: {
          type: 'object',
          properties: {
            req: { type: 'string', description: 'required' },
            opt: { type: 'string', description: 'optional' },
          },
          required: ['req'],
        },
        execution: {
          argStyle: 'positional',
          fileAccess: 'none',
        },
      });

      const result = convertArgsToCliFormat(manifest, {
        req: 'hello',
        opt: 'world',
      });

      expect(result.cliArgs).toEqual(['tool', 'hello', 'world']);
    });

    it('omits undefined optional params', () => {
      const manifest = makeManifest({
        name: 'tool',
        parameters: {
          type: 'object',
          properties: {
            req: { type: 'string', description: 'required' },
            opt: { type: 'string', description: 'optional' },
          },
          required: ['req'],
        },
        execution: {
          argStyle: 'positional',
          fileAccess: 'none',
        },
      });

      const result = convertArgsToCliFormat(manifest, {
        req: 'hello',
      });

      expect(result.cliArgs).toEqual(['tool', 'hello']);
    });

    it('handles stdinParam that is in the middle of required list', () => {
      const manifest = makeManifest({
        name: 'sed',
        parameters: {
          type: 'object',
          properties: {
            expression: { type: 'string', description: 'sed expr' },
            input: { type: 'string', description: 'text' },
          },
          required: ['expression', 'input'],
        },
        execution: {
          argStyle: 'positional',
          fileAccess: 'none',
          stdinParam: 'input',
        },
      });

      const result = convertArgsToCliFormat(manifest, {
        expression: 's/foo/bar/g',
        input: 'foo baz foo',
      });

      expect(result.cliArgs).toEqual(['sed', 's/foo/bar/g']);
      expect(result.stdin).toBe('foo baz foo');
    });
  });

  // -------------------------------------------------------------------------
  // CLI arg style
  // -------------------------------------------------------------------------
  describe('cli argStyle', () => {
    it('converts args to --key value pairs', () => {
      const manifest = makeManifest({
        name: 'wc',
        parameters: {
          type: 'object',
          properties: {
            input: { type: 'string', description: 'text' },
            lines: { type: 'boolean', description: 'count lines' },
          },
          required: ['input'],
        },
        execution: {
          argStyle: 'cli',
          fileAccess: 'none',
          stdinParam: 'input',
        },
      });

      const result = convertArgsToCliFormat(manifest, {
        input: 'hello\nworld',
        lines: true,
      });

      expect(result.cliArgs).toEqual(['wc', '--lines']);
      expect(result.stdin).toBe('hello\nworld');
    });

    it('handles boolean false (not included)', () => {
      const manifest = makeManifest({
        name: 'sort',
        parameters: {
          type: 'object',
          properties: {
            input: { type: 'string', description: 'text' },
            reverse: { type: 'boolean', description: 'reverse' },
            numeric: { type: 'boolean', description: 'numeric' },
          },
          required: ['input'],
        },
        execution: {
          argStyle: 'cli',
          fileAccess: 'none',
          stdinParam: 'input',
        },
      });

      const result = convertArgsToCliFormat(manifest, {
        input: '3\n1\n2',
        reverse: false,
        numeric: true,
      });

      expect(result.cliArgs).toEqual(['sort', '--numeric']);
      expect(result.stdin).toBe('3\n1\n2');
    });

    it('includes string values as --key value', () => {
      const manifest = makeManifest({
        name: 'grep',
        parameters: {
          type: 'object',
          properties: {
            pattern: { type: 'string', description: 'pattern' },
            input: { type: 'string', description: 'text' },
          },
          required: ['pattern', 'input'],
        },
        execution: {
          argStyle: 'cli',
          fileAccess: 'none',
          stdinParam: 'input',
        },
      });

      const result = convertArgsToCliFormat(manifest, {
        pattern: 'hello',
        input: 'hello world\ngoodbye',
      });

      expect(result.cliArgs).toEqual(['grep', '--pattern', 'hello']);
      expect(result.stdin).toBe('hello world\ngoodbye');
    });

    it('omits null and undefined values', () => {
      const manifest = makeManifest({
        name: 'tool',
        parameters: {
          type: 'object',
          properties: {
            a: { type: 'string', description: 'a' },
            b: { type: 'string', description: 'b' },
          },
          required: [],
        },
        execution: {
          argStyle: 'cli',
          fileAccess: 'none',
        },
      });

      const result = convertArgsToCliFormat(manifest, {
        a: 'hello',
        b: undefined,
      });

      expect(result.cliArgs).toEqual(['tool', '--a', 'hello']);
    });

    it('converts number values to strings', () => {
      const manifest = makeManifest({
        name: 'head',
        parameters: {
          type: 'object',
          properties: {
            input: { type: 'string', description: 'text' },
            n: { type: 'number', description: 'count' },
          },
          required: ['input'],
        },
        execution: {
          argStyle: 'cli',
          fileAccess: 'none',
          stdinParam: 'input',
        },
      });

      const result = convertArgsToCliFormat(manifest, {
        input: 'line1\nline2\nline3',
        n: 2,
      });

      expect(result.cliArgs).toEqual(['head', '--n', '2']);
      expect(result.stdin).toBe('line1\nline2\nline3');
    });
  });

  // -------------------------------------------------------------------------
  // JSON arg style
  // -------------------------------------------------------------------------
  describe('json argStyle', () => {
    it('sends all args as JSON via stdin', () => {
      const manifest = makeManifest({
        name: 'sqlite3',
        parameters: {
          type: 'object',
          properties: {
            sql: { type: 'string', description: 'query' },
            data: { type: 'string', description: 'data' },
          },
          required: ['sql'],
        },
        execution: {
          argStyle: 'json',
          fileAccess: 'none',
        },
      });

      const args = { sql: 'SELECT 1', data: '[{"a":1}]' };
      const result = convertArgsToCliFormat(manifest, args);

      expect(result.cliArgs).toEqual(['sqlite3']);
      expect(result.stdin).toBe(JSON.stringify(args));
    });

    it('passes only tool name as cliArgs', () => {
      const manifest = makeManifest({
        name: 'tool',
        parameters: {
          type: 'object',
          properties: {
            a: { type: 'string', description: 'a' },
          },
          required: ['a'],
        },
        execution: {
          argStyle: 'json',
          fileAccess: 'none',
        },
      });

      const result = convertArgsToCliFormat(manifest, { a: 'value' });

      expect(result.cliArgs).toHaveLength(1);
      expect(result.cliArgs[0]).toBe('tool');
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------
  describe('edge cases', () => {
    it('handles empty args object', () => {
      const manifest = makeManifest({
        name: 'uuid',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
        execution: {
          argStyle: 'positional',
          fileAccess: 'none',
        },
      });

      const result = convertArgsToCliFormat(manifest, {});

      expect(result.cliArgs).toEqual(['uuid']);
      expect(result.stdin).toBeUndefined();
    });

    it('handles stdinParam with empty string value', () => {
      const manifest = makeManifest({
        name: 'tool',
        parameters: {
          type: 'object',
          properties: {
            input: { type: 'string', description: 'text' },
          },
          required: ['input'],
        },
        execution: {
          argStyle: 'positional',
          fileAccess: 'none',
          stdinParam: 'input',
        },
      });

      const result = convertArgsToCliFormat(manifest, { input: '' });

      expect(result.cliArgs).toEqual(['tool']);
      expect(result.stdin).toBe('');
    });

    it('handles stdinParam when value is missing (undefined)', () => {
      const manifest = makeManifest({
        name: 'tool',
        parameters: {
          type: 'object',
          properties: {
            input: { type: 'string', description: 'text' },
          },
          required: ['input'],
        },
        execution: {
          argStyle: 'positional',
          fileAccess: 'none',
          stdinParam: 'input',
        },
      });

      const result = convertArgsToCliFormat(manifest, {});

      expect(result.cliArgs).toEqual(['tool']);
      expect(result.stdin).toBeUndefined();
    });

    it('throws on unknown argStyle', () => {
      const manifest = makeManifest({
        name: 'tool',
        parameters: { type: 'object', properties: {}, required: [] },
        execution: {
          argStyle: 'unknown' as 'cli',
          fileAccess: 'none',
        },
      });

      expect(() => convertArgsToCliFormat(manifest, {})).toThrow('Unknown argStyle');
    });
  });

  // -------------------------------------------------------------------------
  // Real tool manifests
  // -------------------------------------------------------------------------
  describe('real tool scenarios', () => {
    it('base64 encode: extracts input to stdin, mode to args', () => {
      const manifest = makeManifest({
        name: 'base64',
        parameters: {
          type: 'object',
          properties: {
            mode: {
              type: 'string',
              enum: ['encode', 'decode'],
              description: 'mode',
            },
            input: { type: 'string', description: 'text' },
          },
          required: ['mode', 'input'],
        },
        execution: {
          argStyle: 'positional',
          fileAccess: 'none',
          stdinParam: 'input',
        },
      });

      const result = convertArgsToCliFormat(manifest, {
        mode: 'encode',
        input: 'Hello, World!',
      });

      expect(result.cliArgs).toEqual(['base64', 'encode']);
      expect(result.stdin).toBe('Hello, World!');
    });

    it('wc with multiple boolean flags', () => {
      const manifest = makeManifest({
        name: 'wc',
        parameters: {
          type: 'object',
          properties: {
            input: { type: 'string', description: 'text' },
            lines: { type: 'boolean', description: 'lines' },
            words: { type: 'boolean', description: 'words' },
            chars: { type: 'boolean', description: 'chars' },
          },
          required: ['input'],
        },
        execution: {
          argStyle: 'cli',
          fileAccess: 'none',
          stdinParam: 'input',
        },
      });

      const result = convertArgsToCliFormat(manifest, {
        input: 'hello world\nfoo bar',
        lines: true,
        words: false,
        chars: true,
      });

      expect(result.cliArgs).toContain('--lines');
      expect(result.cliArgs).toContain('--chars');
      expect(result.cliArgs).not.toContain('--words');
      expect(result.stdin).toBe('hello world\nfoo bar');
    });

    it('grep with pattern and stdinParam input', () => {
      const manifest = makeManifest({
        name: 'grep',
        parameters: {
          type: 'object',
          properties: {
            pattern: { type: 'string', description: 'pattern' },
            input: { type: 'string', description: 'text' },
            ignoreCase: { type: 'boolean', description: 'case insensitive' },
            invert: { type: 'boolean', description: 'invert' },
            lineNumbers: { type: 'boolean', description: 'line numbers' },
            count: { type: 'boolean', description: 'count' },
          },
          required: ['pattern', 'input'],
        },
        execution: {
          argStyle: 'cli',
          fileAccess: 'none',
          stdinParam: 'input',
        },
      });

      const result = convertArgsToCliFormat(manifest, {
        pattern: 'error',
        input: 'line1\nerror: something\nline3\nerror: another',
        ignoreCase: true,
        lineNumbers: true,
      });

      expect(result.cliArgs).toContain('--pattern');
      expect(result.cliArgs).toContain('error');
      expect(result.cliArgs).toContain('--ignoreCase');
      expect(result.cliArgs).toContain('--lineNumbers');
      expect(result.cliArgs).not.toContain('--input');
      expect(result.stdin).toBe('line1\nerror: something\nline3\nerror: another');
    });

    it('diff with two positional text args (no stdinParam)', () => {
      const manifest = makeManifest({
        name: 'diff',
        parameters: {
          type: 'object',
          properties: {
            text1: { type: 'string', description: 'first' },
            text2: { type: 'string', description: 'second' },
            unified: { type: 'boolean', description: 'unified' },
          },
          required: ['text1', 'text2'],
        },
        execution: {
          argStyle: 'positional',
          fileAccess: 'none',
        },
      });

      const result = convertArgsToCliFormat(manifest, {
        text1: 'aaa',
        text2: 'bbb',
        unified: true,
      });

      expect(result.cliArgs).toEqual(['diff', 'aaa', 'bbb', 'true']);
      expect(result.stdin).toBeUndefined();
    });

    it('sqlite3 with json argStyle', () => {
      const manifest = makeManifest({
        name: 'sqlite3',
        parameters: {
          type: 'object',
          properties: {
            sql: { type: 'string', description: 'query' },
            data: { type: 'string', description: 'data' },
          },
          required: ['sql'],
        },
        execution: {
          argStyle: 'json',
          fileAccess: 'none',
        },
      });

      const args = { sql: 'CREATE TABLE t(id INT); INSERT INTO t VALUES(1); SELECT * FROM t;' };
      const result = convertArgsToCliFormat(manifest, args);

      expect(result.cliArgs).toEqual(['sqlite3']);
      expect(JSON.parse(result.stdin!)).toEqual(args);
    });
  });
});

// ===========================================================================
// sanitizeExecutionOptions
// ===========================================================================

describe('sanitizeExecutionOptions', () => {
  it('applies defaults when no options provided', () => {
    const result = sanitizeExecutionOptions({});

    expect(result.timeout).toBe(30_000);
    expect(result.memoryPages).toBe(512);
    expect(result.stdin).toBeUndefined();
    expect(result.files).toBeUndefined();
  });

  it('passes through stdin', () => {
    const result = sanitizeExecutionOptions({ stdin: 'hello world' });
    expect(result.stdin).toBe('hello world');
  });

  it('passes through files', () => {
    const files = { 'test.txt': 'content' };
    const result = sanitizeExecutionOptions({ files });
    expect(result.files).toEqual(files);
  });

  it('clamps timeout to maximum (300s)', () => {
    const result = sanitizeExecutionOptions({ timeout: 999_999 });
    expect(result.timeout).toBe(300_000);
  });

  it('clamps timeout to minimum (100ms)', () => {
    const result = sanitizeExecutionOptions({ timeout: 10 });
    expect(result.timeout).toBe(100);
  });

  it('clamps memoryPages to maximum (MEDIA = 4096)', () => {
    const result = sanitizeExecutionOptions({ memoryPages: 999_999 });
    expect(result.memoryPages).toBe(4096);
  });

  it('prefers memoryPages over legacy memoryLimit', () => {
    const result = sanitizeExecutionOptions({
      memoryPages: 1024,
      memoryLimit: 256,
    });
    expect(result.memoryPages).toBe(1024);
  });

  it('falls back to memoryLimit when memoryPages is not set', () => {
    const result = sanitizeExecutionOptions({ memoryLimit: 256 });
    expect(result.memoryPages).toBe(256);
  });

  it('preserves valid timeout', () => {
    const result = sanitizeExecutionOptions({ timeout: 10_000 });
    expect(result.timeout).toBe(10_000);
  });
});

// ===========================================================================
// VirtualFileSystem stdin/stdout
// ===========================================================================

describe('VirtualFileSystem', () => {
  describe('stdin', () => {
    it('sets and reads string stdin in full', () => {
      const vfs = new VirtualFileSystem(null, 'none');
      vfs.setStdin('hello world');

      const data = vfs.readStdin(1024);
      const text = new TextDecoder().decode(data);

      expect(text).toBe('hello world');
    });

    it('sets stdin from Uint8Array', () => {
      const vfs = new VirtualFileSystem(null, 'none');
      const bytes = new TextEncoder().encode('binary data');
      vfs.setStdin(bytes);

      const data = vfs.readStdin(1024);
      expect(new TextDecoder().decode(data)).toBe('binary data');
    });

    it('reads stdin in chunks (maxBytes)', () => {
      const vfs = new VirtualFileSystem(null, 'none');
      vfs.setStdin('abcdefghij'); // 10 bytes

      const chunk1 = vfs.readStdin(4);
      expect(new TextDecoder().decode(chunk1)).toBe('abcd');

      const chunk2 = vfs.readStdin(4);
      expect(new TextDecoder().decode(chunk2)).toBe('efgh');

      const chunk3 = vfs.readStdin(4);
      expect(new TextDecoder().decode(chunk3)).toBe('ij');
    });

    it('returns empty array at EOF', () => {
      const vfs = new VirtualFileSystem(null, 'none');
      vfs.setStdin('hi');

      vfs.readStdin(2); // consume all
      const eof = vfs.readStdin(1024);
      expect(eof.length).toBe(0);
    });

    it('returns empty array when no stdin set', () => {
      const vfs = new VirtualFileSystem(null, 'none');
      const data = vfs.readStdin(1024);
      expect(data.length).toBe(0);
    });

    it('handles large stdin (100KB)', () => {
      const vfs = new VirtualFileSystem(null, 'none');
      const largeInput = 'x'.repeat(100_000);
      vfs.setStdin(largeInput);

      const data = vfs.readStdin(200_000);
      expect(new TextDecoder().decode(data)).toBe(largeInput);
    });
  });

  describe('stdout', () => {
    it('accumulates multiple writes', () => {
      const vfs = new VirtualFileSystem(null, 'none');
      const encoder = new TextEncoder();

      vfs.writeStdout(encoder.encode('hello'));
      vfs.writeStdout(encoder.encode(' '));
      vfs.writeStdout(encoder.encode('world'));

      expect(vfs.getStdout()).toBe('hello world');
    });

    it('returns empty string when nothing written', () => {
      const vfs = new VirtualFileSystem(null, 'none');
      expect(vfs.getStdout()).toBe('');
    });

    it('returns correct byte count from writeStdout', () => {
      const vfs = new VirtualFileSystem(null, 'none');
      const data = new TextEncoder().encode('test');

      const written = vfs.writeStdout(data);
      expect(written).toBe(4);
    });
  });

  describe('stderr', () => {
    it('accumulates stderr separately from stdout', () => {
      const vfs = new VirtualFileSystem(null, 'none');
      const encoder = new TextEncoder();

      vfs.writeStdout(encoder.encode('output'));
      vfs.writeStderr(encoder.encode('error'));

      expect(vfs.getStdout()).toBe('output');
      expect(vfs.getStderr()).toBe('error');
    });

    it('returns empty string when nothing written', () => {
      const vfs = new VirtualFileSystem(null, 'none');
      expect(vfs.getStderr()).toBe('');
    });
  });

  describe('reset', () => {
    it('clears all buffers', () => {
      const vfs = new VirtualFileSystem(null, 'none');
      const encoder = new TextEncoder();

      vfs.setStdin('input');
      vfs.writeStdout(encoder.encode('output'));
      vfs.writeStderr(encoder.encode('error'));

      vfs.reset();

      expect(vfs.readStdin(1024).length).toBe(0);
      expect(vfs.getStdout()).toBe('');
      expect(vfs.getStderr()).toBe('');
    });
  });

  describe('stdin then stdout flow (simulated WASM tool)', () => {
    it('reads stdin, transforms, writes to stdout', () => {
      const vfs = new VirtualFileSystem(null, 'none');
      const encoder = new TextEncoder();

      // Simulate the manager setting stdin before execution
      vfs.setStdin('hello world');

      // Simulate the WASM tool reading stdin
      const inputData = vfs.readStdin(1024);
      const inputText = new TextDecoder().decode(inputData);

      // Simulate the WASM tool writing transformed output
      const output = inputText.toUpperCase();
      vfs.writeStdout(encoder.encode(output));

      // Verify full pipeline
      expect(vfs.getStdout()).toBe('HELLO WORLD');
    });

    it('handles multi-chunk stdin reads followed by stdout writes', () => {
      const vfs = new VirtualFileSystem(null, 'none');
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();

      vfs.setStdin('abcdefghijklmnopqrstuvwxyz');

      // Read in small chunks like a real WASI fd_read would
      let allInput = '';
      while (true) {
        const chunk = vfs.readStdin(8);
        if (chunk.length === 0) break;
        allInput += decoder.decode(chunk);
      }

      expect(allInput).toBe('abcdefghijklmnopqrstuvwxyz');

      // Write output in chunks like a real WASI fd_write would
      vfs.writeStdout(encoder.encode('result: '));
      vfs.writeStdout(encoder.encode(allInput.length.toString()));

      expect(vfs.getStdout()).toBe('result: 26');
    });
  });
});
