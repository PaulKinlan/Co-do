import { test, expect } from '@playwright/test';
import {
  getDarkModeColorDiff,
  isDarkModeActive,
  injectToolActivityGroup,
  injectChatMessage,
  injectStatusBar,
  getElementColors,
  verifyContrastRatio,
} from '../helpers/dom-inspector';

/**
 * Dark Mode Visual Regression Tests
 *
 * These tests verify that the application renders correctly in dark mode
 * by emulating the prefers-color-scheme: dark media query. Each test
 * captures screenshots to detect visual regressions in dark mode styling.
 *
 * Run `npm run test:visual:update` to update baseline screenshots.
 */

test.describe('Dark Mode - Main UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('dark mode is active when emulated', async ({ page }) => {
    const darkMode = await isDarkModeActive(page);
    expect(darkMode).toBe(true);
  });

  test('CSS variables resolve to dark mode values', async ({ page }) => {
    const colors = await getDarkModeColorDiff(page);
    expect(colors.bg).toBe('#1A1A1A');
    expect(colors.surface).toBe('#2A2A2A');
    expect(colors.border).toBe('#3A3A3A');
    expect(colors.textPrimary).toBe('#F5F5F5');
    expect(colors.textSecondary).toBe('#B0B0B0');
  });

  test('landing page renders correctly in dark mode', async ({ page }) => {
    await expect(page).toHaveScreenshot('dark-landing-page.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('header displays correctly in dark mode', async ({ page }) => {
    const header = page.locator('.app-header');
    await expect(header).toBeVisible();
    await expect(header).toHaveScreenshot('dark-header.png', {
      animations: 'disabled',
    });
  });

  test('header buttons render correctly in dark mode', async ({ page }) => {
    const headerActions = page.locator('.header-actions');
    await expect(headerActions).toHaveScreenshot('dark-header-buttons.png', {
      animations: 'disabled',
    });
  });

  test('sidebar renders correctly in dark mode', async ({ page }) => {
    // Skip on mobile viewports where sidebar is hidden
    const viewport = page.viewportSize();
    if (viewport && viewport.width < 768) return;

    const sidebar = page.locator('#sidebar');
    await expect(sidebar).toBeVisible();
    await expect(sidebar).toHaveScreenshot('dark-sidebar.png', {
      animations: 'disabled',
    });
  });

  test('chat area renders correctly in dark mode', async ({ page }) => {
    const chatArea = page.locator('.chat-area');
    await expect(chatArea).toBeVisible();
    await expect(chatArea).toHaveScreenshot('dark-chat-area.png', {
      animations: 'disabled',
    });
  });

  test('chat input renders correctly in dark mode', async ({ page }) => {
    const inputContainer = page.locator('.chat-input-container');
    await expect(inputContainer).toHaveScreenshot('dark-chat-input.png', {
      animations: 'disabled',
    });
  });

  test('chat input focus state in dark mode', async ({ page }) => {
    const chatInput = page.locator('#prompt-input');
    await chatInput.focus();
    const inputContainer = page.locator('.chat-input-container');
    await expect(inputContainer).toHaveScreenshot('dark-chat-input-focused.png', {
      animations: 'disabled',
    });
  });

  test('privacy notice renders correctly in dark mode', async ({ page }) => {
    const privacyNotice = page.locator('.chat-privacy-notice');
    await expect(privacyNotice).toBeVisible();
    await expect(privacyNotice).toHaveScreenshot('dark-privacy-notice.png', {
      animations: 'disabled',
    });
  });
});

test.describe('Dark Mode - Modals', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('settings modal displays correctly in dark mode', async ({ page }) => {
    await page.click('#settings-btn');
    const modal = page.locator('#settings-modal');
    await expect(modal).toBeVisible();
    await expect(modal).toHaveScreenshot('dark-settings-modal.png', {
      animations: 'disabled',
    });
  });

  test('add provider modal displays correctly in dark mode', async ({ page }) => {
    await page.click('#settings-btn');
    await page.waitForSelector('#settings-modal:not([hidden])');
    await page.waitForTimeout(200);
    await page.click('#add-provider-btn');
    await page.waitForSelector('#provider-edit-modal:not([hidden])');
    await page.waitForTimeout(200);

    const providerModal = page.locator('#provider-edit-modal');
    await expect(providerModal).toBeVisible();
    await expect(providerModal).toHaveScreenshot('dark-add-provider-modal.png', {
      animations: 'disabled',
    });
  });

  test('tools permissions modal displays correctly in dark mode', async ({ page }) => {
    await page.click('#tools-btn');
    const toolsModal = page.locator('#tools-modal');
    await expect(toolsModal).toBeVisible();
    await expect(toolsModal).toHaveScreenshot('dark-tools-modal.png', {
      animations: 'disabled',
    });
  });

  test('info modal displays correctly in dark mode', async ({ page }) => {
    await page.click('#info-btn');
    const infoModal = page.locator('#info-modal');
    await expect(infoModal).toBeVisible();
    await expect(infoModal).toHaveScreenshot('dark-info-modal.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('notifications section checkbox renders correctly in dark mode', async ({ page }) => {
    await page.click('#settings-btn');
    const modal = page.locator('#settings-modal');
    await expect(modal).toBeVisible();

    const notificationsSection = page.locator('.notifications-section');
    await expect(notificationsSection).toBeVisible();
    await expect(notificationsSection).toHaveScreenshot('dark-notifications-section.png', {
      animations: 'disabled',
    });
  });

  test('modal overlay displays correctly in dark mode', async ({ page }) => {
    await page.click('#settings-btn');
    await expect(page).toHaveScreenshot('dark-modal-overlay.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });
});

test.describe('Dark Mode - Status Bars', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('info status bar renders correctly in dark mode', async ({ page }) => {
    const statusBar = await injectStatusBar(page, {
      message: 'Processing your request...',
      type: 'info',
    });
    await expect(statusBar).toBeVisible();
    await expect(statusBar).toHaveScreenshot('dark-status-bar-info.png', {
      animations: 'disabled',
    });
  });

  test('success status bar renders correctly in dark mode', async ({ page }) => {
    const statusBar = await injectStatusBar(page, {
      message: 'File saved successfully',
      type: 'success',
    });
    await expect(statusBar).toBeVisible();
    await expect(statusBar).toHaveScreenshot('dark-status-bar-success.png', {
      animations: 'disabled',
    });
  });

  test('error status bar renders correctly in dark mode', async ({ page }) => {
    const statusBar = await injectStatusBar(page, {
      message: 'Failed to read file',
      type: 'error',
    });
    await expect(statusBar).toBeVisible();
    await expect(statusBar).toHaveScreenshot('dark-status-bar-error.png', {
      animations: 'disabled',
    });
  });
});

test.describe('Dark Mode - Chat Messages', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('user message renders correctly in dark mode', async ({ page }) => {
    const message = await injectChatMessage(page, {
      role: 'user',
      content: 'Can you read the contents of main.ts?',
    });
    await expect(message).toHaveScreenshot('dark-user-message.png', {
      animations: 'disabled',
    });
  });

  test('assistant message renders correctly in dark mode', async ({ page }) => {
    const message = await injectChatMessage(page, {
      role: 'assistant',
      content: 'I will read the file for you now.',
    });
    await expect(message).toHaveScreenshot('dark-assistant-message.png', {
      animations: 'disabled',
    });
  });

  test('error message renders correctly in dark mode', async ({ page }) => {
    const message = await injectChatMessage(page, {
      role: 'error',
      content: 'Error: Failed to connect to AI provider',
    });
    await expect(message).toHaveScreenshot('dark-error-message.png', {
      animations: 'disabled',
    });
  });
});

test.describe('Dark Mode - Tool Activity', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('tool activity group renders correctly in dark mode', async ({ page }) => {
    const group = await injectToolActivityGroup(page, {
      toolName: 'read_file',
      args: { path: 'src/main.ts' },
      status: 'completed',
      result: { success: true, content: 'file contents...' },
      expanded: true,
    });
    await expect(group).toHaveScreenshot('dark-tool-activity-group.png', {
      animations: 'disabled',
    });
  });

  test('tool activity pending state in dark mode', async ({ page }) => {
    const group = await injectToolActivityGroup(page, {
      toolName: 'write_file',
      args: { path: 'src/output.ts', content: '// new file' },
      status: 'pending',
      expanded: true,
    });
    await expect(group).toHaveScreenshot('dark-tool-activity-pending.png', {
      animations: 'disabled',
    });
  });

  test('tool activity collapsed state in dark mode', async ({ page }) => {
    const group = await injectToolActivityGroup(page, {
      toolName: 'list_files',
      args: { path: '/' },
      status: 'completed',
      result: { files: ['main.ts', 'ui.ts'] },
      expanded: false,
    });
    await expect(group).toHaveScreenshot('dark-tool-activity-collapsed.png', {
      animations: 'disabled',
    });
  });

  test('tool activity header has adequate contrast in dark mode', async ({ page }) => {
    await injectToolActivityGroup(page, {
      toolName: 'read_file',
      args: { path: 'test.ts' },
      status: 'completed',
      expanded: true,
    });

    const contrast = await verifyContrastRatio(page, '.tool-activity-summary', 3.0);
    expect(contrast.passes).toBe(true);
  });
});

test.describe('Dark Mode - Interactive States', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('button hover states in dark mode', async ({ page }) => {
    const sendBtn = page.locator('#send-btn');
    await sendBtn.scrollIntoViewIfNeeded();
    await sendBtn.hover();
    await expect(sendBtn).toHaveScreenshot('dark-send-button-hover.png', {
      animations: 'disabled',
    });
  });

  test('select folder button hover in dark mode', async ({ page }) => {
    const viewport = page.viewportSize();
    if (viewport && viewport.width < 768) return;

    const selectFolderBtn = page.locator('#select-folder-btn');
    await selectFolderBtn.scrollIntoViewIfNeeded();
    await selectFolderBtn.hover();
    await expect(selectFolderBtn).toHaveScreenshot('dark-select-folder-hover.png', {
      animations: 'disabled',
    });
  });
});

test.describe('Dark Mode - Responsive', () => {
  test('mobile layout renders correctly in dark mode', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('dark-mobile-layout.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('tablet layout renders correctly in dark mode', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('dark-tablet-layout.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });
});

test.describe('Dark Mode - Permission Groups', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('permission groups render correctly in dark mode', async ({ page }) => {
    await page.click('#tools-btn');
    const toolsModal = page.locator('#tools-modal');
    await expect(toolsModal).toBeVisible();

    const fileManagement = page.locator('[data-group="file-management"]');
    await expect(fileManagement).toBeVisible();
    await expect(fileManagement).toHaveScreenshot('dark-permission-group.png', {
      animations: 'disabled',
    });
  });

  test('WASM tools section renders in dark mode', async ({ page }) => {
    await page.click('#tools-btn');
    const wasmToolGroups = page.locator('#wasm-tool-groups');
    await expect(wasmToolGroups).toBeVisible();
    await expect(wasmToolGroups).toHaveScreenshot('dark-wasm-tools-section.png', {
      animations: 'disabled',
    });
  });
});

test.describe('Dark Mode - Update Notification', () => {
  test('update notification renders correctly in dark mode', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Show the notification
    await page.evaluate(() => {
      const notification = document.getElementById('update-notification');
      const changelogLink = document.getElementById(
        'update-changelog-link'
      ) as HTMLAnchorElement;
      if (notification && changelogLink) {
        changelogLink.href = 'https://github.com/PaulKinlan/Co-do/commit/abc123';
        changelogLink.hidden = false;
        notification.hidden = false;
        notification.classList.add('show');
      }
    });

    const notification = page.locator('#update-notification');
    await expect(notification).toBeVisible();
    await expect(notification).toHaveScreenshot('dark-update-notification.png', {
      animations: 'disabled',
    });
  });
});
