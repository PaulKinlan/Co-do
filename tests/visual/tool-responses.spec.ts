import { test, expect } from '@playwright/test';
import {
  injectToolActivityGroup,
  injectToolOutputBlock,
  injectChatMessage,
  getElementColors,
  getElementLayout,
  captureElementSnapshot,
} from '../helpers/dom-inspector';

/**
 * Visual Regression Tests for Tool Response Rendering
 *
 * These tests inject tool activity groups and verify their visual appearance
 * in both light and dark modes. They also test DOM structure and layout
 * properties to catch rendering issues.
 *
 * Run `npm run test:visual:update` to update baseline screenshots.
 */

test.describe('Tool Response - Light Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('completed tool activity renders correctly', async ({ page }) => {
    const group = await injectToolActivityGroup(page, {
      toolName: 'read_file',
      args: { path: 'src/main.ts' },
      status: 'completed',
      result: {
        success: true,
        path: 'src/main.ts',
        lineCount: 45,
        byteSize: 1280,
      },
      expanded: true,
    });
    await expect(group).toHaveScreenshot('tool-response-completed.png', {
      animations: 'disabled',
    });
  });

  test('pending tool activity renders correctly', async ({ page }) => {
    const group = await injectToolActivityGroup(page, {
      toolName: 'write_file',
      args: { path: 'src/output.ts', content: 'export const value = 42;' },
      status: 'pending',
      expanded: true,
    });
    await expect(group).toHaveScreenshot('tool-response-pending.png', {
      animations: 'disabled',
    });
  });

  test('collapsed tool activity renders correctly', async ({ page }) => {
    const group = await injectToolActivityGroup(page, {
      toolName: 'list_files',
      args: { path: '/' },
      status: 'completed',
      expanded: false,
    });
    await expect(group).toHaveScreenshot('tool-response-collapsed.png', {
      animations: 'disabled',
    });
  });

  test('tool activity with error result', async ({ page }) => {
    const group = await injectToolActivityGroup(page, {
      toolName: 'read_file',
      args: { path: 'nonexistent.ts' },
      status: 'completed',
      result: { error: 'File not found: nonexistent.ts' },
      expanded: true,
    });
    await expect(group).toHaveScreenshot('tool-response-error.png', {
      animations: 'disabled',
    });
  });

  test('tool activity with long arguments', async ({ page }) => {
    const group = await injectToolActivityGroup(page, {
      toolName: 'write_file',
      args: {
        path: 'src/very/deeply/nested/directory/structure/file.ts',
        content: 'A'.repeat(200),
      },
      status: 'completed',
      result: { success: true },
      expanded: true,
    });
    await expect(group).toHaveScreenshot('tool-response-long-args.png', {
      animations: 'disabled',
    });
  });
});

test.describe('Tool Response - Dark Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('completed tool activity renders in dark mode', async ({ page }) => {
    const group = await injectToolActivityGroup(page, {
      toolName: 'read_file',
      args: { path: 'src/main.ts' },
      status: 'completed',
      result: {
        success: true,
        path: 'src/main.ts',
        lineCount: 45,
        byteSize: 1280,
      },
      expanded: true,
    });
    await expect(group).toHaveScreenshot('dark-tool-response-completed.png', {
      animations: 'disabled',
    });
  });

  test('pending tool activity renders in dark mode', async ({ page }) => {
    const group = await injectToolActivityGroup(page, {
      toolName: 'write_file',
      args: { path: 'src/output.ts', content: 'export const value = 42;' },
      status: 'pending',
      expanded: true,
    });
    await expect(group).toHaveScreenshot('dark-tool-response-pending.png', {
      animations: 'disabled',
    });
  });

  test('collapsed tool activity renders in dark mode', async ({ page }) => {
    const group = await injectToolActivityGroup(page, {
      toolName: 'list_files',
      args: { path: '/' },
      status: 'completed',
      expanded: false,
    });
    await expect(group).toHaveScreenshot('dark-tool-response-collapsed.png', {
      animations: 'disabled',
    });
  });
});

test.describe('Tool Response - DOM Structure', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('tool activity group has correct DOM structure', async ({ page }) => {
    await injectToolActivityGroup(page, {
      toolName: 'read_file',
      args: { path: 'test.ts' },
      status: 'completed',
      expanded: true,
    });

    // Verify the structure
    const group = page.locator('.tool-activity-group');
    await expect(group).toBeVisible();

    // Header elements
    const header = group.locator('.tool-activity-header');
    await expect(header).toHaveAttribute('role', 'button');
    await expect(header).toHaveAttribute('tabindex', '0');
    await expect(header).toHaveAttribute('aria-expanded', 'true');

    const icon = group.locator('.tool-activity-icon');
    await expect(icon).toBeVisible();

    const summary = group.locator('.tool-activity-summary');
    await expect(summary).toContainText('Using 1 tool');

    const toggle = group.locator('.tool-activity-toggle');
    await expect(toggle).toBeVisible();

    // Content elements
    const content = group.locator('.tool-activity-content');
    await expect(content).toBeAttached();

    const toolItem = group.locator('.tool-call-item');
    await expect(toolItem).toHaveAttribute('data-tool', 'read_file');

    const toolName = group.locator('.tool-item-name');
    await expect(toolName).toContainText('read_file');
  });

  test('pending status has correct badge styling', async ({ page }) => {
    await injectToolActivityGroup(page, {
      toolName: 'write_file',
      args: {},
      status: 'pending',
      expanded: true,
    });

    const status = page.locator('.tool-item-status');
    await expect(status).toHaveClass(/pending/);
    await expect(status).toContainText('calling...');

    const colors = await getElementColors(page, '.tool-item-status');
    // Pending status should have a blue-ish background
    expect(colors.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  });

  test('completed status has correct badge styling', async ({ page }) => {
    await injectToolActivityGroup(page, {
      toolName: 'read_file',
      args: {},
      status: 'completed',
      expanded: true,
    });

    const status = page.locator('.tool-item-status');
    await expect(status).toHaveClass(/completed/);
    await expect(status).toContainText('done');

    const colors = await getElementColors(page, '.tool-item-status');
    expect(colors.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  });

  test('tool activity header has correct layout', async ({ page }) => {
    await injectToolActivityGroup(page, {
      toolName: 'read_file',
      args: {},
      status: 'completed',
      expanded: true,
    });

    const layout = await getElementLayout(page, '.tool-activity-header');
    expect(layout.display).toBe('flex');
    expect(layout.alignItems).toBe('center');
    expect(layout.height).toBeGreaterThan(0);
  });

  test('tool item name uses monospace font', async ({ page }) => {
    await injectToolActivityGroup(page, {
      toolName: 'read_file',
      args: {},
      status: 'completed',
      expanded: true,
    });

    const snapshot = await captureElementSnapshot(page, '.tool-item-name');
    // Font family should include monospace fonts
    expect(snapshot.typography.fontFamily).toMatch(/mono|courier|monaco/i);
  });
});

test.describe('Tool Response - Context with Messages', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('tool activity between messages renders correctly', async ({ page }) => {
    await injectChatMessage(page, {
      role: 'user',
      content: 'Read the main.ts file',
    });

    await injectToolActivityGroup(page, {
      toolName: 'read_file',
      args: { path: 'src/main.ts' },
      status: 'completed',
      result: { success: true, lineCount: 42 },
      expanded: true,
    });

    await injectChatMessage(page, {
      role: 'assistant',
      content: 'Here are the contents of main.ts...',
    });

    const chatContainer = page.locator('#messages');
    await expect(chatContainer).toHaveScreenshot('tool-response-with-messages.png', {
      animations: 'disabled',
    });
  });

  test('tool activity between messages in dark mode', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await injectChatMessage(page, {
      role: 'user',
      content: 'Read the main.ts file',
    });

    await injectToolActivityGroup(page, {
      toolName: 'read_file',
      args: { path: 'src/main.ts' },
      status: 'completed',
      result: { success: true, lineCount: 42 },
      expanded: true,
    });

    await injectChatMessage(page, {
      role: 'assistant',
      content: 'Here are the contents of main.ts...',
    });

    const chatContainer = page.locator('#messages');
    await expect(chatContainer).toHaveScreenshot('dark-tool-response-with-messages.png', {
      animations: 'disabled',
    });
  });

  test('multiple tool activities render correctly', async ({ page }) => {
    await injectChatMessage(page, {
      role: 'user',
      content: 'Read all TypeScript files',
    });

    await injectToolActivityGroup(page, {
      toolName: 'list_files',
      args: { path: '/' },
      status: 'completed',
      result: { files: ['main.ts', 'ui.ts', 'tools.ts'] },
      expanded: false,
    });

    await injectToolActivityGroup(page, {
      toolName: 'read_file',
      args: { path: 'src/main.ts' },
      status: 'completed',
      result: { success: true },
      expanded: false,
    });

    await injectChatMessage(page, {
      role: 'assistant',
      content: 'I found and read 3 TypeScript files.',
    });

    const chatContainer = page.locator('#messages');
    await expect(chatContainer).toHaveScreenshot('multiple-tool-activities.png', {
      animations: 'disabled',
    });
  });
});

test.describe('Inline Tool Output Block - Light Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('inline tool output renders correctly', async ({ page }) => {
    const block = await injectToolOutputBlock(page, {
      toolName: 'xxd',
      content: '00000000: 2d2d 2d0a 7469 746c 653a 2068 7970 6572  ---.title: hyper\n00000010: 6d65 6469 610a 6461 7465 3a20 3230 3235  media.date: 2025',
      lineCount: 156,
    });
    await expect(block).toHaveScreenshot('inline-tool-output.png', {
      animations: 'disabled',
    });
  });

  test('inline tool output without line count', async ({ page }) => {
    const block = await injectToolOutputBlock(page, {
      toolName: 'sha256',
      content: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    });
    await expect(block).toHaveScreenshot('inline-tool-output-no-lines.png', {
      animations: 'disabled',
    });
  });

  test('inline tool output between messages renders correctly', async ({ page }) => {
    await injectChatMessage(page, {
      role: 'user',
      content: 'Show the hex dump of that file',
    });

    await injectToolActivityGroup(page, {
      toolName: 'xxd',
      args: { file: 'data.bin' },
      status: 'completed',
      expanded: false,
    });

    await injectToolOutputBlock(page, {
      toolName: 'xxd',
      content: '00000000: 2d2d 2d0a 7469 746c 653a 2068 7970 6572  ---.title: hyper\n00000010: 6d65 6469 610a 6461 7465 3a20 3230 3235  media.date: 2025',
      lineCount: 156,
    });

    await injectChatMessage(page, {
      role: 'assistant',
      content: 'The hex dump of data.bin is displayed above.',
    });

    const chatContainer = page.locator('#messages');
    await expect(chatContainer).toHaveScreenshot('inline-output-with-messages.png', {
      animations: 'disabled',
    });
  });
});

test.describe('Inline Tool Output Block - Dark Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('inline tool output renders in dark mode', async ({ page }) => {
    const block = await injectToolOutputBlock(page, {
      toolName: 'xxd',
      content: '00000000: 2d2d 2d0a 7469 746c 653a 2068 7970 6572  ---.title: hyper\n00000010: 6d65 6469 610a 6461 7465 3a20 3230 3235  media.date: 2025',
      lineCount: 156,
    });
    await expect(block).toHaveScreenshot('dark-inline-tool-output.png', {
      animations: 'disabled',
    });
  });

  test('inline tool output between messages in dark mode', async ({ page }) => {
    await injectChatMessage(page, {
      role: 'user',
      content: 'Show the hex dump of that file',
    });

    await injectToolActivityGroup(page, {
      toolName: 'xxd',
      args: { file: 'data.bin' },
      status: 'completed',
      expanded: false,
    });

    await injectToolOutputBlock(page, {
      toolName: 'xxd',
      content: '00000000: 2d2d 2d0a 7469 746c 653a 2068 7970 6572  ---.title: hyper',
      lineCount: 10,
    });

    await injectChatMessage(page, {
      role: 'assistant',
      content: 'The hex dump is displayed above.',
    });

    const chatContainer = page.locator('#messages');
    await expect(chatContainer).toHaveScreenshot('dark-inline-output-with-messages.png', {
      animations: 'disabled',
    });
  });
});

test.describe('Inline Tool Output Block - DOM Structure', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('tool output block has correct DOM structure', async ({ page }) => {
    await injectToolOutputBlock(page, {
      toolName: 'xxd',
      content: 'test output',
      lineCount: 42,
    });

    const block = page.locator('.tool-output-block');
    await expect(block).toBeVisible();

    const header = block.locator('.tool-output-header');
    await expect(header).toBeVisible();

    const name = block.locator('.tool-output-name');
    await expect(name).toContainText('xxd');

    const meta = block.locator('.tool-output-meta');
    await expect(meta).toContainText('42 lines');

    const content = block.locator('.tool-output-content');
    await expect(content).toContainText('test output');
  });

  test('tool output name uses monospace font', async ({ page }) => {
    await injectToolOutputBlock(page, {
      toolName: 'sha256',
      content: 'hash output',
    });

    const snapshot = await captureElementSnapshot(page, '.tool-output-name');
    expect(snapshot.typography.fontFamily).toMatch(/mono|courier|monaco/i);
  });

  test('tool output content uses monospace font', async ({ page }) => {
    await injectToolOutputBlock(page, {
      toolName: 'xxd',
      content: 'hex content',
    });

    const snapshot = await captureElementSnapshot(page, '.tool-output-content');
    expect(snapshot.typography.fontFamily).toMatch(/mono|courier|monaco/i);
  });

  test('tool output has accent border', async ({ page }) => {
    await injectToolOutputBlock(page, {
      toolName: 'xxd',
      content: 'output',
    });

    const colors = await getElementColors(page, '.tool-output-block');
    // Left border should be the accent color (not transparent)
    expect(colors.borderLeftColor).not.toBe('rgba(0, 0, 0, 0)');
  });

  test('tool output header has flex layout', async ({ page }) => {
    await injectToolOutputBlock(page, {
      toolName: 'xxd',
      content: 'output',
      lineCount: 10,
    });

    const layout = await getElementLayout(page, '.tool-output-header');
    expect(layout.display).toBe('flex');
    expect(layout.alignItems).toBe('center');
  });
});
