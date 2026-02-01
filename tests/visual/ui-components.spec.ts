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

test.describe('Visual Regression - Permission Groups', () => {
  test('permission groups render correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open tools modal
    await page.click('#tools-btn');

    const toolsModal = page.locator('#tools-modal');
    await expect(toolsModal).toBeVisible();

    // Verify all permission groups are present
    const fileManagement = page.locator('[data-group="file-management"]');
    const fileReading = page.locator('[data-group="file-reading"]');
    const pipeCommands = page.locator('[data-group="pipe-commands"]');
    const wasmTools = page.locator('[data-group="wasm-tools"]');

    await expect(fileManagement).toBeVisible();
    await expect(fileReading).toBeVisible();
    await expect(pipeCommands).toBeVisible();
    await expect(wasmTools).toBeVisible();
  });

  test('permission groups are open by default', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.click('#tools-btn');

    // All groups should have the 'open' attribute by default
    const fileManagement = page.locator('[data-group="file-management"]');
    const fileReading = page.locator('[data-group="file-reading"]');
    const pipeCommands = page.locator('[data-group="pipe-commands"]');
    const wasmTools = page.locator('[data-group="wasm-tools"]');

    await expect(fileManagement).toHaveAttribute('open', '');
    await expect(fileReading).toHaveAttribute('open', '');
    await expect(pipeCommands).toHaveAttribute('open', '');
    await expect(wasmTools).toHaveAttribute('open', '');
  });

  test('permission groups can be collapsed', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.click('#tools-btn');

    // Collapse file management group by clicking on summary
    const fileManagement = page.locator('[data-group="file-management"]');
    const fileManagementHeader = fileManagement.locator('summary');

    await fileManagementHeader.click();

    // The group should no longer have the 'open' attribute
    await expect(fileManagement).not.toHaveAttribute('open', '');
  });

  test('permission group collapse state persists in localStorage', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open tools modal and collapse a group
    await page.click('#tools-btn');

    const fileManagement = page.locator('[data-group="file-management"]');
    const fileManagementHeader = fileManagement.locator('summary');

    // Collapse the group
    await fileManagementHeader.click();
    await expect(fileManagement).not.toHaveAttribute('open', '');

    // Close modal
    const closeBtn = page.locator('#tools-modal .modal-close');
    await closeBtn.click();

    // Reopen modal
    await page.click('#tools-btn');

    // The group should still be collapsed
    await expect(fileManagement).not.toHaveAttribute('open', '');

    // Verify localStorage was updated
    const savedStates = await page.evaluate(() => {
      return localStorage.getItem('permission_group_states');
    });

    expect(savedStates).not.toBeNull();
    const parsedStates = JSON.parse(savedStates!);
    expect(parsedStates['file-management']).toBe(false);
  });

  test('permission group collapse state restores on page reload', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open tools modal and collapse groups
    await page.click('#tools-btn');

    const fileManagement = page.locator('[data-group="file-management"]');
    const fileReading = page.locator('[data-group="file-reading"]');

    // Collapse both groups
    await fileManagement.locator('summary').click();
    await fileReading.locator('summary').click();

    // Close modal
    await page.locator('#tools-modal .modal-close').click();

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Reopen tools modal
    await page.click('#tools-btn');

    // Both groups should still be collapsed
    const fileManagementAfterReload = page.locator('[data-group="file-management"]');
    const fileReadingAfterReload = page.locator('[data-group="file-reading"]');

    await expect(fileManagementAfterReload).not.toHaveAttribute('open', '');
    await expect(fileReadingAfterReload).not.toHaveAttribute('open', '');
  });

  test('permission group chevron rotates when expanded', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.click('#tools-btn');

    const fileManagement = page.locator('[data-group="file-management"]');
    const chevron = fileManagement.locator('.permission-group-chevron');

    // Screenshot when open (chevron should be rotated)
    await expect(chevron).toHaveScreenshot('chevron-open.png', {
      animations: 'disabled',
    });

    // Collapse the group
    await fileManagement.locator('summary').click();

    // Screenshot when closed (chevron should not be rotated)
    await expect(chevron).toHaveScreenshot('chevron-closed.png', {
      animations: 'disabled',
    });
  });
});

test.describe('Visual Regression - WASM Tools', () => {
  test('WASM tools section renders correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.click('#tools-btn');

    const wasmToolGroups = page.locator('#wasm-tool-groups');
    await expect(wasmToolGroups).toBeVisible();

    await expect(wasmToolGroups).toHaveScreenshot('wasm-tools-section.png', {
      animations: 'disabled',
    });
  });

  test('WASM tools empty state displays correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.click('#tools-btn');

    const emptyMessage = page.locator('.wasm-tools-empty');
    // Check if empty message is visible (depends on whether tools are installed)
    const isVisible = await emptyMessage.isVisible();
    if (isVisible) {
      await expect(emptyMessage).toHaveScreenshot('wasm-tools-empty.png', {
        animations: 'disabled',
      });
    }
  });

  test('WASM install button displays correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.click('#tools-btn');

    const installBtn = page.locator('.wasm-install-btn');
    await expect(installBtn).toBeVisible();

    await expect(installBtn).toHaveScreenshot('wasm-install-button.png', {
      animations: 'disabled',
    });
  });

  test('WASM install button has decorative icon with aria-hidden', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.click('#tools-btn');

    const installBtnSvg = page.locator('.wasm-install-btn svg');
    await expect(installBtnSvg).toHaveAttribute('aria-hidden', 'true');
  });

  test('permission group chevrons have aria-hidden attribute', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.click('#tools-btn');

    // Check all chevrons have aria-hidden
    const chevrons = page.locator('.permission-group-chevron');
    const count = await chevrons.count();

    for (let i = 0; i < count; i++) {
      await expect(chevrons.nth(i)).toHaveAttribute('aria-hidden', 'true');
    }
  });

  test('WASM tool item structure is correct', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Inject a mock WASM tool for testing the item structure
    await page.evaluate(() => {
      const wasmToolsList = document.getElementById('wasm-tools-list');
      if (wasmToolsList) {
        wasmToolsList.innerHTML = `
          <div class="wasm-tool-item" data-tool-id="test-tool-1">
            <div class="wasm-tool-info">
              <span class="wasm-tool-name">Test Tool</span>
              <span class="wasm-tool-description">A test tool for testing</span>
              <span class="wasm-tool-meta">v1.0.0 · Testing · Built-in</span>
            </div>
            <div class="wasm-tool-controls">
              <button class="wasm-tool-toggle enabled" aria-label="Disable tool"></button>
              <button class="wasm-tool-delete" aria-label="Uninstall tool">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </div>
        `;
      }
    });

    await page.click('#tools-btn');

    const wasmToolItem = page.locator('.wasm-tool-item');
    await expect(wasmToolItem).toBeVisible();

    await expect(wasmToolItem).toHaveScreenshot('wasm-tool-item.png', {
      animations: 'disabled',
    });
  });

  test('WASM tool toggle displays correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Inject a mock WASM tool
    await page.evaluate(() => {
      const wasmToolsList = document.getElementById('wasm-tools-list');
      if (wasmToolsList) {
        wasmToolsList.innerHTML = `
          <div class="wasm-tool-item" data-tool-id="test-tool-1">
            <div class="wasm-tool-info">
              <span class="wasm-tool-name">Test Tool</span>
              <span class="wasm-tool-description">A test tool for testing</span>
              <span class="wasm-tool-meta">v1.0.0 · Testing</span>
            </div>
            <div class="wasm-tool-controls">
              <button class="wasm-tool-toggle enabled" aria-label="Disable tool"></button>
              <button class="wasm-tool-delete" aria-label="Uninstall tool">×</button>
            </div>
          </div>
        `;
      }
    });

    await page.click('#tools-btn');

    const toggleEnabled = page.locator('.wasm-tool-toggle.enabled');
    await expect(toggleEnabled).toHaveScreenshot('wasm-toggle-enabled.png', {
      animations: 'disabled',
    });

    // Test disabled state
    await page.evaluate(() => {
      const toggle = document.querySelector('.wasm-tool-toggle');
      if (toggle) {
        toggle.classList.remove('enabled');
      }
    });

    const toggleDisabled = page.locator('.wasm-tool-toggle');
    await expect(toggleDisabled).toHaveScreenshot('wasm-toggle-disabled.png', {
      animations: 'disabled',
    });
  });

  test('WASM tool delete button hover state', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Inject a mock WASM tool
    await page.evaluate(() => {
      const wasmToolsList = document.getElementById('wasm-tools-list');
      if (wasmToolsList) {
        wasmToolsList.innerHTML = `
          <div class="wasm-tool-item" data-tool-id="test-tool-1">
            <div class="wasm-tool-info">
              <span class="wasm-tool-name">Test Tool</span>
              <span class="wasm-tool-description">A test tool</span>
              <span class="wasm-tool-meta">v1.0.0 · Testing</span>
            </div>
            <div class="wasm-tool-controls">
              <button class="wasm-tool-toggle" aria-label="Enable tool"></button>
              <button class="wasm-tool-delete" aria-label="Uninstall tool">×</button>
            </div>
          </div>
        `;
      }
    });

    await page.click('#tools-btn');

    const deleteBtn = page.locator('.wasm-tool-delete');
    await deleteBtn.hover();

    await expect(deleteBtn).toHaveScreenshot('wasm-delete-hover.png', {
      animations: 'disabled',
    });
  });
});

test.describe('Visual Regression - Status Bar', () => {
  test('status bar is hidden by default', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const statusBar = page.locator('#status');
    await expect(statusBar).toBeHidden();
  });

  test('status bar displays correctly when shown', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Manually show the status bar for visual testing
    await page.evaluate(() => {
      const statusBar = document.getElementById('status');
      const statusMessage = document.getElementById('status-message');
      if (statusBar && statusMessage) {
        statusMessage.textContent = 'Test status message';
        statusBar.className = 'status-bar success';
      }
    });

    const statusBar = page.locator('#status');
    await expect(statusBar).toBeVisible();

    await expect(statusBar).toHaveScreenshot('status-bar-success.png', {
      animations: 'disabled',
    });
  });

  test('status bar dismiss button is visible when status is shown', async ({ page }) => {
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
    await expect(dismissBtn).toBeVisible();
  });

  test('clicking dismiss button hides the status bar', async ({ page }) => {
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

    const statusBar = page.locator('#status');
    await expect(statusBar).toBeVisible();

    // Click the dismiss button
    const dismissBtn = page.locator('#status-dismiss');
    await dismissBtn.click();

    // Wait for the status bar to be hidden
    await expect(statusBar).toBeHidden();
  });

  test('status bar elements are properly structured', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify all expected elements exist
    const statusBar = page.locator('#status');
    const statusMessage = page.locator('#status-message');
    const dismissBtn = page.locator('#status-dismiss');

    // Elements should exist in the DOM even if hidden
    await expect(statusBar).toBeAttached();
    await expect(statusMessage).toBeAttached();
    await expect(dismissBtn).toBeAttached();

    // Verify accessibility attributes
    await expect(dismissBtn).toHaveAttribute('aria-label', 'Dismiss notification');
  });
});
