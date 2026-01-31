/**
 * Unit tests for tool response formatting utilities
 *
 * Tests the pure functions extracted from UIManager that handle
 * formatting tool call/result display content.
 */
import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  formatToolResultSummary,
  generateToolCallHtml,
  generateToolResultHtml,
  formatByteSize,
} from '../../src/tool-response-format';

describe('escapeHtml', () => {
  it('escapes ampersands', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes angle brackets', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#39;s');
  });

  it('escapes double quotes', () => {
    expect(escapeHtml('say "hello"')).toBe('say &quot;hello&quot;');
  });

  it('returns empty string for empty input', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('does not modify strings without special characters', () => {
    expect(escapeHtml('hello world 123')).toBe('hello world 123');
  });

  it('handles multiple special characters together', () => {
    expect(escapeHtml('<a href="x">&</a>')).toBe(
      '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;'
    );
  });
});

describe('formatToolResultSummary', () => {
  it('formats a successful result with all fields', () => {
    const result = {
      success: true,
      path: 'src/main.ts',
      summary: 'Read file contents',
      lineCount: 42,
      byteSize: 1536,
      fileType: 'typescript',
      preview: 'import { app } from "./app";',
    };
    const output = formatToolResultSummary(result);
    expect(output).toContain('Status: Success');
    expect(output).toContain('Path: src/main.ts');
    expect(output).toContain('Summary: Read file contents');
    expect(output).toContain('Lines: 42');
    expect(output).toContain('Size: 1.5 KB');
    expect(output).toContain('Type: typescript');
    expect(output).toContain('Preview:');
    expect(output).toContain('import { app } from "./app";');
  });

  it('formats an error result and returns early', () => {
    const result = {
      error: 'File not found: missing.ts',
    };
    const output = formatToolResultSummary(result);
    expect(output).toBe('Error: File not found: missing.ts');
  });

  it('formats result with only success status', () => {
    const result = { success: true };
    const output = formatToolResultSummary(result);
    expect(output).toBe('Status: Success');
  });

  it('formats result with path only', () => {
    const result = { success: true, path: '/root/file.txt' };
    const output = formatToolResultSummary(result);
    expect(output).toContain('Path: /root/file.txt');
  });

  it('formats byte sizes correctly', () => {
    expect(formatToolResultSummary({ success: true, byteSize: 500 })).toContain(
      'Size: 500 bytes'
    );
    expect(formatToolResultSummary({ success: true, byteSize: 2048 })).toContain(
      'Size: 2.0 KB'
    );
    expect(formatToolResultSummary({ success: true, byteSize: 1048576 })).toContain(
      'Size: 1.0 MB'
    );
  });

  it('handles zero line count', () => {
    const result = { success: true, lineCount: 0 };
    const output = formatToolResultSummary(result);
    expect(output).toContain('Lines: 0');
  });

  it('handles empty result object', () => {
    const output = formatToolResultSummary({});
    expect(output).toBe('');
  });
});

describe('generateToolCallHtml', () => {
  it('generates HTML with tool name and arguments', () => {
    const html = generateToolCallHtml('read_file', { path: 'test.ts' });
    expect(html).toContain('read_file');
    expect(html).toContain('tool-item-name');
    expect(html).toContain('tool-item-status pending');
    expect(html).toContain('calling...');
    expect(html).toContain('test.ts');
  });

  it('escapes HTML in tool name', () => {
    const html = generateToolCallHtml('<script>xss</script>', {});
    expect(html).toContain('&lt;script&gt;xss&lt;/script&gt;');
    expect(html).not.toContain('<script>xss</script>');
  });

  it('escapes HTML in arguments', () => {
    const html = generateToolCallHtml('tool', { content: '<b>bold</b>' });
    expect(html).toContain('&lt;b&gt;bold&lt;/b&gt;');
  });

  it('truncates long arguments at 500 characters', () => {
    const longContent = 'x'.repeat(600);
    const html = generateToolCallHtml('tool', { data: longContent });
    expect(html).toContain('...');
  });

  it('handles circular reference in arguments gracefully', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const html = generateToolCallHtml('tool', circular);
    expect(html).toContain('[Unable to display arguments:');
  });

  it('includes expected CSS class structure', () => {
    const html = generateToolCallHtml('read_file', {});
    expect(html).toContain('tool-item-header');
    expect(html).toContain('tool-item-icon');
    expect(html).toContain('tool-item-name');
    expect(html).toContain('tool-item-status');
    expect(html).toContain('tool-item-details');
    expect(html).toContain('tool-item-args');
  });
});

describe('generateToolResultHtml', () => {
  it('generates HTML with result content', () => {
    const html = generateToolResultHtml({ success: true, data: 'hello' });
    expect(html).toContain('tool-result-details');
    expect(html).toContain('Result');
    expect(html).toContain('hello');
  });

  it('escapes HTML in result content', () => {
    const html = generateToolResultHtml({ content: '<img src=x onerror=alert(1)>' });
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('includes full result without truncation', () => {
    const longResult = { data: 'y'.repeat(600) };
    const html = generateToolResultHtml(longResult);
    // Full result should be present (no truncation)
    expect(html).toContain('y'.repeat(600));
    expect(html).not.toContain('...');
  });

  it('handles non-serializable results', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const html = generateToolResultHtml(circular);
    expect(html).toContain('Error stringifying tool result:');
  });

  it('includes expected CSS class structure', () => {
    const html = generateToolResultHtml({ ok: true });
    expect(html).toContain('tool-item-details');
    expect(html).toContain('tool-result-details');
    expect(html).toContain('tool-item-result');
  });
});

describe('formatByteSize', () => {
  it('formats bytes', () => {
    expect(formatByteSize(0)).toBe('0 bytes');
    expect(formatByteSize(100)).toBe('100 bytes');
    expect(formatByteSize(1023)).toBe('1023 bytes');
  });

  it('formats kilobytes', () => {
    expect(formatByteSize(1024)).toBe('1.0 KB');
    expect(formatByteSize(1536)).toBe('1.5 KB');
    expect(formatByteSize(10240)).toBe('10.0 KB');
  });

  it('formats megabytes', () => {
    expect(formatByteSize(1048576)).toBe('1.0 MB');
    expect(formatByteSize(5242880)).toBe('5.0 MB');
  });
});
