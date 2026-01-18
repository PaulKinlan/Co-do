import { test, expect } from '@playwright/test';

/**
 * Visual Regression Tests for Co-do UI Components
 *
 * These tests capture screenshots of various UI states and compare them
 * against baseline images to detect visual regressions.
 *
 * Run `npm run test:visual:update` to update baseline screenshots.
 */

test.describe('Visual Regression - Main UI', () => {
  test('landing page renders correctly', async ({ page }) => {
    await page.goto('/');

    // Wait for the page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Take full page screenshot
    await expect(page).toHaveScreenshot('landing-page.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('header displays correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const header = page.locator('.app-header');
    await expect(header).toBeVisible();

    // Screenshot just the header
    await expect(header).toHaveScreenshot('header.png', {
      animations: 'disabled',
    });
  });

  test('header buttons have correct styling', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Test each header button individually
    const infoBtn = page.locator('#info-btn');
    const settingsBtn = page.locator('#settings-btn');
    const toolsBtn = page.locator('#tools-btn');

    await expect(infoBtn).toBeVisible();
    await expect(settingsBtn).toBeVisible();
    await expect(toolsBtn).toBeVisible();

    // Screenshot the header actions area
    const headerActions = page.locator('.header-actions');
    await expect(headerActions).toHaveScreenshot('header-buttons.png', {
      animations: 'disabled',
    });
  });

  test('sidebar renders correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const sidebar = page.locator('#sidebar');
    await expect(sidebar).toBeVisible();

    await expect(sidebar).toHaveScreenshot('sidebar-default.png', {
      animations: 'disabled',
    });
  });

  test('select folder button displays correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const selectFolderBtn = page.locator('#select-folder-btn');
    await expect(selectFolderBtn).toBeVisible();

    await expect(selectFolderBtn).toHaveScreenshot('select-folder-button.png', {
      animations: 'disabled',
    });
  });

  test('chat area renders correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const chatArea = page.locator('.chat-area');
    await expect(chatArea).toBeVisible();

    await expect(chatArea).toHaveScreenshot('chat-area.png', {
      animations: 'disabled',
    });
  });

  test('chat input displays correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const chatInput = page.locator('#prompt-input');
    const sendBtn = page.locator('#send-btn');

    await expect(chatInput).toBeVisible();
    await expect(sendBtn).toBeVisible();

    const inputContainer = page.locator('.chat-input-container');
    await expect(inputContainer).toHaveScreenshot('chat-input.png', {
      animations: 'disabled',
    });
  });

  test('privacy notice displays correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const privacyNotice = page.locator('.chat-privacy-notice');
    await expect(privacyNotice).toBeVisible();

    await expect(privacyNotice).toHaveScreenshot('privacy-notice.png', {
      animations: 'disabled',
    });
  });
});

test.describe('Visual Regression - Modals', () => {
  test('settings modal displays correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open settings modal
    await page.click('#settings-btn');

    const modal = page.locator('#settings-modal');
    await expect(modal).toBeVisible();

    await expect(modal).toHaveScreenshot('settings-modal.png', {
      animations: 'disabled',
    });
  });

  test('add provider modal displays correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open settings modal
    await page.click('#settings-btn');
    await page.waitForSelector('#settings-modal:not([hidden])');
    await page.waitForTimeout(200); // Wait for modal animation

    // Click add provider button
    await page.click('#add-provider-btn');
    await page.waitForSelector('#provider-edit-modal:not([hidden])');
    await page.waitForTimeout(200); // Wait for modal animation

    const providerModal = page.locator('#provider-edit-modal');
    await expect(providerModal).toBeVisible();

    await expect(providerModal).toHaveScreenshot('add-provider-modal.png', {
      animations: 'disabled',
    });
  });

  test('provider modal with different providers', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open settings and add provider modal
    await page.click('#settings-btn');
    await page.click('#add-provider-btn');

    const providerModal = page.locator('#provider-edit-modal');
    await expect(providerModal).toBeVisible();

    // Test Anthropic provider (default)
    await expect(providerModal).toHaveScreenshot('provider-modal-anthropic.png', {
      animations: 'disabled',
    });

    // Switch to OpenAI
    await page.selectOption('#provider-type', 'openai');
    await page.waitForTimeout(100); // Wait for UI update
    await expect(providerModal).toHaveScreenshot('provider-modal-openai.png', {
      animations: 'disabled',
    });

    // Switch to Google
    await page.selectOption('#provider-type', 'google');
    await page.waitForTimeout(100); // Wait for UI update
    await expect(providerModal).toHaveScreenshot('provider-modal-google.png', {
      animations: 'disabled',
    });
  });

  test('tools permissions modal displays correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open tools modal
    await page.click('#tools-btn');

    const toolsModal = page.locator('#tools-modal');
    await expect(toolsModal).toBeVisible();

    await expect(toolsModal).toHaveScreenshot('tools-modal.png', {
      animations: 'disabled',
    });
  });

  test('info modal displays correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open info modal
    await page.click('#info-btn');

    const infoModal = page.locator('#info-modal');
    await expect(infoModal).toBeVisible();

    await expect(infoModal).toHaveScreenshot('info-modal.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });
});

test.describe('Visual Regression - Interactive States', () => {
  test('button hover states', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Test send button hover
    const sendBtn = page.locator('#send-btn');
    await sendBtn.scrollIntoViewIfNeeded();
    await sendBtn.hover();
    await expect(sendBtn).toHaveScreenshot('send-button-hover.png', {
      animations: 'disabled',
    });

    // Test select folder button hover (only on desktop where sidebar is visible)
    const viewport = page.viewportSize();
    if (viewport && viewport.width >= 768) {
      const selectFolderBtn = page.locator('#select-folder-btn');
      await selectFolderBtn.scrollIntoViewIfNeeded();
      await selectFolderBtn.hover();
      await expect(selectFolderBtn).toHaveScreenshot('select-folder-button-hover.png', {
        animations: 'disabled',
      });
    }
  });

  test('input focus states', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const chatInput = page.locator('#prompt-input');
    await chatInput.focus();

    const inputContainer = page.locator('.chat-input-container');
    await expect(inputContainer).toHaveScreenshot('chat-input-focused.png', {
      animations: 'disabled',
    });
  });

  test('modal overlay displays correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.click('#settings-btn');

    // Screenshot the entire page with modal open
    await expect(page).toHaveScreenshot('modal-overlay.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });
});

test.describe('Visual Regression - Responsive Design', () => {
  test('mobile layout renders correctly', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('mobile-layout.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('mobile menu button displays correctly', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const mobileMenuBtn = page.locator('#mobile-menu-btn');
    await expect(mobileMenuBtn).toBeVisible();

    await expect(mobileMenuBtn).toHaveScreenshot('mobile-menu-button.png', {
      animations: 'disabled',
    });
  });

  test('tablet layout renders correctly', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('tablet-layout.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });
});

test.describe('Visual Regression - Update Notification', () => {
  test('update notification is hidden by default', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const notification = page.locator('#update-notification');
    await expect(notification).toBeHidden();
  });

  test('changelog link is hidden by default', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const changelogLink = page.locator('#update-changelog-link');
    await expect(changelogLink).toBeHidden();
  });

  test('changelog link has no href attribute by default', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const changelogLink = page.locator('#update-changelog-link');
    // Link should not have href attribute set (prevents accidental navigation)
    const href = await changelogLink.getAttribute('href');
    expect(href).toBeNull();
  });

  test('update notification displays correctly when shown', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Manually show the notification for visual testing
    await page.evaluate(() => {
      const notification = document.getElementById('update-notification');
      const changelogLink = document.getElementById('update-changelog-link') as HTMLAnchorElement;
      if (notification && changelogLink) {
        changelogLink.href = 'https://github.com/PaulKinlan/Co-do/commit/abc123';
        changelogLink.hidden = false;
        notification.hidden = false;
        notification.classList.add('show');
      }
    });

    const notification = page.locator('#update-notification');
    await expect(notification).toBeVisible();

    await expect(notification).toHaveScreenshot('update-notification-visible.png', {
      animations: 'disabled',
    });
  });

  test('update notification elements are properly structured', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify all expected elements exist
    const notification = page.locator('#update-notification');
    const text = page.locator('.update-notification-text');
    const changelogLink = page.locator('#update-changelog-link');
    const reloadBtn = page.locator('#update-reload-btn');
    const dismissBtn = page.locator('#update-dismiss-btn');

    // Elements should exist in the DOM even if hidden
    await expect(notification).toBeAttached();
    await expect(text).toBeAttached();
    await expect(changelogLink).toBeAttached();
    await expect(reloadBtn).toBeAttached();
    await expect(dismissBtn).toBeAttached();

    // Verify accessibility attributes
    await expect(notification).toHaveAttribute('role', 'alert');
    await expect(notification).toHaveAttribute('aria-live', 'polite');
    await expect(dismissBtn).toHaveAttribute('aria-label', 'Dismiss');
  });
});
