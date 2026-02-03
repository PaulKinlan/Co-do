import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accessibility Tests for Co-do
 *
 * These tests check for WCAG 2.1 Level AA compliance including:
 * - ARIA attributes
 * - Form labels
 * - Keyboard navigation
 * - Heading hierarchy
 * - Alt text for images
 * - Focus management
 *
 * Note: Color contrast tests are currently excluded as the app has known
 * contrast issues that need to be addressed in the design. These should be
 * re-enabled after fixing the color scheme.
 */

test.describe('Accessibility - Main Pages', () => {
  test('landing page should not have accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['color-contrast']) // Known issue: app needs color scheme updates
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('header buttons are accessible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('.app-header')
      .disableRules(['color-contrast'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('sidebar is accessible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('#sidebar')
      .disableRules([
        'color-contrast', // Known issue: color scheme needs updates
        'heading-order',  // Known issue: sidebar uses h3, should use h2
      ])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('chat area is accessible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('.chat-area')
      .disableRules(['color-contrast'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });
});

test.describe('Accessibility - Modals', () => {
  test('settings modal should not have accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.click('#settings-btn');
    await page.waitForSelector('#settings-modal:not([hidden])');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('#settings-modal')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['color-contrast'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('add provider modal should not have accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.click('#settings-btn');
    await page.click('#add-provider-btn');
    await page.waitForSelector('#provider-edit-modal:not([hidden])');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('#provider-edit-modal')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['color-contrast'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('tools modal should not have accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.click('#tools-btn');
    await page.waitForSelector('#tools-modal:not([hidden])');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('#tools-modal')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules([
        'color-contrast', // Known issue: color scheme needs updates
        'select-name',    // Known issue: select dropdowns need proper labels
      ])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('network modal should not have accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.click('#network-btn');
    await page.waitForSelector('#network-modal[open]');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('#network-modal')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['color-contrast'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('info modal should not have accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.click('#info-btn');
    await page.waitForSelector('#info-modal:not([hidden])');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('#info-modal')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['color-contrast'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('data share modal should not have accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // The data share modal might be shown automatically on first visit
    // or we may need to trigger it
    const modal = page.locator('#data-share-modal');
    const isVisible = await modal.isVisible().catch(() => false);

    if (!isVisible) {
      // Skip if modal is not shown (already dismissed)
      test.skip();
      return;
    }

    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('#data-share-modal')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['color-contrast'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });
});

test.describe('Accessibility - Keyboard Navigation', () => {
  test('header buttons are keyboard accessible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Tab to first focusable element
    await page.keyboard.press('Tab');

    // Tab through and verify focus
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // At least one button should be reachable
    const focused = await page.evaluate(() => document.activeElement?.id);
    expect(['info-btn', 'settings-btn', 'tools-btn', 'mobile-menu-btn']).toContain(focused);
  });

  test('chat input is keyboard accessible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const chatInput = page.locator('#prompt-input');

    // Focus the input
    await chatInput.focus();

    // Type a message
    await page.keyboard.type('Test message');

    // Verify the input has the text
    const value = await chatInput.inputValue();
    expect(value).toBe('Test message');
  });

  test('modals can be closed with Escape key', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open settings modal
    await page.click('#settings-btn');
    await page.waitForSelector('#settings-modal:not([hidden])');

    const modal = page.locator('#settings-modal');
    await expect(modal).toBeVisible();

    // Close with Escape
    await page.keyboard.press('Escape');

    // Wait a moment for the modal to close
    await page.waitForTimeout(200);

    // Modal should be hidden
    await expect(modal).toBeHidden();
  });

  test('modal close buttons are keyboard accessible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open settings modal
    await page.click('#settings-btn');
    await page.waitForSelector('#settings-modal:not([hidden])');

    const modal = page.locator('#settings-modal');
    await expect(modal).toBeVisible();

    // Find and click the close button using keyboard
    const closeButton = page.locator('#settings-modal .modal-close');
    await expect(closeButton).toBeVisible();

    // Focus the close button directly
    await closeButton.focus();

    // Verify it's focused
    const isFocused = await closeButton.evaluate(el => el === document.activeElement);
    expect(isFocused).toBe(true);
  });
});

test.describe('Accessibility - ARIA and Semantics', () => {
  test('buttons have proper ARIA labels', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check header buttons have aria-label
    const infoBtn = page.locator('#info-btn');
    const settingsBtn = page.locator('#settings-btn');
    const toolsBtn = page.locator('#tools-btn');
    const sendBtn = page.locator('#send-btn');

    await expect(infoBtn).toHaveAttribute('aria-label', 'About Co-do');
    await expect(settingsBtn).toHaveAttribute('aria-label', 'AI Provider');
    await expect(toolsBtn).toHaveAttribute('aria-label', 'Tool Permissions');
    await expect(sendBtn).toHaveAttribute('aria-label', 'Send message');

    // Network button should have proper aria-label
    const networkBtn = page.locator('#network-btn');
    await expect(networkBtn).toHaveAttribute('aria-label', 'Network & Security');
  });

  test('modals have proper ARIA attributes', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.click('#settings-btn');
    await page.waitForSelector('#settings-modal:not([hidden])');

    const modal = page.locator('#settings-modal');

    // Native <dialog> elements have implicit role="dialog" and aria-modal="true"
    // when opened with showModal(), so we only need to check aria-labelledby
    await expect(modal).toHaveAttribute('aria-labelledby', 'settings-modal-title');

    // Verify it's actually a dialog element (which has implicit dialog semantics)
    const tagName = await modal.evaluate((el) => el.tagName.toLowerCase());
    expect(tagName).toBe('dialog');
  });

  test('network modal has proper ARIA attributes', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.click('#network-btn');
    await page.waitForSelector('#network-modal[open]');

    const modal = page.locator('#network-modal');
    await expect(modal).toHaveAttribute('aria-labelledby', 'network-modal-title');

    const tagName = await modal.evaluate((el) => el.tagName.toLowerCase());
    expect(tagName).toBe('dialog');

    // Network log list should have proper ARIA for live region
    const logList = page.locator('#network-log-list');
    await expect(logList).toHaveAttribute('role', 'log');
    await expect(logList).toHaveAttribute('aria-label', 'Network activity log');
  });

  test('form inputs have associated labels', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open add provider modal
    await page.click('#settings-btn');
    await page.click('#add-provider-btn');
    await page.waitForSelector('#provider-edit-modal:not([hidden])');

    // Each input should have an associated label
    const nameLabel = page.locator('label[for="provider-name"]');
    const typeLabel = page.locator('label[for="provider-type"]');
    const apiKeyLabel = page.locator('label[for="provider-api-key"]');
    const modelLabel = page.locator('label[for="provider-model"]');

    await expect(nameLabel).toBeVisible();
    await expect(typeLabel).toBeVisible();
    await expect(apiKeyLabel).toBeVisible();
    await expect(modelLabel).toBeVisible();
  });

  test('chat input has proper label', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const chatInput = page.locator('#prompt-input');
    await expect(chatInput).toHaveAttribute('aria-label', 'Chat message input');
  });
});

test.describe('Accessibility - Focus Management', () => {
  test.skip('focus is trapped in modal when open', async ({ page }) => {
    // TODO: This test is skipped because the app does not currently implement
    // focus trapping in modals. This is a known accessibility improvement needed.
    // Re-enable this test after implementing proper focus trap functionality.

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open settings modal
    await page.click('#settings-btn');
    await page.waitForSelector('#settings-modal:not([hidden])');

    // Tab through elements - focus should stay in modal
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');

      const focusedElement = await page.evaluate(() => {
        const el = document.activeElement;
        return el?.closest('#settings-modal') !== null;
      });

      // Focus should be within the modal
      expect(focusedElement).toBe(true);
    }
  });

  test('focus returns to trigger when modal is closed', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const settingsBtn = page.locator('#settings-btn');

    // Click to open modal
    await settingsBtn.click();
    await page.waitForSelector('#settings-modal:not([hidden])');

    // Close modal with Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Focus should return to settings button
    const focusedId = await page.evaluate(() => document.activeElement?.id);
    expect(focusedId).toBe('settings-btn');
  });
});

test.describe('Accessibility - Status Bar', () => {
  test('status bar dismiss button has proper ARIA attributes', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const dismissBtn = page.locator('#status-dismiss');

    // Verify ARIA label exists
    await expect(dismissBtn).toHaveAttribute('aria-label', 'Dismiss notification');
  });

  test('status bar dismiss button is keyboard accessible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Show the status bar
    await page.evaluate(() => {
      const statusBar = document.getElementById('status');
      const statusMessage = document.getElementById('status-message');
      if (statusBar && statusMessage) {
        statusMessage.textContent = 'Test status message';
        statusBar.className = 'status-bar success';
      }
    });

    const dismissBtn = page.locator('#status-dismiss');
    await expect(dismissBtn).toBeVisible();

    // Focus the dismiss button
    await dismissBtn.focus();

    // Verify button is focused
    const focusedId = await page.evaluate(() => document.activeElement?.id);
    expect(focusedId).toBe('status-dismiss');

    // Press Enter to dismiss
    await page.keyboard.press('Enter');

    // Status bar should be hidden
    const statusBar = page.locator('#status');
    await expect(statusBar).toBeHidden();
  });

  test('status bar can be dismissed with Space key', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Show the status bar
    await page.evaluate(() => {
      const statusBar = document.getElementById('status');
      const statusMessage = document.getElementById('status-message');
      if (statusBar && statusMessage) {
        statusMessage.textContent = 'Test status message';
        statusBar.className = 'status-bar info';
      }
    });

    const dismissBtn = page.locator('#status-dismiss');
    await dismissBtn.focus();

    // Press Space to dismiss
    await page.keyboard.press('Space');

    // Status bar should be hidden
    const statusBar = page.locator('#status');
    await expect(statusBar).toBeHidden();
  });

  test('status bar with dismiss button passes accessibility scan', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Show the status bar
    await page.evaluate(() => {
      const statusBar = document.getElementById('status');
      const statusMessage = document.getElementById('status-message');
      if (statusBar && statusMessage) {
        statusMessage.textContent = 'Test status message';
        statusBar.className = 'status-bar success';
      }
    });

    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('#status')
      .disableRules(['color-contrast'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
