import { test, expect } from '@playwright/test';
import {
  injectToolActivityGroup,
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
