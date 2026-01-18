# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Co-do is a Cowork-like experience in the browser using the File System Access API. This project enables collaborative coding and file editing directly in the browser with native filesystem integration.

> **IMPORTANT: Always run `npm test` after making code changes.** Tests must pass before committing.
>
> **Exception:** Tests do not need to be run for documentation-only changes (`.md` files, comments, etc.) that don't affect application behavior.

## Browser Support

**Target: Latest Chrome (Chrome 140+)**

This project relies on the File System Access API, which is currently best supported in Chromium-based browsers. This means:

- Use all modern web platform APIs without concern for legacy browser support
- No polyfills required for modern JavaScript features
- Chrome-specific APIs are acceptable when they provide better functionality
- Focus on Baseline Newly Available and Baseline Widely Available features
- The File System Access API is the core dependency (Chrome 86+, Edge 86+, limited Safari support)

When implementing features, always use modern browser APIs as documented in `.claude/skills/modern-web-dev/SKILL.md`.

## Development Commands

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Starts the Vite development server on http://localhost:3000

### Build

```bash
npm run build
```

Builds the application for production to the `dist` directory. Runs TypeScript compilation and Vite build.

### Type Checking

```bash
npm run type-check
```

Runs TypeScript type checking without emitting files.

### Preview

```bash
npm run preview
```

Preview the production build locally.

### Testing

```bash
npm test
```

Runs all Playwright tests (visual regression and accessibility).

```bash
npm run test:visual
```

Runs only visual regression tests to detect UI changes.

```bash
npm run test:accessibility
```

Runs only accessibility tests (WCAG 2.1 Level AA compliance, color contrast, etc.).

```bash
npm run test:visual:update
```

Updates baseline screenshots for visual regression tests. Run this when you intentionally change UI appearance.

```bash
npm run test:ui
```

Opens the Playwright UI mode for interactive test debugging.

```bash
npm run test:debug
```

Runs tests in debug mode with the Playwright Inspector.

```bash
npm run test:report
```

Opens the HTML test report after a test run.

## Project Structure

```
Co-do/
├── src/
│   ├── main.ts          # Application entry point
│   ├── ui.ts            # UI manager and event handlers
│   ├── fileSystem.ts    # File System Access API wrapper
│   ├── ai.ts            # AI SDK integration
│   ├── tools.ts         # AI tools for file operations
│   ├── preferences.ts   # User preferences and permissions
│   └── styles.css       # Application styles
├── tests/
│   ├── visual/          # Visual regression tests
│   ├── accessibility/   # WCAG compliance and accessibility tests
│   └── helpers/         # Test utilities and helpers
├── index.html           # HTML entry point
├── vite.config.ts       # Vite configuration with CSP
├── playwright.config.ts # Playwright test configuration
├── tsconfig.json        # TypeScript configuration
└── package.json         # Dependencies and scripts
```

## Key Dependencies

- **Vercel AI SDK** (`ai`): Multi-provider AI integration with streaming support
- **@ai-sdk/anthropic**: Anthropic Claude integration
- **@ai-sdk/openai**: OpenAI GPT integration
- **@ai-sdk/google**: Google Gemini integration
- **zod**: Schema validation for tool parameters
- **Vite**: Fast build tool and development server
- **TypeScript**: Type safety and developer experience

## Key Technologies

This project uses:

- **File System Access API**: Core functionality for native filesystem integration
- **Vercel AI SDK**: For AI model integration with support for multiple providers
- **Modern ES Modules**: For all JavaScript code
- **localStorage**: For user preferences and API key storage (client-side only)
- **TypeScript**: For type safety and better developer experience
- **Vite**: For fast development and optimized production builds

## Architecture Guidelines

When building this project:

1. **Modern APIs First**: Always prefer modern web platform APIs over polyfills or legacy approaches. See `.claude/skills/modern-web-dev/SKILL.md` for comprehensive guidance.

2. **File System Access API**: This is the core feature. Familiarize yourself with:
   - `window.showOpenFilePicker()`
   - `window.showSaveFilePicker()`
   - `window.showDirectoryPicker()`
   - FileSystemFileHandle and FileSystemDirectoryHandle APIs

3. **Security Considerations**: File system access requires user permission. Always handle:
   - Permission requests gracefully
   - Permission denial scenarios
   - Secure file operations

4. **Adding New Tools**: When creating a new AI tool in `src/tools.ts`, you must also:
   - Add the tool name to the `ToolName` type in `src/preferences.ts`
   - Add a default permission entry in `DEFAULT_TOOL_PERMISSIONS` in `src/preferences.ts`
   - Add a corresponding permission UI element in `index.html` inside the `#tool-permissions` container
   - Use the `checkPermission()` function in the tool's execute function to enforce permissions

5. **Collaboration Features**: When implementing Cowork-like functionality, consider:
   - Real-time synchronization patterns
   - Conflict resolution for concurrent edits
   - Presence indicators for collaborators
   - Efficient data transfer for file content

## Modern Web Development Skill

This repository includes a custom skill at `.claude/skills/modern-web-dev/SKILL.md` that enforces modern web API usage. The skill is automatically available and should be referenced when:

- Implementing browser features
- Working with DOM APIs
- Adding new UI components
- Integrating browser capabilities

Key principles from the skill:
- Use `fetch()` instead of XMLHttpRequest
- Use `navigator.clipboard` instead of `document.execCommand`
- Use Constraint Validation API for forms
- Use IntersectionObserver instead of scroll event polling
- Use `structuredClone()` instead of JSON parse/stringify
- Always verify browser support against this project's requirements

## Testing Guidelines

**CRITICAL: All UI changes must include tests. Do not skip this step.**

This project uses Playwright for comprehensive visual regression and accessibility testing. Testing is mandatory to prevent:
- Visual regressions (buttons misplaced, broken layouts)
- Accessibility issues (poor contrast, missing ARIA labels)
- Broken UI components
- Responsive design problems

### When to Write Tests

**You MUST write tests when:**

1. **Adding new UI components** - Create visual regression tests for the component
2. **Modifying existing UI** - Update baseline screenshots with `npm run test:visual:update`
3. **Adding new features** - Test all UI states (normal, hover, focus, disabled)
4. **Changing styles** - Verify contrast ratios and visual appearance
5. **Adding modals or overlays** - Test open/close states and accessibility
6. **Implementing responsive design** - Test mobile, tablet, and desktop viewports

### When Tests Are NOT Required

**Skip running tests for:**

- **Markdown files** (`.md`) - Documentation changes don't affect application behavior
- **Comment-only changes** - Adding or updating code comments
- **README updates** - Repository documentation
- **License file changes** - Legal documentation
- **Configuration file comments** - Non-functional changes to config files

### Test Types

#### Visual Regression Tests

Visual regression tests capture screenshots and compare them against baseline images. These tests catch:
- Button misalignment
- Incorrect spacing or padding
- Font size or color changes
- Layout breaks
- Component rendering issues

**Location:** `tests/visual/`

**Example:**
```typescript
test('button displays correctly', async ({ page }) => {
  await page.goto('/');
  const button = page.locator('#my-button');
  await expect(button).toHaveScreenshot('my-button.png', {
    animations: 'disabled',
  });
});
```

#### Accessibility Tests

Accessibility tests verify WCAG 2.1 Level AA compliance, including:
- Color contrast ratios (minimum 4.5:1 for normal text, 3:1 for large text)
- ARIA attributes and labels
- Keyboard navigation
- Focus management
- Semantic HTML

**Location:** `tests/accessibility/`

**Example:**
```typescript
test('component has no accessibility violations', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
```

### Test Organization

- **`tests/visual/`** - Visual regression tests for UI components
  - `ui-components.spec.ts` - Main UI components (header, sidebar, chat)
  - `button-styling.spec.ts` - Button appearance and positioning
- **`tests/accessibility/`** - Accessibility and WCAG compliance tests
  - `wcag-compliance.spec.ts` - Color contrast, ARIA, keyboard navigation
- **`tests/helpers/`** - Shared test utilities
  - `test-utils.ts` - Helper functions for common test operations

### Running Tests

**Before committing code:**
```bash
npm test
```

**After changing UI appearance (intentionally):**
```bash
npm run test:visual:update
```

**For debugging:**
```bash
npm run test:ui          # Interactive UI mode
npm run test:debug       # Debug mode with inspector
npm run test:headed      # Run with browser visible
```

### CI/CD Integration

Tests automatically run on:
- Every pull request
- Every push to main
- Every commit to feature branches

If tests fail, the build fails. Do not merge code with failing tests.

### Updating Baseline Screenshots

When you intentionally change UI appearance:

1. Make your UI changes
2. Run `npm run test:visual:update` to update baseline screenshots
3. Review the updated screenshots in `tests/visual/*.spec.ts-snapshots/`
4. Commit both code changes AND updated screenshots together

### Writing New Tests

When adding a new feature, follow this pattern:

1. **Create the feature** - Implement the UI component or feature
2. **Write visual tests** - Capture screenshots of all states
3. **Write accessibility tests** - Verify WCAG compliance
4. **Test interactivity** - Test hover, focus, and active states
5. **Test responsiveness** - Test on different viewport sizes
6. **Run tests** - Ensure all tests pass before committing

**Example workflow:**
```bash
# 1. Implement feature
# (edit source files)

# 2. Create test file
# tests/visual/my-feature.spec.ts

# 3. Run tests to create baselines
npm run test:visual:update

# 4. Run all tests to verify
npm test

# 5. Commit everything
git add .
git commit -m "Add new feature with tests"
```

### Best Practices

1. **Disable animations** - Use `animations: 'disabled'` in screenshot tests
2. **Wait for page load** - Always use `await page.waitForLoadState('networkidle')`
3. **Test all states** - Normal, hover, focus, active, disabled
4. **Use semantic selectors** - Prefer IDs and data-testid over CSS classes
5. **Keep tests focused** - One test should verify one thing
6. **Use helper functions** - Reuse common test operations from `tests/helpers/test-utils.ts`
7. **Test mobile views** - Use `page.setViewportSize()` for responsive tests
8. **Verify contrast** - All text must meet WCAG AA contrast requirements (4.5:1)

### Common Issues and Solutions

**Issue: Screenshot tests failing**
- **Cause:** UI changed unintentionally or test is flaky
- **Solution:** Review the diff in the test report (`npm run test:report`), fix the UI issue, or update baselines if change was intentional

**Issue: Accessibility violations**
- **Cause:** Missing ARIA labels, poor contrast, or semantic HTML issues
- **Solution:** Review the axe-core violations in the test output, add proper labels, improve contrast, or fix HTML structure

**Issue: Tests passing locally but failing in CI**
- **Cause:** Different font rendering, timing issues, or missing dependencies
- **Solution:** Use `animations: 'disabled'`, add proper wait conditions, or update CI configuration

### Test Coverage Requirements

All new code must maintain:
- **Visual coverage:** All visible UI components must have screenshot tests
- **Accessibility coverage:** All interactive elements must pass WCAG 2.1 AA
- **Responsive coverage:** Key pages must be tested on mobile, tablet, and desktop

**Remember: Tests are not optional. They protect users from broken UI and accessibility issues.**

## GitHub PR Review Feedback

When working through feedback from GitHub pull request reviews, follow this process to ensure continuous improvement:

### Addressing Review Comments

1. **Fix all issues** - Address every comment raised by reviewers
2. **Run tests** - After fixes, run `npm test` to verify nothing is broken
3. **Document patterns** - If a reviewer raises an issue that reflects a recurring pattern or common mistake, update this CLAUDE.md file

### Updating CLAUDE.md with Lessons Learned

**IMPORTANT:** After resolving GitHub PR review feedback, evaluate whether the issues raised represent patterns that should be documented to prevent future occurrences.

**When to update CLAUDE.md:**
- A reviewer points out a coding pattern that should be avoided
- Multiple PRs have similar feedback about the same issue
- A reviewer identifies a project-specific convention not yet documented
- Security, accessibility, or performance issues are raised that apply broadly

**How to update:**
1. Identify the root cause of the feedback
2. Add a clear guideline to the appropriate section of this file
3. Include examples if helpful (what to do vs. what not to do)
4. Commit the CLAUDE.md update along with the PR fixes

**Example additions:**
- Add to "Architecture Guidelines" if it's about code structure
- Add to "Testing Guidelines" if it's about test coverage or patterns
- Add to "Security Considerations" if it's about security practices
- Create a new section if the feedback covers a new area

### Lessons Learned from PR Reviews

This section captures specific guidelines that emerged from PR review feedback. Add new items here as they arise:

<!-- Add lessons learned from PR reviews below this line -->
