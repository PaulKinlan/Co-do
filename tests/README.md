# Co-do Test Suite

This directory contains comprehensive visual regression and accessibility tests for Co-do.

## Overview

Our testing strategy focuses on:
1. **Visual Regression Testing** - Detecting unintended UI changes
2. **Accessibility Testing** - Ensuring WCAG 2.1 Level AA compliance
3. **Cross-browser Testing** - Verifying Chrome compatibility (primary target)

## Test Structure

```
tests/
├── visual/                    # Visual regression tests
│   ├── ui-components.spec.ts  # Main UI components
│   └── button-styling.spec.ts # Button appearance and placement
├── accessibility/             # Accessibility tests
│   └── wcag-compliance.spec.ts # WCAG 2.1 AA compliance
└── helpers/                   # Shared utilities
    └── test-utils.ts          # Common test functions
```

## Running Tests

### All Tests
```bash
npm test
```

### Visual Regression Tests Only
```bash
npm run test:visual
```

### Accessibility Tests Only
```bash
npm run test:accessibility
```

### Interactive Mode (Recommended for Development)
```bash
npm run test:ui
```

### Debug Mode
```bash
npm run test:debug
```

### Update Visual Baselines
```bash
npm run test:visual:update
```

**⚠️ Only run this when you intentionally changed UI appearance!**

## Writing New Tests

### Visual Regression Test Template

```typescript
import { test, expect } from '@playwright/test';

test.describe('My Feature', () => {
  test('component renders correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const component = page.locator('#my-component');
    await expect(component).toHaveScreenshot('my-component.png', {
      animations: 'disabled',
    });
  });

  test('component hover state', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const component = page.locator('#my-component');
    await component.hover();

    await expect(component).toHaveScreenshot('my-component-hover.png', {
      animations: 'disabled',
    });
  });
});
```

### Accessibility Test Template

```typescript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('My Feature Accessibility', () => {
  test('should not have accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .include('#my-component')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('should have adequate color contrast', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .include('#my-component')
      .withTags(['cat.color'])
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
```

## Test Best Practices

### 1. Always Disable Animations
```typescript
await expect(element).toHaveScreenshot('name.png', {
  animations: 'disabled',
});
```

### 2. Wait for Network Idle
```typescript
await page.goto('/');
await page.waitForLoadState('networkidle');
```

### 3. Use Semantic Selectors
```typescript
// Good
const button = page.locator('#submit-btn');
const modal = page.locator('[role="dialog"]');

// Avoid
const button = page.locator('.btn.btn-primary.mt-4');
```

### 4. Test All Interactive States
```typescript
test('button states', async ({ page }) => {
  // Normal state
  await expect(button).toHaveScreenshot('button-normal.png');

  // Hover state
  await button.hover();
  await expect(button).toHaveScreenshot('button-hover.png');

  // Focus state
  await button.focus();
  await expect(button).toHaveScreenshot('button-focus.png');
});
```

### 5. Test Responsive Design
```typescript
test('mobile layout', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/');
  await expect(page).toHaveScreenshot('mobile.png', { fullPage: true });
});
```

### 6. Use Helper Functions
```typescript
import { openModal, closeModal } from './helpers/test-utils';

test('modal test', async ({ page }) => {
  await page.goto('/');
  const modal = await openModal(page, 'settings-modal', 'settings-btn');
  // ... test modal
  await closeModal(page, 'settings-modal');
});
```

## Common Issues

### Screenshot Mismatches

**Problem:** Visual tests fail with screenshot differences

**Solutions:**
1. Review the diff in test report: `npm run test:report`
2. If change is intentional: `npm run test:visual:update`
3. If unintentional: Fix the CSS/layout issue
4. Ensure you're using `animations: 'disabled'`

### Accessibility Violations

**Problem:** Axe-core reports WCAG violations

**Common violations and fixes:**
- **color-contrast**: Increase contrast ratio to 4.5:1 minimum
- **button-name**: Add `aria-label` to buttons without text
- **label**: Associate `<label>` with form inputs using `for` attribute
- **heading-order**: Ensure heading levels are sequential (h1, h2, h3)

### Flaky Tests

**Problem:** Tests pass sometimes and fail other times

**Solutions:**
1. Add proper wait conditions:
   ```typescript
   await page.waitForSelector('#element');
   await page.waitForLoadState('networkidle');
   ```
2. Disable animations: `animations: 'disabled'`
3. Wait for specific conditions:
   ```typescript
   await expect(element).toBeVisible();
   ```

### Tests Pass Locally but Fail in CI

**Problem:** Different rendering in CI environment

**Solutions:**
1. Install exact font dependencies in CI
2. Use consistent viewport sizes
3. Add retry logic for network-dependent tests
4. Ensure proper timeouts

## Viewing Test Results

### HTML Report
```bash
npm run test:report
```

Opens an interactive HTML report showing:
- Test results
- Screenshot diffs
- Error messages
- Video recordings (on failure)

### CI Artifacts

When tests run in GitHub Actions:
1. Go to the Actions tab
2. Select the workflow run
3. Download `playwright-report` artifact
4. Extract and open `index.html`

## Updating Tests After UI Changes

When you intentionally change UI:

1. **Make your changes** to source files
2. **Update baselines**: `npm run test:visual:update`
3. **Review changes**: Check that updated screenshots look correct
4. **Commit together**: Commit code + updated screenshots in the same commit

```bash
# After UI changes
npm run test:visual:update

# Review the changes
git diff tests/visual/

# Commit together
git add .
git commit -m "Update button styling and test baselines"
```

## Coverage Goals

- **Visual Coverage**: All visible UI components
- **Accessibility Coverage**: 100% WCAG 2.1 AA compliance
- **Responsive Coverage**: Mobile (375px), Tablet (768px), Desktop (1280px)
- **Interactive Coverage**: All hover, focus, and active states

## Questions?

See `CLAUDE.md` for comprehensive testing guidelines and project documentation.
