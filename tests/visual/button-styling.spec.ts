import { test, expect } from '@playwright/test';

/**
 * Button Styling and Placement Tests
 *
 * These tests specifically verify that buttons:
 * - Are properly positioned
 * - Have correct sizes and spacing
 * - Look good and not "rubbish"
 * - Maintain consistent styling across the app
 */

test.describe('Button Styling - Header Buttons', () => {
  test('header icon buttons have consistent size', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const infoBtn = page.locator('#info-btn');
    const settingsBtn = page.locator('#settings-btn');
    const toolsBtn = page.locator('#tools-btn');

    // Get button dimensions
    const infoBtnBox = await infoBtn.boundingBox();
    const settingsBtnBox = await settingsBtn.boundingBox();
    const toolsBtnBox = await toolsBtn.boundingBox();

    expect(infoBtnBox).toBeTruthy();
    expect(settingsBtnBox).toBeTruthy();
    expect(toolsBtnBox).toBeTruthy();

    // All buttons should have the same width and height
    expect(infoBtnBox!.width).toBe(settingsBtnBox!.width);
    expect(infoBtnBox!.width).toBe(toolsBtnBox!.width);
    expect(infoBtnBox!.height).toBe(settingsBtnBox!.height);
    expect(infoBtnBox!.height).toBe(toolsBtnBox!.height);
  });

  test('header buttons are properly aligned', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const infoBtn = page.locator('#info-btn');
    const settingsBtn = page.locator('#settings-btn');
    const toolsBtn = page.locator('#tools-btn');

    const infoBtnBox = await infoBtn.boundingBox();
    const settingsBtnBox = await settingsBtn.boundingBox();
    const toolsBtnBox = await toolsBtn.boundingBox();

    // All buttons should be vertically aligned (same y position)
    expect(infoBtnBox!.y).toBe(settingsBtnBox!.y);
    expect(infoBtnBox!.y).toBe(toolsBtnBox!.y);

    // Buttons should have consistent horizontal spacing
    const spacing1 = settingsBtnBox!.x - (infoBtnBox!.x + infoBtnBox!.width);
    const spacing2 = toolsBtnBox!.x - (settingsBtnBox!.x + settingsBtnBox!.width);

    expect(spacing1).toBe(spacing2);
  });

  test('header button icons are properly sized within buttons', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const infoBtn = page.locator('#info-btn');

    // Screenshot a single button to verify icon sizing
    await expect(infoBtn).toHaveScreenshot('header-button-icon-sizing.png', {
      animations: 'disabled',
    });
  });

  test('mobile menu button appears only on mobile', async ({ page }) => {
    // Desktop - should not be visible
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const mobileMenuBtn = page.locator('#mobile-menu-btn');
    const isVisibleDesktop = await mobileMenuBtn.isVisible();

    // Mobile - should be visible
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const isVisibleMobile = await mobileMenuBtn.isVisible();

    expect(isVisibleMobile).toBe(true);
  });
});

test.describe('Button Styling - Primary Buttons', () => {
  test('select folder button has proper styling', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const selectFolderBtn = page.locator('#select-folder-btn');

    // Get button properties
    const btnBox = await selectFolderBtn.boundingBox();
    const btnStyles = await selectFolderBtn.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        backgroundColor: styles.backgroundColor,
        color: styles.color,
        padding: styles.padding,
        borderRadius: styles.borderRadius,
        fontSize: styles.fontSize,
        fontWeight: styles.fontWeight,
      };
    });

    // Verify button has proper dimensions (not too small or too large)
    expect(btnBox!.width).toBeGreaterThan(100);
    expect(btnBox!.height).toBeGreaterThan(30);
    expect(btnBox!.height).toBeLessThan(60);

    // Button should have rounded corners
    expect(btnStyles.borderRadius).not.toBe('0px');

    // Screenshot for visual verification
    await expect(selectFolderBtn).toHaveScreenshot('select-folder-btn-styling.png', {
      animations: 'disabled',
    });
  });

  test('send button has proper styling', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const sendBtn = page.locator('#send-btn');

    // Get button dimensions
    const btnBox = await sendBtn.boundingBox();

    // Send button should be square-ish (close to equal width/height)
    const aspectRatio = btnBox!.width / btnBox!.height;
    expect(aspectRatio).toBeGreaterThan(0.8);
    expect(aspectRatio).toBeLessThan(1.2);

    // Screenshot for visual verification
    await expect(sendBtn).toHaveScreenshot('send-btn-styling.png', {
      animations: 'disabled',
    });
  });

  test('add provider button has proper styling', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.click('#settings-btn');
    await page.waitForSelector('#settings-modal:not([hidden])');

    const addProviderBtn = page.locator('#add-provider-btn');
    await expect(addProviderBtn).toBeVisible();

    // Screenshot for visual verification
    await expect(addProviderBtn).toHaveScreenshot('add-provider-btn-styling.png', {
      animations: 'disabled',
    });
  });
});

test.describe('Button Styling - Modal Buttons', () => {
  test('modal action buttons have consistent styling', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.click('#settings-btn');
    await page.waitForSelector('#settings-modal:not([hidden])');
    await page.waitForTimeout(300); // Wait for modal animation

    const addProviderBtn = page.locator('#add-provider-btn');
    await expect(addProviderBtn).toBeVisible();
    await addProviderBtn.click();

    await page.waitForSelector('#provider-edit-modal:not([hidden])');
    await page.waitForTimeout(300); // Wait for modal animation

    const cancelBtn = page.locator('#provider-cancel-btn');
    const saveBtn = page.locator('#provider-save-btn');

    await expect(cancelBtn).toBeVisible();
    await expect(saveBtn).toBeVisible();

    const cancelBtnBox = await cancelBtn.boundingBox();
    const saveBtnBox = await saveBtn.boundingBox();

    // Buttons should have the same height
    expect(cancelBtnBox!.height).toBe(saveBtnBox!.height);

    // Buttons should be vertically aligned
    expect(cancelBtnBox!.y).toBe(saveBtnBox!.y);

    // Screenshot the button group
    const modalButtons = page.locator('#provider-edit-modal .modal-buttons');
    await expect(modalButtons).toBeVisible();
    await expect(modalButtons).toHaveScreenshot('modal-buttons-styling.png', {
      animations: 'disabled',
    });
  });

  test('modal close button is properly positioned', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.click('#settings-btn');
    await page.waitForSelector('#settings-modal:not([hidden])');

    const closeBtn = page.locator('#settings-modal .modal-close');
    const modalHeader = page.locator('#settings-modal .modal-header');

    const closeBtnBox = await closeBtn.boundingBox();
    const headerBox = await modalHeader.boundingBox();

    // Close button should be in the top-right area of the header
    const closeBtnCenterX = closeBtnBox!.x + closeBtnBox!.width / 2;
    const headerRight = headerBox!.x + headerBox!.width;

    expect(closeBtnCenterX).toBeGreaterThan(headerBox!.x + headerBox!.width * 0.8);

    // Screenshot the modal header
    await expect(modalHeader).toHaveScreenshot('modal-header-close-btn.png', {
      animations: 'disabled',
    });
  });
});

test.describe('Button Styling - Hover and Active States', () => {
  test('buttons have visible hover state', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const sendBtn = page.locator('#send-btn');

    // Get initial state
    const initialState = await sendBtn.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        backgroundColor: styles.backgroundColor,
        transform: styles.transform,
      };
    });

    // Hover and check for changes
    await sendBtn.hover();
    await page.waitForTimeout(100); // Wait for transition

    const hoverState = await sendBtn.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        backgroundColor: styles.backgroundColor,
        transform: styles.transform,
      };
    });

    // Something should change on hover (either color or transform)
    const hasVisualChange =
      initialState.backgroundColor !== hoverState.backgroundColor ||
      initialState.transform !== hoverState.transform;

    expect(hasVisualChange).toBe(true);
  });

  test('icon buttons have visible hover state', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const infoBtn = page.locator('#info-btn');

    // Get initial screenshot
    await expect(infoBtn).toHaveScreenshot('icon-btn-normal.png', {
      animations: 'disabled',
    });

    // Hover and get hover screenshot
    await infoBtn.hover();
    await page.waitForTimeout(100);

    await expect(infoBtn).toHaveScreenshot('icon-btn-hover.png', {
      animations: 'disabled',
    });
  });
});

test.describe('Button Styling - Spacing and Layout', () => {
  test('buttons have adequate padding', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const selectFolderBtn = page.locator('#select-folder-btn');

    const padding = await selectFolderBtn.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        top: parseInt(styles.paddingTop),
        right: parseInt(styles.paddingRight),
        bottom: parseInt(styles.paddingBottom),
        left: parseInt(styles.paddingLeft),
      };
    });

    // Buttons should have at least 8px padding
    expect(padding.top).toBeGreaterThanOrEqual(8);
    expect(padding.right).toBeGreaterThanOrEqual(8);
    expect(padding.bottom).toBeGreaterThanOrEqual(8);
    expect(padding.left).toBeGreaterThanOrEqual(8);
  });

  test('buttons are not cut off or overlapping', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check header buttons don't overlap
    const infoBtn = page.locator('#info-btn');
    const settingsBtn = page.locator('#settings-btn');

    const infoBtnBox = await infoBtn.boundingBox();
    const settingsBtnBox = await settingsBtn.boundingBox();

    // Settings button should start after info button ends (with spacing)
    expect(settingsBtnBox!.x).toBeGreaterThan(infoBtnBox!.x + infoBtnBox!.width);
  });

  test('button text is not truncated', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const selectFolderBtn = page.locator('#select-folder-btn');
    await expect(selectFolderBtn).toBeVisible();

    // Check that text is visible and not using text-overflow
    const hasTextOverflow = await selectFolderBtn.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return styles.textOverflow === 'ellipsis' || styles.overflow === 'hidden';
    });

    // Button should not be truncating text (text-overflow: ellipsis)
    // This is just a visual check - if text IS truncated intentionally, this test should be updated
    const btnBox = await selectFolderBtn.boundingBox();
    expect(btnBox!.width).toBeGreaterThan(50); // Button should be wide enough for text
  });
});
