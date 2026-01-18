import { Page, expect } from '@playwright/test';

/**
 * Test Utilities for Co-do
 *
 * Common helper functions for testing
 */

/**
 * Opens a modal and waits for it to be visible
 */
export async function openModal(page: Page, modalId: string, triggerButtonId: string) {
  await page.click(`#${triggerButtonId}`);
  await page.waitForSelector(`#${modalId}:not([hidden])`);
  const modal = page.locator(`#${modalId}`);
  await expect(modal).toBeVisible();
  return modal;
}

/**
 * Closes a modal using the close button
 */
export async function closeModal(page: Page, modalId: string) {
  const closeBtn = page.locator(`#${modalId} .modal-close`);
  await closeBtn.click();
  await page.waitForTimeout(200); // Wait for animation
  const modal = page.locator(`#${modalId}`);
  await expect(modal).toBeHidden();
}

/**
 * Closes a modal using the Escape key
 */
export async function closeModalWithEscape(page: Page, modalId: string) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200); // Wait for animation
  const modal = page.locator(`#${modalId}`);
  await expect(modal).toBeHidden();
}

/**
 * Waits for page to be fully loaded with no network activity
 */
export async function waitForPageLoad(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForLoadState('domcontentloaded');
}

/**
 * Gets computed styles for an element
 */
export async function getComputedStyles(page: Page, selector: string, properties: string[]) {
  return await page.locator(selector).evaluate((el, props) => {
    const styles = window.getComputedStyle(el);
    const result: Record<string, string> = {};
    props.forEach((prop) => {
      result[prop] = styles.getPropertyValue(prop);
    });
    return result;
  }, properties);
}

/**
 * Checks if an element has adequate color contrast
 */
export async function hasAdequateContrast(
  page: Page,
  elementSelector: string,
  minimumRatio: number = 4.5
): Promise<boolean> {
  return await page.locator(elementSelector).evaluate((el, minRatio) => {
    const styles = window.getComputedStyle(el);
    const color = styles.color;
    const backgroundColor = styles.backgroundColor;

    // Parse RGB values
    const parseRgb = (rgb: string) => {
      const match = rgb.match(/\d+/g);
      return match ? match.map(Number) : [0, 0, 0];
    };

    const [r1, g1, b1] = parseRgb(color);
    const [r2, g2, b2] = parseRgb(backgroundColor);

    // Calculate relative luminance
    const getLuminance = (r: number, g: number, b: number) => {
      const [rs, gs, bs] = [r, g, b].map((c) => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    };

    const l1 = getLuminance(r1, g1, b1);
    const l2 = getLuminance(r2, g2, b2);

    // Calculate contrast ratio
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

    return ratio >= minRatio;
  }, minimumRatio);
}

/**
 * Takes a screenshot with consistent settings
 */
export async function takeStandardScreenshot(
  page: Page,
  name: string,
  options: { fullPage?: boolean } = {}
) {
  return await expect(page).toHaveScreenshot(name, {
    fullPage: options.fullPage || false,
    animations: 'disabled',
  });
}

/**
 * Simulates typing with a realistic delay
 */
export async function typeWithDelay(page: Page, selector: string, text: string, delay: number = 50) {
  const input = page.locator(selector);
  await input.focus();

  for (const char of text) {
    await page.keyboard.type(char);
    await page.waitForTimeout(delay);
  }
}

/**
 * Verifies that an element is within the viewport
 */
export async function isInViewport(page: Page, selector: string): Promise<boolean> {
  return await page.locator(selector).evaluate((el) => {
    const rect = el.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= window.innerHeight &&
      rect.right <= window.innerWidth
    );
  });
}

/**
 * Gets the bounding box relative to the viewport
 */
export async function getViewportRelativeBoundingBox(page: Page, selector: string) {
  return await page.locator(selector).evaluate((el) => {
    const rect = el.getBoundingClientRect();
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
    };
  });
}
