/**
 * Unit tests for binary data support in the WASM tool pipeline.
 *
 * Tests cover:
 *   - VFS binary stdin/stdout/stderr handling
 *   - Binary detection logic (UTF-8 round-trip test)
 *   - Base64 decoding of binary parameters via convertArgsToCliFormat
 *   - findBinaryParam validation (single binary param constraint)
 */
import { describe, it, expect } from 'vitest';
import { findBinaryParam, convertArgsToCliFormat } from '../../src/wasm-tools/manager';
import type { WasmToolManifest } from '../../src/wasm-tools/types';

// ---------------------------------------------------------------------------
// VFS binary I/O
// ---------------------------------------------------------------------------

describe('VirtualFileSystem binary I/O', () => {
  // We import VFS dynamically so the mock system doesn't interfere.
  // VFS only depends on FileSystemManager for file operations, not for
  // stdin/stdout, so we can test I/O buffers with a null filesystem.
  async function createVFS() {
    const { VirtualFileSystem } = await import('../../src/wasm-tools/vfs');
    return new VirtualFileSystem(null, 'none');
  }

  describe('setStdin / readStdin', () => {
    it('accepts a string and returns UTF-8 bytes', async () => {
      const vfs = await createVFS();
      vfs.setStdin('hello');

      const result = vfs.readStdin(1024);
      expect(result).toEqual(new TextEncoder().encode('hello'));
    });

    it('accepts a Uint8Array and preserves raw bytes', async () => {
      const vfs = await createVFS();
      const binary = new Uint8Array([0x00, 0xFF, 0x80, 0x7F]);
      vfs.setStdin(binary);

      const result = vfs.readStdin(1024);
      expect(result).toEqual(binary);
    });

    it('reads in chunks respecting maxBytes', async () => {
      const vfs = await createVFS();
      vfs.setStdin('abcdef');

      const chunk1 = vfs.readStdin(3);
      expect(new TextDecoder().decode(chunk1)).toBe('abc');

      const chunk2 = vfs.readStdin(3);
      expect(new TextDecoder().decode(chunk2)).toBe('def');

      const chunk3 = vfs.readStdin(3);
      expect(chunk3.length).toBe(0);
    });
  });

  describe('writeStdout / getStdout / getStdoutBinary', () => {
    it('returns text via getStdout()', async () => {
      const vfs = await createVFS();
      vfs.writeStdout(new TextEncoder().encode('hello '));
      vfs.writeStdout(new TextEncoder().encode('world'));

      expect(vfs.getStdout()).toBe('hello world');
    });

    it('returns raw bytes via getStdoutBinary()', async () => {
      const vfs = await createVFS();
      const chunk1 = new Uint8Array([0x89, 0x50, 0x4E, 0x47]); // PNG header
      const chunk2 = new Uint8Array([0x0D, 0x0A, 0x1A, 0x0A]);
      vfs.writeStdout(chunk1);
      vfs.writeStdout(chunk2);

      const result = vfs.getStdoutBinary();
      expect(result).toEqual(new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));
    });

    it('preserves binary data that would be corrupted by text decoding', async () => {
      const vfs = await createVFS();
      // Bytes that are invalid UTF-8 sequences
      const invalidUtf8 = new Uint8Array([0xFF, 0xFE, 0x80, 0xC0]);
      vfs.writeStdout(invalidUtf8);

      // getStdout() will produce replacement characters (lossy)
      const text = vfs.getStdout();
      expect(text).toContain('\uFFFD'); // replacement character

      // getStdoutBinary() preserves the original bytes
      const binary = vfs.getStdoutBinary();
      expect(binary).toEqual(invalidUtf8);
    });
  });

  describe('writeStderr / getStderr / getStderrBinary', () => {
    it('returns text via getStderr()', async () => {
      const vfs = await createVFS();
      vfs.writeStderr(new TextEncoder().encode('error message'));
      expect(vfs.getStderr()).toBe('error message');
    });

    it('returns raw bytes via getStderrBinary()', async () => {
      const vfs = await createVFS();
      const bytes = new Uint8Array([0x01, 0x02, 0x03]);
      vfs.writeStderr(bytes);
      expect(vfs.getStderrBinary()).toEqual(bytes);
    });
  });

  describe('reset', () => {
    it('clears all I/O buffers', async () => {
      const vfs = await createVFS();
      vfs.setStdin('input');
      vfs.writeStdout(new TextEncoder().encode('output'));
      vfs.writeStderr(new TextEncoder().encode('error'));

      vfs.reset();

      expect(vfs.readStdin(1024).length).toBe(0);
      expect(vfs.getStdout()).toBe('');
      expect(vfs.getStdoutBinary().length).toBe(0);
      expect(vfs.getStderr()).toBe('');
    });
  });
});

// ---------------------------------------------------------------------------
// Binary detection logic
// ---------------------------------------------------------------------------

describe('Binary output detection', () => {
  const textEncoder = new TextEncoder();
  const textDecoder = new TextDecoder();

  /**
   * Reproduces the binary detection logic used in runtime.ts and wasm-worker.ts:
   * compare byte length of original output with the byte length of
   * re-encoding the decoded text.
   */
  function isBinaryOutput(data: Uint8Array): boolean {
    if (data.length === 0) return false;
    const decoded = textDecoder.decode(data);
    return textEncoder.encode(decoded).length !== data.length;
  }

  it('detects valid UTF-8 text as non-binary', () => {
    const text = textEncoder.encode('Hello, world! 🌍');
    expect(isBinaryOutput(text)).toBe(false);
  });

  it('detects ASCII text as non-binary', () => {
    const ascii = textEncoder.encode('just plain ascii\n');
    expect(isBinaryOutput(ascii)).toBe(false);
  });

  it('detects empty output as non-binary', () => {
    expect(isBinaryOutput(new Uint8Array(0))).toBe(false);
  });

  it('detects PNG header bytes as binary', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    expect(isBinaryOutput(png)).toBe(true);
  });

  it('detects arbitrary non-UTF-8 bytes as binary', () => {
    const bytes = new Uint8Array([0xFF, 0xFE, 0x00, 0x80, 0xC0]);
    expect(isBinaryOutput(bytes)).toBe(true);
  });

  it('detects gzip header as binary', () => {
    const gzip = new Uint8Array([0x1F, 0x8B, 0x08, 0x00]);
    expect(isBinaryOutput(gzip)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Base64 decoding via convertArgsToCliFormat
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

describe('Base64 binary parameter decoding via convertArgsToCliFormat', () => {
  it('decodes base64 text parameter into stdinBinary', () => {
    const manifest = makeManifest({
      name: 'img-tool',
      parameters: {
        type: 'object',
        properties: {
          data: { type: 'binary', description: 'binary data' },
        },
        required: ['data'],
      },
      execution: { argStyle: 'positional', fileAccess: 'none' },
    });

    const encoded = btoa('Hello, World!');
    const result = convertArgsToCliFormat(manifest, { data: encoded });

    expect(result.stdinBinary).toBeDefined();
    expect(new TextDecoder().decode(result.stdinBinary!)).toBe('Hello, World!');
  });

  it('decodes base64 binary data correctly (PNG header)', () => {
    const manifest = makeManifest({
      name: 'img-tool',
      parameters: {
        type: 'object',
        properties: {
          data: { type: 'binary', description: 'binary data' },
        },
        required: ['data'],
      },
      execution: { argStyle: 'positional', fileAccess: 'none' },
    });

    const original = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0xFF, 0x00, 0x80]);
    const base64 = btoa(String.fromCharCode(...original));
    const result = convertArgsToCliFormat(manifest, { data: base64 });

    expect(result.stdinBinary).toEqual(original);
  });

  it('round-trips all 256 byte values through base64', () => {
    const manifest = makeManifest({
      name: 'tool',
      parameters: {
        type: 'object',
        properties: {
          data: { type: 'binary', description: 'binary data' },
        },
        required: ['data'],
      },
      execution: { argStyle: 'positional', fileAccess: 'none' },
    });

    const allBytes = new Uint8Array(256);
    for (let i = 0; i < 256; i++) allBytes[i] = i;

    const base64 = btoa(String.fromCharCode(...allBytes));
    const result = convertArgsToCliFormat(manifest, { data: base64 });

    expect(result.stdinBinary).toEqual(allBytes);
  });

  it('throws on invalid base64 input', () => {
    const manifest = makeManifest({
      name: 'tool',
      parameters: {
        type: 'object',
        properties: {
          data: { type: 'binary', description: 'binary data' },
        },
        required: ['data'],
      },
      execution: { argStyle: 'positional', fileAccess: 'none' },
    });

    expect(() => convertArgsToCliFormat(manifest, { data: 'not valid base64!!!' })).toThrow();
  });

  it('removes binary param from cliArgs', () => {
    const manifest = makeManifest({
      name: 'compress',
      parameters: {
        type: 'object',
        properties: {
          data: { type: 'binary', description: 'binary data' },
          level: { type: 'number', description: 'compression level' },
        },
        required: ['data'],
      },
      execution: { argStyle: 'cli', fileAccess: 'none' },
    });

    const base64 = btoa('test data');
    const result = convertArgsToCliFormat(manifest, { data: base64, level: 9 });

    // Binary param should not appear in CLI args
    expect(result.cliArgs).toEqual(['compress', '--level', '9']);
    expect(result.stdinBinary).toBeDefined();
  });

  it('ignores non-string binary param value', () => {
    const manifest = makeManifest({
      name: 'tool',
      parameters: {
        type: 'object',
        properties: {
          data: { type: 'binary', description: 'binary data' },
        },
        required: ['data'],
      },
      execution: { argStyle: 'positional', fileAccess: 'none' },
    });

    // If the value is not a string (shouldn't happen normally), stdinBinary should be undefined
    const result = convertArgsToCliFormat(manifest, { data: 12345 as unknown });

    expect(result.stdinBinary).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// findBinaryParam validation (uses the actual exported function)
// ---------------------------------------------------------------------------

describe('findBinaryParam validation', () => {
  it('returns null when no binary parameters exist', () => {
    const manifest = makeManifest({
      name: 'test-tool',
      parameters: {
        type: 'object',
        properties: {
          input: { type: 'string', description: 'input' },
          count: { type: 'number', description: 'count' },
        },
        required: ['input'],
      },
      execution: { argStyle: 'positional', fileAccess: 'none' },
    });
    expect(findBinaryParam(manifest)).toBeNull();
  });

  it('returns the binary parameter name when exactly one exists', () => {
    const manifest = makeManifest({
      name: 'image-tool',
      parameters: {
        type: 'object',
        properties: {
          data: { type: 'binary', description: 'image data' },
          format: { type: 'string', description: 'output format' },
        },
        required: ['data'],
      },
      execution: { argStyle: 'positional', fileAccess: 'none' },
    });
    expect(findBinaryParam(manifest)).toBe('data');
  });

  it('throws when multiple binary parameters are defined', () => {
    const manifest = makeManifest({
      name: 'bad-tool',
      parameters: {
        type: 'object',
        properties: {
          image: { type: 'binary', description: 'image' },
          mask: { type: 'binary', description: 'mask' },
        },
        required: ['image', 'mask'],
      },
      execution: { argStyle: 'positional', fileAccess: 'none' },
    });
    expect(() => findBinaryParam(manifest)).toThrow(
      /multiple binary parameters.*image, mask/
    );
  });

  it('returns null when properties is empty', () => {
    const manifest = makeManifest({
      name: 'empty-tool',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      execution: { argStyle: 'positional', fileAccess: 'none' },
    });
    expect(findBinaryParam(manifest)).toBeNull();
  });
});
