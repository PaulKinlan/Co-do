/**
 * DOM Inspector Helpers for Playwright Tests
 *
 * Utilities for inspecting computed styles, layout properties, CSS variables,
 * and color values in the browser. Useful for debugging visual regression
 * issues and verifying dark mode behavior.
 */

import { Page, Locator } from '@playwright/test';

/**
 * Color information for an element
 */
export interface ElementColors {
  color: string;
  backgroundColor: string;
  borderColor: string;
  borderTopColor: string;
  borderRightColor: string;
  borderBottomColor: string;
  borderLeftColor: string;
  outlineColor: string;
}

/**
 * Layout information for an element
 */
export interface ElementLayout {
  display: string;
  position: string;
  width: number;
  height: number;
  paddingTop: string;
  paddingRight: string;
  paddingBottom: string;
  paddingLeft: string;
  marginTop: string;
  marginRight: string;
  marginBottom: string;
  marginLeft: string;
  gap: string;
  flexDirection: string;
  alignItems: string;
  justifyContent: string;
  overflow: string;
  overflowX: string;
  overflowY: string;
}

/**
 * Complete snapshot of an element's visual state
 */
export interface ElementSnapshot {
  tagName: string;
  id: string;
  className: string;
  isVisible: boolean;
  colors: ElementColors;
  layout: ElementLayout;
  typography: {
    fontFamily: string;
    fontSize: string;
    fontWeight: string;
    lineHeight: string;
    textAlign: string;
    letterSpacing: string;
  };
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  cssVariables: Record<string, string>;
}

/**
 * Get all color-related computed styles for an element
 */
export async function getElementColors(page: Page, selector: string): Promise<ElementColors> {
  return await page.locator(selector).evaluate((el) => {
    const styles = window.getComputedStyle(el);
    return {
      color: styles.color,
      backgroundColor: styles.backgroundColor,
      borderColor: styles.borderColor,
      borderTopColor: styles.borderTopColor,
      borderRightColor: styles.borderRightColor,
      borderBottomColor: styles.borderBottomColor,
      borderLeftColor: styles.borderLeftColor,
      outlineColor: styles.outlineColor,
    };
  });
}

/**
 * Get layout-related computed styles for an element
 */
export async function getElementLayout(page: Page, selector: string): Promise<ElementLayout> {
  return await page.locator(selector).evaluate((el) => {
    const styles = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return {
      display: styles.display,
      position: styles.position,
      width: rect.width,
      height: rect.height,
      paddingTop: styles.paddingTop,
      paddingRight: styles.paddingRight,
      paddingBottom: styles.paddingBottom,
      paddingLeft: styles.paddingLeft,
      marginTop: styles.marginTop,
      marginRight: styles.marginRight,
      marginBottom: styles.marginBottom,
      marginLeft: styles.marginLeft,
      gap: styles.gap,
      flexDirection: styles.flexDirection,
      alignItems: styles.alignItems,
      justifyContent: styles.justifyContent,
      overflow: styles.overflow,
      overflowX: styles.overflowX,
      overflowY: styles.overflowY,
    };
  });
}

/**
 * Get the resolved values of CSS custom properties from the :root element
 */
export async function getCSSVariableValues(
  page: Page,
  variableNames: string[]
): Promise<Record<string, string>> {
  return await page.evaluate((vars) => {
    const styles = window.getComputedStyle(document.documentElement);
    const result: Record<string, string> = {};
    for (const name of vars) {
      result[name] = styles.getPropertyValue(name).trim();
    }
    return result;
  }, variableNames);
}

/**
 * Get a comprehensive snapshot of an element's visual state
 */
export async function captureElementSnapshot(
  page: Page,
  selector: string,
  cssVariables: string[] = []
): Promise<ElementSnapshot> {
  return await page.locator(selector).evaluate(
    (el, vars) => {
      const styles = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const rootStyles = window.getComputedStyle(document.documentElement);

      const cssVars: Record<string, string> = {};
      for (const name of vars) {
        cssVars[name] = rootStyles.getPropertyValue(name).trim();
      }

      return {
        tagName: el.tagName.toLowerCase(),
        id: el.id,
        className: el.className,
        isVisible: el.offsetWidth > 0 && el.offsetHeight > 0,
        colors: {
          color: styles.color,
          backgroundColor: styles.backgroundColor,
          borderColor: styles.borderColor,
          borderTopColor: styles.borderTopColor,
          borderRightColor: styles.borderRightColor,
          borderBottomColor: styles.borderBottomColor,
          borderLeftColor: styles.borderLeftColor,
          outlineColor: styles.outlineColor,
        },
        layout: {
          display: styles.display,
          position: styles.position,
          width: rect.width,
          height: rect.height,
          paddingTop: styles.paddingTop,
          paddingRight: styles.paddingRight,
          paddingBottom: styles.paddingBottom,
          paddingLeft: styles.paddingLeft,
          marginTop: styles.marginTop,
          marginRight: styles.marginRight,
          marginBottom: styles.marginBottom,
          marginLeft: styles.marginLeft,
          gap: styles.gap,
          flexDirection: styles.flexDirection,
          alignItems: styles.alignItems,
          justifyContent: styles.justifyContent,
          overflow: styles.overflow,
          overflowX: styles.overflowX,
          overflowY: styles.overflowY,
        },
        typography: {
          fontFamily: styles.fontFamily,
          fontSize: styles.fontSize,
          fontWeight: styles.fontWeight,
          lineHeight: styles.lineHeight,
          textAlign: styles.textAlign,
          letterSpacing: styles.letterSpacing,
        },
        box: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        },
        cssVariables: cssVars,
      };
    },
    cssVariables
  );
}

/**
 * Parse an RGB/RGBA color string into its components
 */
export function parseRgb(rgb: string): { r: number; g: number; b: number; a: number } {
  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!match) return { r: 0, g: 0, b: 0, a: 1 };
  return {
    r: parseInt(match[1]),
    g: parseInt(match[2]),
    b: parseInt(match[3]),
    a: match[4] !== undefined ? parseFloat(match[4]) : 1,
  };
}

/**
 * Calculate the relative luminance of an RGB color (WCAG formula)
 */
export function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate the contrast ratio between two colors
 */
export function calculateContrastRatio(color1: string, color2: string): number {
  const c1 = parseRgb(color1);
  const c2 = parseRgb(color2);
  const l1 = getRelativeLuminance(c1.r, c1.g, c1.b);
  const l2 = getRelativeLuminance(c2.r, c2.g, c2.b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/**
 * Verify that text color meets WCAG AA contrast requirements against its background
 */
export async function verifyContrastRatio(
  page: Page,
  selector: string,
  minimumRatio: number = 4.5
): Promise<{ passes: boolean; ratio: number; foreground: string; background: string }> {
  const colors = await getElementColors(page, selector);
  const ratio = calculateContrastRatio(colors.color, colors.backgroundColor);
  return {
    passes: ratio >= minimumRatio,
    ratio: Math.round(ratio * 100) / 100,
    foreground: colors.color,
    background: colors.backgroundColor,
  };
}

/**
 * Check if dark mode is active by examining the resolved CSS variables
 */
export async function isDarkModeActive(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
}

/**
 * Get the dark mode CSS variable values that differ from light mode
 */
export async function getDarkModeColorDiff(page: Page): Promise<{
  bg: string;
  surface: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
}> {
  return await page.evaluate(() => {
    const styles = window.getComputedStyle(document.documentElement);
    return {
      bg: styles.getPropertyValue('--color-bg').trim(),
      surface: styles.getPropertyValue('--color-surface').trim(),
      border: styles.getPropertyValue('--color-border').trim(),
      textPrimary: styles.getPropertyValue('--color-text-primary').trim(),
      textSecondary: styles.getPropertyValue('--color-text-secondary').trim(),
    };
  });
}

/**
 * Inject a tool activity group into the chat messages container for testing
 */
export async function injectToolActivityGroup(
  page: Page,
  options: {
    toolName: string;
    args?: Record<string, unknown>;
    status?: 'pending' | 'completed';
    result?: Record<string, unknown>;
    expanded?: boolean;
  }
): Promise<Locator> {
  const { toolName, args = {}, status = 'completed', result, expanded = true } = options;

  await page.evaluate(
    ({ toolName, args, status, result, expanded }) => {
      const messages = document.getElementById('messages');
      if (!messages) return;

      const argsStr = JSON.stringify(args, null, 2);
      const statusClass = status === 'completed' ? 'completed' : 'pending';
      const statusText = status === 'completed' ? 'done' : 'calling...';

      let resultHtml = '';
      if (result) {
        const resultStr = JSON.stringify(result, null, 2);
        resultHtml = `
          <details class="tool-item-details tool-result-details">
            <summary>Result</summary>
            <pre class="tool-item-result">${resultStr}</pre>
          </details>
        `;
      }

      const expandedClass = expanded ? ' expanded' : '';
      const expandedAria = expanded ? 'true' : 'false';
      const toggleText = expanded ? '▲' : '▼';

      const group = document.createElement('div');
      group.className = `tool-activity-group${expandedClass}`;
      group.innerHTML = `
        <div class="tool-activity-header" role="button" tabindex="0" aria-expanded="${expandedAria}">
          <span class="tool-activity-icon">⚙️</span>
          <span class="tool-activity-summary">Using 1 tool...</span>
          <span class="tool-activity-toggle">${toggleText}</span>
        </div>
        <div class="tool-activity-content">
          <div class="tool-activity-item tool-call-item" data-tool="${toolName}">
            <div class="tool-item-header">
              <span class="tool-item-icon">🔧</span>
              <span class="tool-item-name">${toolName}</span>
              <span class="tool-item-status ${statusClass}">${statusText}</span>
            </div>
            <details class="tool-item-details">
              <summary>Arguments</summary>
              <pre class="tool-item-args">${argsStr}</pre>
            </details>
            ${resultHtml}
          </div>
        </div>
      `;
      messages.appendChild(group);
    },
    { toolName, args, status, result, expanded }
  );

  return page.locator('.tool-activity-group').last();
}

/**
 * Inject a chat message into the messages container for testing
 */
export async function injectChatMessage(
  page: Page,
  options: {
    role: 'user' | 'assistant' | 'system' | 'error';
    content: string;
  }
): Promise<Locator> {
  const { role, content } = options;

  await page.evaluate(
    ({ role, content }) => {
      const messages = document.getElementById('messages');
      if (!messages) return;

      const message = document.createElement('div');
      message.className = `message ${role}`;
      message.textContent = content;
      messages.appendChild(message);
    },
    { role, content }
  );

  return page.locator(`.message.${role}`).last();
}

/**
 * Inject a status bar for testing
 */
export async function injectStatusBar(
  page: Page,
  options: {
    message: string;
    type: 'info' | 'success' | 'error';
  }
): Promise<Locator> {
  const { message, type } = options;

  await page.evaluate(
    ({ message, type }) => {
      const statusBar = document.getElementById('status');
      const statusMessage = document.getElementById('status-message');
      if (statusBar && statusMessage) {
        statusMessage.textContent = message;
        statusBar.className = `status-bar ${type}`;
      }
    },
    { message, type }
  );

  return page.locator('#status');
}
